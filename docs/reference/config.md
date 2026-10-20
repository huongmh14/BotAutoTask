# Biến môi trường & Cấu hình — BotAutoTask

> Nguồn sự thật duy nhất về cấu hình (`C16`, `PK-RELEASE-R01`). Mọi khoá biến môi trường phải có mặt trong [`.env.example`](../../.env.example) (không có giá trị thật). Tuyệt đối không commit `.env` hoặc `~/.botautotask/*.json`.

## 1. Biến môi trường Runtime, CI & Provisioning

| Biến | Bắt buộc | Mặc định | Mô tả | Nhạy cảm | Nơi đọc trong code |
|---|---|---|---|---|---|
| `BOTAUTOTASK_UI_TOKEN` | Không | ngẫu nhiên 24 ký tự hex | Token phiên xác thực cho Local Web UI (`127.0.0.1`) | Có | `src/daemon/web-ui.js` |
| `BOTAUTOTASK_CLOUD_URL` | Không | `config.cloud.url` hoặc rỗng | URL của Cloudflare Worker (`https://*.workers.dev`) | Không | `src/daemon/local-daemon.js`, `.github/workflows/botautotask-worker.yml` |
| `BOTAUTOTASK_API_TOKEN` | Có (khi bật Cloud) | `config.cloud.apiToken` | Bearer token xác thực giữa Local Daemon / GitHub Actions và Cloud Worker | Có | `src/daemon/local-daemon.js`, `cloud-core/worker.js` |
| `OPENCODE_ATTACH_URL` | Không | rỗng | URL attach vào OpenCode server đang chạy sẵn | Không | `src/harnesses/opencode-harness.js` |
| `OPENCODE_CONFIG_CONTENT` | Không | `FAST_OPENCODE_CONFIG` | Chuỗi JSON cấu hình nhanh cho OpenCode CLI | Không | `src/harnesses/opencode-harness.js` |
| `CODEX_HOME` | Không | `~/.codex` | Thư mục chứa `auth.json` của Codex CLI (hỗ trợ cô lập Multi-Account Pool) | Không | `src/core/auth-bridge.js`, `SPEC-ARENA` |
| `CLAUDE_CONFIG_DIR` | Không | `~/.claude` | Thư mục cấu hình của Claude Code CLI (hỗ trợ cô lập Multi-Account Pool) | Không | `SPEC-ARENA` (`07-orca-arena-accounts-ratchet-awake.md`) |
| `OPENAI_API_KEY` | Không | rỗng | API key dự phòng cho Codex CLI (chỉ dùng khi người dùng cấu hình tường minh) | Có | `src/core/auth-bridge.js` |
| `ANTHROPIC_API_KEY` | Không | rỗng | API key dự phòng cho Claude Code CLI | Có | `src/core/auth-bridge.js` |
| `GEMINI_API_KEY` | Không | rỗng | API key tuỳ chọn cho GitHub Actions Cloud Worker khi gọi model Gemini | Có | `.github/workflows/botautotask-worker.yml` |
| `OPENROUTER_API_KEY` | Không | rỗng | API key tuỳ chọn cho GitHub Actions Cloud Worker khi gọi model miễn phí OpenRouter | Có | `.github/workflows/botautotask-worker.yml` |
| `NTFY_SERVER` | Không | `https://ntfy.sh` | Máy chủ đẩy thông báo `ntfy` về điện thoại | Không | `src/daemon/mobile-notify.js` |
| `NTFY_TOPIC` | Không | `config.ntfy.topic` | Tên topic bí mật (khuyến nghị ngẫu nhiên ≥ 128-bit) để nhận thông báo mobile | Có | `src/daemon/mobile-notify.js`, `scripts/cloud-provision.mjs` |
| `NTFY_TOKEN` | Không | `config.ntfy.token` | Bearer token xác thực cho máy chủ `ntfy` riêng | Có | `src/daemon/mobile-notify.js` |
| `DISCORD_WEBHOOK_URL` | Không | rỗng | URL Discord Webhook tuỳ chọn khi đồng bộ secret lên Cloudflare Worker | Có | `scripts/cloud-provision.mjs` |
| `CLOUDFLARE_API_TOKEN` | Không | OAuth qua trình duyệt | Token Cloudflare dùng cho CI/headless khi chạy `npm run cloud:setup` | Có | `scripts/cloud-provision.mjs` |
| `TELEGRAM_BOT_TOKEN` | Không | rỗng | Token bot từ `@BotFather` (đặt qua `wrangler secret put` hoặc khi chạy `cloud:setup`) | Có | `cloud-core/worker.js`, `scripts/cloud-provision.mjs` |
| `TELEGRAM_ALLOWED_CHAT_ID` | Không | rỗng | Chat ID Telegram duy nhất được phép điều khiển bot | Có | `cloud-core/worker.js`, `scripts/cloud-provision.mjs` |
| `GITHUB_PAT` | Không | rỗng | Personal Access Token để Cloud Worker kích hoạt `workflow_dispatch` khi PC tắt | Có | `cloud-core/worker.js`, `scripts/cloud-provision.mjs` |
| `GITHUB_WORKFLOW_FILE` | Không | `botautotask-worker.yml` | Tên file workflow GitHub Actions chạy Cloud Worker | Không | `cloud-core/worker.js` |

## 2. File cấu hình Local (`~/.botautotask/config.json`)

Lưu ở thư mục người dùng, ghi nguyên tử qua [`src/core/atomic-write.js`](../../src/core/atomic-write.js), mẫu mặc định tại [`config/default-config.json`](../../config/default-config.json):

```json
{
  "harnesses": {
    "opencode": { "enabled": true },
    "antigravity": { "enabled": true },
    "claude-codex": { "enabled": true },
    "neko-core": { "enabled": true }
  },
  "customHarnesses": [],
  "cooldownMs": 1800000,
  "priorityModels": [
    "deepseek*v4*flash*free",
    "gpt-luna*",
    "opencode/*free*",
    "google/gemini-2.5-pro*",
    "google/gemini-2.5-flash*",
    "qwen*coder*free"
  ],
  "cloud": {
    "url": "",
    "apiToken": "",
    "d1DatabaseId": ""
  },
  "ntfy": {
    "server": "https://ntfy.sh",
    "topic": "",
    "token": ""
  }
}
```

## 3. Cấu hình Cloudflare Worker (`cloud-core/wrangler.toml`)

- [`cloud-core/wrangler.toml`](../../cloud-core/wrangler.toml) chỉ giữ `database_id` dạng placeholder để commit an toàn.
- Khi chạy `npm run cloud:setup`, script sinh `cloud-core/wrangler.generated.toml` (đã nằm trong `.gitignore`) với UUID thật sau khi kiểm tra định dạng UUID (`SPEC-PROVISION`).
- Worker kiểm tra `BOTAUTOTASK_API_TOKEN` theo nguyên tắc **fail-closed** (`PK-AUTH-R06`): nếu biến chưa được cấu hình trên Worker thì mọi request `/api/*` đều bị từ chối với HTTP `401`.
