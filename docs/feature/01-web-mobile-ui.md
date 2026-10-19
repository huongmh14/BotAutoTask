# Đặc Tả Tính Năng: Giao Diện Điều Khiển Trực Quan (Local & Mobile Web/PWA)

## 1. Mục Tiêu & Yêu Cầu Kỹ Thuật
Cung cấp một giao diện điều khiển đồ hoạ trực quan (Dashboard phong cách GrokBot & Neko-Bot) cho phép người chỉ huy (Human Commander):
1. **Quan sát trực tiếp hội thoại đa Agent:** Xem theo thời gian thực luồng chat và handoff công việc giữa `lead`, `coder-1`, `coder-2`, `reviewer` và các Agent chuyên biệt tạo động.
2. **Bẻ lái tức thì (⚡ Steer Bar):** Gửi chỉ thị ưu tiên cao nhất (`MessageSubagent`) vào Agent đang chạy mà không làm mất ngữ cảnh.
3. **Đổi lõi linh hoạt (Dynamic Core Switcher):** Chuyển đổi giữa `Claude Code`, `Codex Direct OAuth`, `OpenCode Free Models`, `Antigravity IDE` hoặc các model miễn phí khác (`opencode/deepseek-v4.1-flash-free`, `freemodel/claude-sonnet-4-6`, `opencode/big-pickle`, v.v.) bằng dropdown ngay trên UI.
4. **Giám sát IDE Transcript & Git Worktree:** Tail log `transcript.jsonl` mới nhất của Antigravity IDE và hiển thị nhánh Git Worktree tương ứng của từng Agent.
5. **Kiến trúc Zero-Dependency (100% Node.js built-in):** Không cài đặt thư viện frontend nặng, không cần bước biên dịch Webpack/Vite; toàn bộ HTML/CSS/JS được gói gọn trong module [`src/ui/dashboard-html.js`](file:///d:/BotAutoTask/src/ui/dashboard-html.js) để phục vụ cho cả:
   - **Local PC Server (`http://127.0.0.1:8765`):** Khi khởi chạy lệnh `botautotask ui`.
   - **Cloudflare Worker 24/7 (`GET /`):** Khi người dùng mở trên trình duyệt điện thoại trong lúc máy tính ở nhà tắt hoàn toàn.

---

## 2. Bố Cục Giao Diện (UI Layout & Wireframe)

Giao diện được thiết kế theo phong cách Dark Mode chuyên nghiệp, tối ưu cho cả màn hình Desktop và Mobile Responsive:

```
+-----------------------------------------------------------------------------------------------+
|  BOTAUTOTASK CONTROL CENTER v2.0              [Status: PC ONLINE] [Free Model: deepseek-v4.1] |
+-------------------------------+-----------------------------------+---------------------------+
| 👥 AGENT ROSTER               | 💬 LIVE COWORKER MESH FEED        | 📋 REAL-TIME IDE LOGS     |
|                               |                                   |                           |
| [lead] Team Lead              | [lead -> coder-1]:                | Conversation:             |
| Core: [opencode/deepseek-v4.1]| "Hãy thiết kế module worktree     | 8ea3-26fc-70a1...         |
| Status: RUNNING (1m 12s)      |  manager với đầy đủ unit test."   | Status: DONE              |
| Worktree: main                |                                   | Tools: execFile, readFile |
| [⚡ Steer] [🛑 Stop]          | [coder-1 -> lead]:                | Last Agent Response:      |
|                               | "Đã tạo xong file và chạy test    | "Tất cả 14 test đã pass." |
| [coder-1] Senior Engineer     |  đạt 14/14. Đang gửi diff."       |                           |
| Core: [codex:oauth-session]   |                                   |                           |
| Status: IDLE                  | [reviewer -> coder-1]:            | ------------------------- |
| Worktree: botautotask/coder-1 | "Cần bổ sung guard kiểm tra khi   | 🔐 ZERO-KEY AUTH STATUS   |
| [⚡ Steer] [🛑 Stop]          |  thư mục không phải git repo."    | • codex: SIGNED IN        |
|                               |                                   | • opencode: SIGNED IN     |
| [reviewer] QA & Composer      |                                   | • antigravity: SIGNED IN  |
| Core: [claude:claude-3-7]     |                                   |                           |
| Status: RUNNING               |                                   | 🧬 HARNESS² EVOLUTION     |
| Worktree: botautotask/reviewer|                                   | • Guardrails: 4 rules     |
|                               |                                   | • Active Skills: 3 skills |
+-------------------------------+-----------------------------------+---------------------------+
| ⚡ QUICK STEER & LAUNCH: [ Target: coder-1 v ] [ Nhập chỉ thị bẻ lái khẩn cấp...        ] [ Gửi ] |
+-----------------------------------------------------------------------------------------------+
```

---

## 3. Kiến Trúc REST API & Server-Sent Events (SSE)

### 3.1. Luồng Sự Kiện Real-Time (`GET /api/events`)
Sử dụng chuẩn HTTP SSE (`Content-Type: text/event-stream; charset=utf-8`) tích hợp sẵn trong Node.js `node:http`:
```javascript
// Cấu trúc event stream đẩy xuống Web UI
data: {"type":"agent_message","fromId":"lead","targetId":"coder-1","message":"Implement X"}
data: {"type":"agent_steered","agentId":"coder-1","message":"Use node:crypto"}
data: {"type":"agent_status","agentId":"coder-1","status":"running","core":"codex"}
data: {"type":"ide_log_update","stepCount":15,"lastStatus":"DONE"}
data: {"type":"worktree_merged","agentId":"coder-1","commitSha":"a1b2c3d"}
```

### 3.2. Danh Sách Endpoint REST
| Phương thức | Endpoint | Thân yêu cầu (Body) | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Không | Trả về HTML/CSS/JS Single-Page App |
| `GET` | `/api/events` | Không | Mở kết nối SSE stream đẩy sự kiện real-time |
| `GET` | `/api/state` | Không | Trả về JSON toàn bộ trạng thái Mesh, Agent, Cores, Auth, Logs |
| `POST` | `/api/agents/:id/steer` | `{"message":"..."}` | Bơm chỉ thị ưu tiên vào Agent (`mesh.steerAgent`) |
| `POST` | `/api/agents/:id/core` | `{"preferredCore":"..."}` | Đổi lõi AI/model cho Agent |
| `POST` | `/api/agents/:id/stop` | Không | Dừng Agent đang chạy (`mesh.stopAgent`) |
| `POST` | `/api/agents` | `{"id":"...","name":"...","description":"...","preferredCore":"..."}` | Khởi tạo thêm Agent mới |
| `POST` | `/api/team/start` | `{"goal":"...","path":"...","useWorktrees":true}` | Khởi chạy Goal mới cho cả Biệt đội |

---

## 4. Tương Thích Mobile PWA (Progressive Web App)
- File `manifest.json` và thẻ meta viewport được nhúng sẵn trong HTML.
- Khi người dùng mở link Cloudflare Worker hoặc quét mã QR từ Terminal trên điện thoại (iOS Safari hoặc Android Chrome), chỉ cần chọn **"Thêm vào Màn hình chính" (Add to Home Screen)** để chạy toàn màn hình (Standalone Display) như một Native App thực thụ.
