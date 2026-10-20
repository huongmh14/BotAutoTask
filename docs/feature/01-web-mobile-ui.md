# SPEC-UI (Spec 01) — Giao Diện Điều Khiển Trực Quan (Local Web + Mobile PWA)

| Thuộc tính | Giá trị |
|---|---|
| ID | `SPEC-UI` |
| Trạng thái | `As-built` (Đã triển khai và nâng cấp Attention UI ở [`SPEC-SAFE`](08-mesh-safety-attention-ui.md)) |
| Giai đoạn | 1 |
| Phụ thuộc (`Depends on`) | `SPEC-CORE`, `SPEC-MESH` |
| Quyết định liên quan | `D-01`, `D-04`, `D-06`, `D-09` |
| Module triển khai | `src/ui/dashboard-html.js`, `src/daemon/web-ui.js` |
| Lệnh khởi chạy | `botautotask ui [--port 8765] [--open]` |
| Ràng buộc | Zero-dependency (`node:http`, SSE, HTML nhúng); cùng mô hình phục vụ Local và Cloudflare Worker |

## 1. Mục tiêu & Phạm vi

### 1.1 Mục tiêu
1. Xem trực tiếp `lead / coder-* / reviewer` trao đổi, tool call, handoff.
2. Bẻ lái (steer), ngắt (interrupt), xếp hàng (queue) chỉ thị cho từng agent.
3. Đổi core/model từng agent khi đang chạy.
4. Xem `transcript.jsonl` của Antigravity, trạng thái worktree, auth 0-key, approval đang chờ.
5. Dùng được trên điện thoại (PWA) — khi PC tắt thì dùng bản Cloud ([`SPEC-CLOUD`](02-mobile-cloud-control.md)).

### 1.2 Phạm vi
- **Trong phạm vi:**
  - HTTP/SSE Server nội bộ (`127.0.0.1`), xác thực token qua header `Authorization` / `?k=` / `?token=`, chống DNS-rebinding (`Origin`/`Host`).
  - Luồng sự kiện SSE có `seq` tăng dần và replay từ ring buffer theo `Last-Event-ID`.
  - Chống gửi lệnh trùng bằng `nonce` (idempotent POST).
  - Giao diện Tactical Coworker PWA (Roster, Stream, Diff Review Modal, Approval Cards, Command Palette `Ctrl+K`).
- **Ngoài phạm vi:**
  - Xác thực nhiều tài khoản người dùng (Multi-user login / OAuth provider riêng).
  - Nhúng trình duyệt Chromium/Electron trực tiếp vào tiến trình CLI (`D-01`).

## 2. Cơ sở nghiên cứu → cải tiến
| Quan sát | Nguồn | Áp dụng vào BotAutoTask |
|---|---|---|
| UI giao tiếp coordinator qua **một kênh khung (frame) duy nhất**: `hello/ready{protocolVersion}`, `request{requestId}`/`reply`, `cancel{requestId}` gắn `AbortSignal`, `event{family}`, hàng đợi trước khi kết nối ≤256 | GrokBot `sand:coordinator-port` (report §2) | Dùng đúng mô hình frame này trên SSE (server→client) + POST (client→server). `cancel` nối `AbortController` của turn |
| Nút **Stop phải xác nhận**, rồi interrupt mọi session song song bằng `Promise.allSettled` | GrokBot §2 | Nút 🛑 có confirm; "Stop all" dùng `allSettled`, báo từng kết quả |
| Live status `{isRunning, runningSessionIds, activity, hasRunningSubagents}`, **stale sau 90s → idle** | GrokBot §1 | `AgentStatus` có `updatedAtMs`, `staleAfterMs=90000`; badge "STALE" thay vì "RUNNING" giả |
| Kênh đăng ký `roster`, `transcript:<id>`, `group:`, `task:` | GrokBot §1 | SSE `?subscribe=roster,transcript:coder-1` để mobile chỉ tải phần cần |
| Gửi prompt có `clientNonce`, server trả `DUPLICATE` khi trùng; journal `queued→dispatching→accepted→acked/failed` | GrokBot §2 | Mọi POST điều khiển mang `nonce`; mạng chập chờn trên mobile không tạo lệnh đôi |
| Mirror: browser nhận **đúng trạng thái đang điều khiển UI chính**, replay có `seq` cursor, phát hiện frame thiếu/trùng, mọi hàng đợi có giới hạn | Neko relay v5 (`cloudflare/relay/README.md`) | Event có `seq` tăng dần; client gửi `Last-Event-ID` để replay; ring buffer 500 event |
| Approval đi kênh riêng, không bị chặn khi turn đang chờ | Neko `/control` | Panel "Approvals" gọi `POST /api/approvals/:id` ([`SPEC-VERIFY`](05-verification-policy-auth.md), [`SPEC-SAFE`](08-mesh-safety-attention-ui.md)) |
| GrokBot **không có model picker** (model gắn theo bot phía server) | GrokBot §2 | Điểm khác biệt của BotAutoTask: dropdown core/model mỗi agent |

## 3. Bố cục
```
┌ Header: trạng thái PC/Cloud · model đang dùng · số approval chờ ───────────────┐
├ Roster (trái)            ├ Mesh feed (giữa)              ├ Panel (phải, tab)   ┤
│ [lead] RUNNING 1m12s     │ lead → coder-1: "..."         │ IDE log            │
│  core ▾ opencode/ds-v4   │ coder-1 ⚙ tool: npm test ✔    │ Worktrees          │
│  wt: main  ⚡ ⏸ 🛑        │ reviewer → coder-1: "..."     │ Approvals (2)      │
│ [coder-1] STALE 95s      │                               │ Auth 0-key         │
├ Steer bar: [target ▾] [delivery: send|interrupt|queue] [nội dung...] [Gửi]      ┤
```
Mobile (<720px): 3 tab dưới đáy (Agents / Feed / Panel), steer bar cố định.

## 4. Giao thức
### 4.1 Server → client (`GET /api/events`, SSE)
```
id: 1042
event: frame
data: {"t":"event","family":"agent_message","seq":1042,"payload":{"from":"lead","to":"coder-1","text":"..."}}
```
`family ∈ {hello, roster, agent_status, agent_message, tool_call, steer, worktree, ide_log, approval, error}`.
Frame đầu tiên: `{"t":"hello","protocolVersion":1,"seq":<hiện tại>}`. Client reconnect gửi `Last-Event-ID` → server replay từ ring buffer (500 event / 1MB); nếu cursor quá cũ → gửi `{"t":"event","family":"roster"}` snapshot đầy đủ (`mirror_reset`).

### 4.2 Client → server (POST JSON, mọi request có `nonce`)
| Endpoint | Body | Kết quả |
|---|---|---|
| `GET /api/state` | — | snapshot roster, cores, models, auth, worktrees, approvals |
| `POST /api/agents/:id/message` | `{nonce, text, delivery:"send"\|"interrupt"\|"queue"}` | `{status:"accepted"\|"duplicate", requestId}` |
| `POST /api/agents/:id/core` | `{nonce, preferredCore}` | áp dụng từ turn kế tiếp |
| `POST /api/agents/:id/stop` | `{nonce, confirm:true}` | thiếu `confirm` → 400 |
| `POST /api/agents/stop-all` | `{nonce, confirm:true}` | `[{id, ok, error?}]` (allSettled) |
| `POST /api/requests/:requestId/cancel` | `{nonce}` | abort turn tương ứng |
| `POST /api/agents` | `{nonce, id, name, description, preferredCore}` | tạo agent |
| `POST /api/team/start` | `{nonce, goal, path, useWorktrees, check}` | chạy nền, tiến độ qua SSE |
| `POST /api/approvals/:id` | `{nonce, decision:"approve"\|"deny", hash, note}` | Duyệt/từ chối merge ([`SPEC-SAFE`](08-mesh-safety-attention-ui.md)) |
| `GET /api/agents/:id/diff` | — | Lấy `git diff` của nhánh worktree agent (tối đa `200 KB`) |
| `GET /api/experience?domain=` | — | Đọc danh sách bài học từ Experience Library |

## 5. Bảo mật
- Bind **chỉ** `127.0.0.1`. Token phiên ngẫu nhiên in ra terminal + mở URL `http://127.0.0.1:8765/#k=<token>`; client đọc fragment rồi `history.replaceState` xoá (kỹ thuật Neko), gửi qua header `Authorization` (hoặc `?k=` cho `EventSource`).
- Kiểm tra `Origin`/`Host` = `127.0.0.1:<port>` để chặn DNS-rebinding/CSRF từ trang web khác.
- Body ≤ 1MB; nonce cache 10 phút (`MAX_NONCES = 1000`).

## 6. Kế thừa Pack & Yêu cầu chuẩn EARS (`UI-Rnn`)

### 6.1 Kế thừa từ Pack (`PK-API`, `PK-AUTH`, `PK-FE`)

| REQ dự án | Kế thừa từ Pack | Tham số / Giá trị áp dụng tại BotAutoTask |
|---|---|---|
| `UI-R01` | `PK-AUTH-R02`, `PK-API-R06` | `{allowed-origins} = ["http://127.0.0.1:<port>", "http://localhost:<port>"]`, so sánh token bằng `crypto.timingSafeEqual` |
| `UI-R02` | `PK-API-R01`, `PK-API-R02`, `PK-API-R03` | `{debug-flag} = false`; lỗi 400 khi thiếu trường (`confirm: true`, `text`); lỗi 500 không lộ stack trace |
| `UI-R05` | `PK-FE-R01`, `PK-FE-R02`, `PK-FE-R03` | `{tokens-path} = CSS variables (:root) trong src/ui/dashboard-html.js`, `{a11y-standard} = WCAG 2.2 AA` (`role="dialog"`, `aria-modal`, điều khiển bàn phím `Ctrl+K` / `Esc`) |

### 6.2 Bảng Yêu cầu (EARS)

| ID | Mức | Yêu cầu (EARS) | Bằng chứng (`As-built`) |
|---|---|---|---|
| `UI-R01` | MUST | `LocalWebUiServer` MUST chỉ bind trên `127.0.0.1`, xác thực mọi request `/api/*` bằng `crypto.timingSafeEqual` (chấp nhận header `Authorization: Bearer`, `?k=` hoặc `?token=`), và MUST trả `403` nếu `Origin`/`Host` không thuộc `127.0.0.1` hoặc `localhost`. | `src/daemon/web-ui.js:48-115` |
| `UI-R02` | MUST | Khi client kết nối `GET /api/events` kèm `Last-Event-ID` (hoặc `?since=<seq>`), server MUST phát lại các frame có `seq > since` từ ring buffer (tối đa `500` sự kiện) theo đúng thứ tự tăng dần. | `src/daemon/web-ui.js:120-165` |
| `UI-R03` | MUST | Khi client gửi các request POST điều khiển có trường `nonce` trùng với một `nonce` đã xử lý trong vòng `10 phút`, server MUST trả về `{ status: "duplicate" }` và MUST NOT thực thi lại hành động trên `AgentMesh`. | `src/daemon/web-ui.js:170-210` |
| `UI-R04` | MUST | Khi client gọi `POST /api/agents/:id/stop` hoặc `POST /api/agents/stop-all` mà không truyền `confirm: true`, server MUST từ chối với mã HTTP `400`. | `src/daemon/web-ui.js:265-295` |
| `UI-R05` | MUST | Giao diện Dashboard MUST hiển thị trạng thái `STALE` cho agent đang `running` nhưng không có cập nhật quá `90 giây` (`staleAfterMs = 90000`), hỗ trợ đầy đủ 4 trạng thái (`loading`, `empty`, `error`, `data`) và điều khiển được bằng bàn phím (`Ctrl+K`, `Alt+1..9`, `Esc`). | `src/daemon/web-ui.js`, `src/ui/dashboard-html.js` |

## 7. Yêu cầu phi chức năng (NFR)

| Khía cạnh | Yêu cầu (số liệu) hoặc `N/A — lý do` |
|---|---|
| Hiệu năng | `GET /api/state` phản hồi `< 15 ms` trên local loopback; HTML nhúng tải một lần không cần bundler runtime. |
| Bảo mật | Token phiên 24 ký tự hex ngẫu nhiên mỗi lần chạy; xoá `#k=` khỏi thanh địa chỉ trình duyệt ngay khi đọc bằng `history.replaceState`. |
| Giới hạn / rate limit | Request JSON body tối đa `1 MB` (vượt trả `413`); ring buffer SSE tối đa `500` frame; bộ nhớ đệm `nonce` tối đa `1000` khoá (TTL `10 phút`). |
| Khả dụng / khôi phục | Khi kết nối SSE bị đứt, trình duyệt tự động kết nối lại kèm `Last-Event-ID` hoặc fallback sang polling `/api/state` mỗi `3 giây`. |
| Quan sát (log, metric, audit) | Mọi sự kiện `agent_message`, `tool_call`, `steer`, `approval_request`, `worktree_merged` đều có `seq` và `timestamp` hiển thị trực tiếp trên stream. |
| i18n | Giao diện hỗ trợ tiếng Việt có dấu đầy đủ (UTF-8), thuật ngữ kỹ thuật giữ tiếng Anh. |
| a11y | Modal Diff và Command Palette (`Ctrl+K`) có `role="dialog"`, `aria-modal="true"`, quản lý focus khi mở/đóng (`PK-FE-R03`). |
| Trạng thái UI | Hiển thị đủ trạng thái kết nối (`ONLINE`, `RECONNECTING`, `OFFLINE`), trạng thái agent (`attention`, `working`, `done`, `idle`, `STALE`) và trạng thái trống khi chưa có tin nhắn (`PK-FE-R01`). |

## 8. Trường hợp biên (Edge Cases)

- Client gửi lại cùng một lệnh `POST /api/agents/:id/message` với cùng `nonce` do mạng chập chờn → lần thứ hai trả `{ status: 'duplicate' }`, agent chỉ nhận 1 tin (`UI-AC02`).
- Người dùng bấm Stop nhưng thiếu `confirm: true` trong body → trả HTTP `400` (`UI-AC03`).
- Trang web độc hại ở tab khác gọi `fetch('http://127.0.0.1:8765/api/state')` với `Origin: https://evil.com` → bị chặn với HTTP `403` (`UI-AC01`).
- Agent đang chạy nhưng tiến trình treo không cập nhật hoạt động quá `90 giây` → `/api/state` đánh dấu `stale: true` (`UI-AC04`).

## 9. Điều kiện nghiệm thu (`AC`)

- [x] **UI-AC01** *(integration)* — **Cho** `LocalWebUiServer` khởi chạy với token phiên, **khi** gọi `/api/state` không có token, sai `Origin`, hoặc gọi `/api/events?k=<token>`, **thì** các request không hợp lệ nhận `401`/`403` và request có `?k=<token>` hợp lệ nhận `200` stream SSE. *(Test: `tests/web-ui.test.js`)*
- [x] **UI-AC02** *(integration)* — **Cho** client gửi `POST /api/agents/coder/message` với `nonce: "n-1"`, **khi** gửi lại đúng `nonce: "n-1"` lần thứ hai, **thì** lần đầu trả `status: "accepted"` và lần hai trả `status: "duplicate"`, hộp thư agent chỉ có 1 tin nhắn. *(Test: `tests/web-ui.test.js`)*
- [x] **UI-AC03** *(integration)* — **Cho** endpoint `POST /api/agents/coder/stop`, **khi** gọi thiếu `confirm: true` so với có `confirm: true`, **thì** thiếu `confirm` trả `400` và có `confirm` trả `200` kèm dừng agent. *(Test: `tests/web-ui.test.js`)*
- [x] **UI-AC04** *(integration)* — **Cho** các sự kiện SSE đã phát với `seq` tăng dần và một agent có `updatedAtMs` cách hiện tại `> 90000 ms`, **khi** client kết nối lại với `Last-Event-ID` và gọi `GET /api/state`, **thì** client nhận đúng các frame bị lỡ và agent được gắn cờ `stale: true`. *(Test: `tests/web-ui.test.js`)*

## 10. Kiểm tra end-to-end

```powershell
node --test tests/web-ui.test.js
```

## 11. Làm rõ & Câu hỏi mở

- **Làm rõ (2026-10-20):** Lỗi `EventSource` gửi `?k=` bị trả `401` và các nâng cấp UX (Attention buckets, Smart scroll, Diff review modal, `Ctrl+K`) đã được triển khai hoàn chỉnh trong [`SPEC-SAFE` (`08-mesh-safety-attention-ui.md`)](08-mesh-safety-attention-ui.md).
- **Câu hỏi mở:** Không có.
