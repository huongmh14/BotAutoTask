# Spec 01 — Giao Diện Điều Khiển Trực Quan (Local Web + Mobile PWA)

| Mục | Giá trị |
|---|---|
| Trạng thái | 📝 Spec v2 (đã cải tiến theo GrokBot 0.71.2 + Neko relay v5) |
| Module dự kiến | `src/ui/dashboard-html.js`, `src/daemon/web-ui.js`, `src/core/event-bus.js` |
| Lệnh | `botautotask ui [--port 8765] [--open]` |
| Ràng buộc | Zero-dependency (`node:http`, SSE, HTML nhúng); cùng một HTML phục vụ cả Local và Cloudflare Worker |

## 1. Mục tiêu
1. Xem trực tiếp `lead / coder-* / reviewer` trao đổi, tool call, handoff.
2. Bẻ lái (steer), ngắt (interrupt), xếp hàng (queue) chỉ thị cho từng agent.
3. Đổi core/model từng agent khi đang chạy.
4. Xem `transcript.jsonl` của Antigravity, trạng thái worktree, auth 0-key, approval đang chờ.
5. Dùng được trên điện thoại (PWA) — khi PC tắt thì dùng bản Cloud (Spec 02).

## 2. Cơ sở nghiên cứu → cải tiến
| Quan sát | Nguồn | Áp dụng vào BotAutoTask |
|---|---|---|
| UI giao tiếp coordinator qua **một kênh khung (frame) duy nhất**: `hello/ready{protocolVersion}`, `request{requestId}`/`reply`, `cancel{requestId}` gắn `AbortSignal`, `event{family}`, hàng đợi trước khi kết nối ≤256 | GrokBot `sand:coordinator-port` (report §2) | Dùng đúng mô hình frame này trên SSE (server→client) + POST (client→server). `cancel` nối `AbortController` của turn |
| Nút **Stop phải xác nhận**, rồi interrupt mọi session song song bằng `Promise.allSettled` | GrokBot §2 | Nút 🛑 có confirm; "Stop all" dùng `allSettled`, báo từng kết quả |
| Live status `{isRunning, runningSessionIds, activity, hasRunningSubagents}`, **stale sau 90s → idle** | GrokBot §1 | `AgentStatus` có `updatedAtMs`, `staleAfterMs=90000`; badge "STALE" thay vì "RUNNING" giả |
| Kênh đăng ký `roster`, `transcript:<id>`, `group:`, `task:` | GrokBot §1 | SSE `?subscribe=roster,transcript:coder-1` để mobile chỉ tải phần cần |
| Gửi prompt có `clientNonce`, server trả `DUPLICATE` khi trùng; journal `queued→dispatching→accepted→acked/failed` | GrokBot §2 | Mọi POST điều khiển mang `nonce`; mạng chập chờn trên mobile không tạo lệnh đôi |
| Mirror: browser nhận **đúng trạng thái đang điều khiển UI chính**, replay có `seq` cursor, phát hiện frame thiếu/trùng, mọi hàng đợi có giới hạn | Neko relay v5 (`cloudflare/relay/README.md`) | Event có `seq` tăng dần; client gửi `Last-Event-ID` để replay; ring buffer 500 event |
| Approval đi kênh riêng, không bị chặn khi turn đang chờ | Neko `/control` | Panel "Approvals" gọi `POST /api/approvals/:id` (Spec 05) |
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
| `POST /api/approvals/:id` | `{nonce, decision:"approve"\|"always"\|"deny"}` | Spec 05 |

## 5. Bảo mật
- Bind **chỉ** `127.0.0.1`. Token phiên ngẫu nhiên in ra terminal + mở URL `http://127.0.0.1:8765/#k=<token>`; client đọc fragment rồi `history.replaceState` xoá (kỹ thuật Neko), gửi qua header `Authorization`.
- Kiểm tra `Origin`/`Host` = `127.0.0.1:<port>` để chặn DNS-rebinding/CSRF từ trang web khác.
- Body ≤ 1MB; nonce cache 10 phút.

## 6. Tiêu chí chấp nhận
- [ ] SSE reconnect với `Last-Event-ID` không mất / không trùng event (test seq).
- [ ] Gửi cùng `nonce` hai lần → lần hai trả `duplicate`, agent chỉ nhận một lệnh.
- [ ] `delivery:"interrupt"` huỷ tiến trình CLI đang chạy (cây tiến trình) trong ≤2s rồi chạy chỉ thị mới.
- [ ] Agent không cập nhật >90s hiển thị STALE.
- [ ] Không token / sai Origin → 401/403.
- [ ] Màn hình 375px dùng được đủ chức năng.

## 7. Test tối thiểu
`tests/web-ui.test.js`: dựng server trên port 0, kiểm tra 401, nonce duplicate, replay theo `Last-Event-ID`, stale timer (fake clock).
