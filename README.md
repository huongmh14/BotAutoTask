# BotAutoTask (`D:\BotAutoTask`)

Hệ thống điều phối Đa Lõi AI (Pluggable Multi-Core Orchestrator) tự động săn các model miễn phí tốt nhất (`deepseek-v4.1-flash-free`, `gpt-luna`, `openrouter/*:free`, `gemini-2.5-pro`...), tự động đổi lõi khi chạm Rate Limit (`429`), tự chạy khi có mạng, hỗ trợ đánh thức máy (Wake Timer) hoặc chuyển giao lên **Cloud Worker (GitHub Actions)** khi tắt máy, và điều khiển 24/7 qua **Telegram Bot (Cloudflare Workers + D1 Free)**.

---

## 1. Kiến trúc Tách Bạch Lõi (Pluggable Harnesses)

Bộ điều phối (`src/core/orchestrator.js`) **hoàn toàn độc lập** với các công cụ AI bên dưới. Mọi lõi AI đều cắm qua chuẩn `AgentHarness` trong `src/harnesses/`:

| Lõi (Harness ID) | File Adapter | Mô tả |
| :--- | :--- | :--- |
| `opencode` | [`src/harnesses/opencode-harness.js`](src/harnesses/opencode-harness.js) | Tự động quét `opencode models` và OpenRouter Free API để lấy các model free mạnh nhất (`deepseek-v4.1-flash-free`, `gpt-luna`, `grok-code`, `big-pickle`...) |
| `antigravity` | [`src/harnesses/antigravity-harness.js`](src/harnesses/antigravity-harness.js) | Gọi `agy` hoặc `agentapi new-conversation` |
| `claude` / `codex` | [`src/harnesses/claude-codex-harness.js`](src/harnesses/claude-codex-harness.js) | Gọi `claude -p` và `codex exec --full-auto` |
| `neko-core` | [`src/harnesses/neko-core-harness.js`](src/harnesses/neko-core-harness.js) | Kết nối runtime Neko Core (`http://127.0.0.1:19820/api/run`), tách biệt hoàn toàn để dễ thay thế |
| `custom-cmd` | [`src/harnesses/custom-cmd-harness.js`](src/harnesses/custom-cmd-harness.js) | Cho phép cắm **bất kỳ lõi AI tự phát triển nào** chỉ bằng cấu hình JSON mà không cần sửa code |

### Cách thay thế Neko Core hoặc cắm Lõi AI tự phát triển mới
Mở [`config/default-config.json`](config/default-config.json):
- Để tắt `neko-core`: đặt `"neko-core": { "enabled": false }`.
- Để thêm lõi tự phát triển mới, thêm vào mảng `"customHarnesses"`:
```json
"customHarnesses": [
  {
    "id": "my-custom-ai-core",
    "enabled": true,
    "models": ["my-free-model-v1"],
    "commandTemplate": "my-ai-cli --model {{model}} --prompt-file {{prompt_file}} --workspace {{workspace}}"
  }
]
```

---

## 2. Lệnh CLI Sử dụng Ngay trên Máy

```powershell
# 1. Kiểm tra trạng thái các Lõi AI trên máy
node D:\BotAutoTask\src\daemon\cli.js cores

# 2. Quét & xếp hạng các Model Miễn Phí tốt nhất hiện có
node D:\BotAutoTask\src\daemon\cli.js models

# 3. Giao mục tiêu và chạy ngay (tự động đổi lõi/model nếu dính limit)
node D:\BotAutoTask\src\daemon\cli.js run "Viết unit test cho module X" --path "D:\my-project" --check "npm test"

# 4. Đưa mục tiêu vào hàng đợi bền vững (chờ có mạng / bật máy tự chạy)
node D:\BotAutoTask\src\daemon\cli.js submit "Tối ưu hóa hiệu năng hàm Y" --path "D:\my-project"
```

---

## 3. Cài đặt Tự Chạy Khi Có Mạng & Đánh Thức Máy (Windows Task Scheduler)

Chạy lệnh PowerShell sau (Run as Administrator nếu dùng cờ đánh thức phần cứng `WakeToRun`):

```powershell
powershell -ExecutionPolicy Bypass -File "D:\BotAutoTask\scripts\register-windows-task.ps1"
```

---

## 4. Triển khai Lõi Cloud 24/7 Miễn Phí (Cloudflare Workers + D1 + Telegram Bot)

Khi triển khai `cloud-core/`, bạn có thể nhắn `/goal`, `/status`, `/switch`, `/mode` từ điện thoại qua Telegram **ngay cả khi PC đã tắt nguồn hoàn toàn**:

```powershell
cd D:\BotAutoTask\cloud-core
npx wrangler d1 create botautotask-db
# Copy database_id dán vào cloud-core/wrangler.toml
npx wrangler d1 execute botautotask-db --file=./schema.sql --remote
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_ALLOWED_CHAT_ID
npx wrangler secret put BOTAUTOTASK_API_TOKEN
npx wrangler secret put GITHUB_PAT
npx wrangler deploy
```
