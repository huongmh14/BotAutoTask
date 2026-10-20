# BotAutoTask — hướng dẫn cho agent

Bộ điều phối AI-agent đa lõi, **zero-dependency** (chỉ dùng `node:` built-ins; devDependency duy nhất là playwright-core cho test). Yêu cầu Node ≥ 20. Xem `README.md` cho kiến trúc chi tiết và `docs/superpowers/specs/` cho design spec.

## Lệnh chính

```bash
node --test tests/*.test.js        # toàn bộ test (node:test, không cần cài gì)
node src/daemon/cli.js ui          # Web UI dashboard (mặc định :8765, tự nhảy port khi bận)
node src/daemon/cli.js cores       # trạng thái các lõi AI
node src/daemon/cli.js models      # xếp hạng model free
node scripts/build-single-file.js  # đóng gói dist/botautotask.mjs
```

## Ràng buộc quan trọng

- **Sau khi sửa bất kỳ file nào trong `src/`, phải chạy lại `node scripts/build-single-file.js`** rồi commit kèm `dist/botautotask.mjs` — bundle là artifact được ship. `MODULE_ORDER` trong build script phải chứa **toàn bộ closure import** theo đúng thứ tự phụ thuộc (học từ lỗi từng quên `web-ui`, `dashboard-html`, `worktree-manager`, `atomic-write`, `mobile-notify` khiến lệnh `ui` chết trong dist).
- **`src/ui/dashboard-html.js` là MỘT template literal bao toàn bộ trang**: mọi backtick và `${` của JS phía trình duyệt phải escape thành `` \` `` và `\${`. Backtick đóng ở cuối file phải là backtick thô. Test `web-ui.test.js` bắt buộc chuỗi `BotAutoTask — Tactical Coworker Mesh` và `#mesh-command-room` phải xuất hiện trong HTML — đừng đổi tên này nếu không sửa cả test.
- **Test `worktree-manager` "not a git repo" fail trên máy có git repo ở thư mục home** (thư mục `Temp` bị coi là inside-work-tree). Lỗi môi trường, không sửa code để vòng qua.
- Web UI dùng token trong fragment `#k=` (server sinh ngẫu nhiên mỗi lần chạy, strip khỏi address bar ngay khi load). API đều yêu cầu `Authorization: Bearer` hoặc `?token=`, và chặn Origin/host khác localhost.
- UI/UX theo phong cách **GrokBot**: đen trắng tối giản (#000), chat-first, system font, không request ngoài (không Google Fonts). Xem PR #1 để hiểu pattern.
- Commit theo **conventional commits** (`feat(scope):`, `fix(scope):`, `style(scope):`...).

## Bản đồ thư mục

| Đường dẫn | Vai trò |
|---|---|
| `src/ui/dashboard-html.js` | Toàn bộ Web UI (HTML/CSS/JS embed, ~1.100 dòng) |
| `src/daemon/web-ui.js` | HTTP + SSE server của dashboard, auth, nonce idempotent |
| `src/core/core-stats.js` | Thống kê usage theo lõi (runs/429/done) persist `~/.botautotask/core-stats.json` — nourish panel CORES & LIMITS trong telemetry rail |
| `src/core/agent-mesh.js` | AgentMesh đa agent + 3 chế độ giao tin send/interrupt/queue |
| `src/core/worktree-manager.js` | Git worktree isolate cho từng agent writer |
| `src/harnesses/` | Adapter các lõi AI (opencode, antigravity, claude, codex, neko-core, custom-cmd) |
| `scripts/build-single-file.js` | Bundler thành file đơn `dist/botautotask.mjs` |
| `cloud-core/` | Cloudflare Worker + D1 (chưa deploy trên máy này) |
