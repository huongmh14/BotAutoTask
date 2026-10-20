---
name: verify-botautotask
description: Kích hoạt khi nghiệm thu runtime, kiểm tra giao diện Web UI (WhaleBot 52Hz), xác minh đội ngũ AI Agent (@lead, @coder, @reviewer), hoặc thu thập bằng chứng chạy test thực tế (Visible Test Execution Ledger — C19, C29) cho dự án BotAutoTask.
---

# Verify BotAutoTask — Bộ Kiểm chứng Runtime & Giao diện Thực tế (`C19`, `C29`)

> Base: `writing-spec-for-ai v1.3.0` · Luật áp dụng: `C18` (Gotcha có ngày kiểm), `C19` (Kiểm tác dụng thật), `C23` (Floor Guard), `C29` (Visible Test Plan & Execution Ledger).

## 1. Launch (Khởi chạy từ trạng thái chuẩn)

1. Đóng gói bản build độc lập mới nhất trước khi bật server:
   ```powershell
   node scripts/build-single-file.js
   ```
2. Khởi chạy Web UI Server (cô lập bằng biến môi trường `BOTAUTOTASK_UI_TOKEN` hoặc cổng riêng nếu đang chạy song song):
   ```powershell
   $env:BOTAUTOTASK_UI_TOKEN = "verify-local-token"
   node src/daemon/cli.js ui --port 8765
   ```
3. **Dấu hiệu sẵn sàng thật sự:** stdout in dòng `[BotAutoTask] Local Web UI live at: http://127.0.0.1:8765/#k=...` và `GET http://127.0.0.1:8765/api/state` (kèm header `Authorization: Bearer <token>`) trả `HTTP 200` với `agents.length >= 3`.

## 2. Doctor (Kiểm tra sức khoẻ chỉ đọc `< 3 giây`)

Chạy lệnh một dòng dưới đây để kiểm tra: (a) cú pháp `<script>` nhúng trong HTML không có `SyntaxError` (`node:vm`), (b) cổng `8765` đang sống, và (c) danh sách 3 đồng sự (`lead`, `coder`, `reviewer`) trả về đầy đủ:

```powershell
node -e "import('./src/ui/dashboard-html.js').then(({renderDashboardHtml}) => { const vm = require('node:vm'); const html = renderDashboardHtml('doc-tok'); const m = html.match(/<script>([\s\S]*?)<\/script>/); new vm.Script(m[1]); console.log('[Doctor] Inline <script> syntax: OK (' + m[1].length + ' chars)'); })"
```

## 3. Drive (Điều khiển bằng Playwright Chromium thật & HTTP/SSE)

Không chỉ kiểm tra chuỗi regex trên HTML tĩnh — bắt buộc mở trang bằng `playwright-core` (Chromium headless) và kiểm tra DOM đã render:

- **Roster & Đội ngũ AI Agent (`[UI-AC01]`):**
  - Selector `#groupRoster .chat-item`: phải hiển thị `Nhóm WhaleBot`.
  - Selector `#coworkerRoster .chat-item`: phải có ít nhất `3` phần tử hiển thị `@lead · Trưởng nhóm`, `@coder · Lập trình viên`, `@reviewer · Kiểm duyệt`.
  - Selector `#sseText`: phải chuyển từ `…` sang `LIVE` (hoặc `POLLING`), tuyệt đối không kẹt ở `…` (dấu hiệu `<script>` bị lỗi cú pháp).
  - Biến `pageErrors` (`page.on('pageerror', ...)`): phải bằng `0`.
- **Logo & Linh vật Cá voi 52Hz (`[UI-AC01]`):**
  - Selector `.brand-logo svg path[fill="#1670ED"][fill-rule="evenodd"]` và `.hero-art svg path[fill="#1670ED"][fill-rule="evenodd"]`: hiển thị đường cong cá voi 52Hz (`M723.4 329.6...`).
- **Bảng điều khiển nhanh & Modal Diff (`[SAFE-AC03]`, `[SAFE-AC05]`):**
  - Bấm `Ctrl+K` → `#cmdkModal.open` hiển thị danh sách chuyển nhanh đồng sự và lệnh.
  - Bấm `.pill-btn` (`Xem diff & Gộp`) → `#diffModal.open` gọi `GET /api/agents/coder/diff` và hiển thị thống kê nhánh.

## 4. Evidence & Visible Test Ledger (`C19`, `C29`)

Mọi lượt nghiệm thu bắt buộc lưu ảnh chụp màn hình thực tế vào `.botautotask/evidence/` và in bảng **Visible Test Execution Ledger (`C29`)** ra báo cáo cho người dùng:

| AC-ID | Kịch bản đã chạy | Input đã bơm | Output & Tác dụng phụ thực tế (DOM / DB / File) | Độ thật (Mock Disclosure) | Kết quả & Thời gian |
|---|---|---|---|---|---|
| `[UI-AC01]` | Mở `http://127.0.0.1:8765` trên Chromium thật | `GET /` + SSE `/api/events` + `GET /api/state` | `0` pageerror; `#sseText = LIVE`; `#coworkerRoster` render đủ `@lead`, `@coder`, `@reviewer`; `.brand-logo` & `.hero-art` hiển thị cá voi 52Hz `#1670ED` | `0 Mock` (Server HTTP/SSE thật + Chromium thật) | PASS |

## 5. Cleanup (Dọn dẹp an toàn)

- Chỉ tắt đúng `PID` của tiến trình server do phiên kiểm chứng bật lên (`Stop-Process -Id <PID>`), **cấm dùng `Stop-Process -Name node`** làm tắt phiên làm việc của người dùng.
- Giữ nguyên thư mục `.botautotask/evidence/` chứa ảnh chụp màn hình nghiệm thu.

## 6. Gotchas (`C18`)

- **Template Literal Backslash Unescaping trong `src/ui/dashboard-html.js` (Kiểm lần cuối: 2026-10-20):**
  Vì `renderDashboardHtml()` trả về chuỗi template literal `` `...` ``, mọi ký tự escape trong `<script>` (`\\n`, `\\r`, `\\s`, `\\[`, `\\]`) **bắt buộc phải viết 2 dấu gạch chéo ngược (`\\`)**. Nếu chỉ viết 1 dấu `\n` hoặc `\s`, Node.js sẽ nuốt mất dấu `\` khi ghép chuỗi HTML, biến `\n` thành xuống dòng thật trong chuỗi `'...'` hoặc biến `\[` thành `[` trong regex `/.../`, gây lỗi `Uncaught SyntaxError` làm trắng toàn bộ danh sách đồng sự AI trên trình duyệt. Luôn chạy lệnh **Doctor** (`new vm.Script()`) sau mỗi lần sửa `src/ui/dashboard-html.js`.
