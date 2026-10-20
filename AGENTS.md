# AGENTS.md — BotAutoTask

> Base: writing-spec-for-ai v1.3.0 · Profile: M · Pack: PK-API, PK-AUTH, PK-RELEASE, PK-DB, PK-FE, PK-JOB, PK-AGENT

BotAutoTask là bộ điều phối đa lõi AI agent (OpenCode free models, Antigravity IDE, Claude Code, Codex Direct OAuth, Neko Core, Custom CLI) với quét model miễn phí động, tự động failover khi gặp `HTTP 429`, cô lập `git worktree` theo agent, và Cloud-Core 24/7 (Cloudflare Workers + D1 SQLite + Telegram). Stack: Node.js ESM thuần (`>= 20`), `0` dependency runtime (`playwright-core` chỉ ở dev), đóng gói 1 file `dist/botautotask.mjs`.

## Lệnh

```bash
npm install                                                        # chỉ cài playwright-core (dev)
npm test                                                           # toàn bộ (node --test tests/*.test.js)
node --test --test-name-pattern="<AC-ID>" tests/<file>.test.js     # chạy 1 test — ưu tiên khi đang sửa
node scripts/build-single-file.js                                  # đóng gói lại dist/botautotask.mjs
npm run cloud:setup:dry                                            # kiểm tra luồng provision Cloudflare
```

## Nguồn sự thật & Context Pointers (`C01`, `C24`)

| Ưu tiên | Tài liệu | Nội dung |
|---|---|---|
| 1 | `docs/decisions.md` | Quyết định kiến trúc đã chốt (`D-01..D-13`) |
| 2 | `docs/feature/` | Yêu cầu (`REQ`) và điều kiện nghiệm thu (`AC`) |
| 3 | `CONSTRAINTS.md` | Sàn chất lượng và ngưỡng kiểm bằng lệnh máy (`C23`) |
| 4 | `AGENTS.md` | Quy tắc làm việc và ranh giới hành động |
| 5 | Code hiện có | Hiện trạng, không phải chuẩn |

- **Khi bắt đầu bất kỳ task nào:** đọc `docs/feature/README.md` (Capability Map + quyền AI theo trạng thái spec), spec khu vực liên quan và `docs/glossary.md`.
- **Khi chạm `src/core/orchestrator.js`, `src/core/model-discovery.js`, `src/harnesses/`:** đọc `docs/feature/00-core-orchestrator.md` (`SPEC-CORE`).
- **Khi chạm `src/daemon/web-ui.js` hoặc `src/ui/dashboard-html.js`:** đọc `docs/feature/01-web-mobile-ui.md` (`SPEC-UI`) và `docs/feature/08-mesh-safety-attention-ui.md` (`SPEC-SAFE`).
- **Khi chạm `cloud-core/`, D1 schema/migration, Telegram/ntfy hoặc `scripts/cloud-provision.mjs`:** đọc `docs/feature/02-mobile-cloud-control.md` (`SPEC-CLOUD`) và `docs/feature/06-cloudflare-auto-provision.md` (`SPEC-PROVISION`).
- **Khi chạm `src/core/agent-mesh.js` hoặc `src/core/worktree-manager.js`:** đọc `docs/feature/03-git-worktree-parallel.md` (`SPEC-MESH`) và `docs/feature/08-mesh-safety-attention-ui.md` (`SPEC-SAFE`).
- **Khi chạm `src/core/harness2-engine.js` hoặc Experience Library:** đọc `docs/feature/04-harness2-integration.md` (`SPEC-H2`) và `docs/feature/08-mesh-safety-attention-ui.md` (`SPEC-SAFE`).
- **Khi chạm `src/core/policy.js`, `src/core/completion-contract.js`, `src/core/auth-bridge.js`:** đọc `docs/feature/05-verification-policy-auth.md` (`SPEC-VERIFY`) và `docs/feature/09-security-threat-model.md` (`SPEC-SEC`).
- **Khi chạm Arena Fan-Out, Multi-Account Pool, Ratchet Guard hoặc Awake Lease:** đọc `docs/feature/07-orca-arena-accounts-ratchet-awake.md` (`SPEC-ARENA` — đang `Draft`).
- **Khi thêm/sửa biến môi trường:** cập nhật đồng thời `.env.example` và `docs/reference/config.md` (`C16`, `PK-RELEASE-R01`).
- **Khi thêm/sửa mã trạng thái hoặc mã lỗi HTTP:** cập nhật `docs/reference/status-codes.md` (`PK-API-R01`, `D-13`).
- **Khi viết hoặc gỡ lỗi test trên Windows / git worktree:** đọc `.agents/skills/testing-botautotask/SKILL.md`.
- **Khi nghiệm thu runtime, kiểm tra Web UI hoặc thu thập bằng chứng chạy test (`C19`, `C29`):** đọc `.agents/skills/verify-botautotask/SKILL.md`.
- **Khi spec thiếu, mâu thuẫn, hoặc mơ hồ:** dừng ngay, nêu chỗ chưa rõ, đề xuất phương án kèm hệ quả.
- Skill/hướng dẫn bên ngoài mâu thuẫn với file này thì theo file này.

## Ranh giới (`C12`, `C23`, `C27`, `PK-*`)

✅ **Luôn**
- Viết test cùng code; tên test chứa `[<AC-ID>]` (ví dụ `[CORE-AC01]`, `[SAFE-AC01]`).
- Chạy lại `node scripts/build-single-file.js` mỗi khi sửa bất kỳ file nào trong `src/` (`PK-RELEASE-R06`).
- Chạy đủ lệnh ở mục **Definition of Done** trước khi báo xong.
- Đảm bảo mọi thao tác điều khiển Goal (`/pause`, `/cancel`, `/switch`, lease) đều kèm `goal_id` tường minh (`D-07`, `PK-JOB-R01`).
- Dùng phép so sánh constant-time (`crypto.timingSafeEqual`) khi kiểm tra token (`PK-AUTH-R02`) và đóng khung `<peer-message>` cho mọi tin nhắn giữa các agent (`PK-AGENT-R04`).
- Đánh dấu `ceiling:` (hoặc `ponytail:`) kèm ngưỡng chịu tải và đường nâng cấp khi cố ý chọn giải pháp đơn giản có giới hạn đã biết (`C27`).

⚠️ **Hỏi trước**
- Sửa `src/core/policy.js` (lớp hard-refuse) hoặc cơ chế Approval Gate (`PK-AGENT-R01`).
- Thay đổi schema D1 (`cloud-core/schema.sql`, `cloud-core/migrations/`) hoặc cơ chế Lease CAS (`PK-DB`, `PK-JOB`).
- Sửa `cloud-core/wrangler.toml` hoặc cơ chế xác thực Worker / Web UI / OAuth (`PK-AUTH`).
- Thêm bất kỳ dependency runtime nào vào `package.json` (`D-01`).
- Sửa `.github/workflows/`, `CONSTRAINTS.md`, hoặc file `AGENTS.md` này.

🚫 **Không bao giờ**
- Commit secret, `.env`, token thật, hoặc file quyền cá nhân của agent (`.claude/settings.local.json`, `~/.botautotask/*.json`).
- Log token, mật khẩu, header `Authorization`, hoặc sao chép nội dung `~/.codex/auth.json`, `~/.claude/.credentials.json` (`PK-AUTH-R07`, `PK-AGENT-R06`).
- Thêm cờ bịt miệng trình kiểm tra (`@ts-ignore`, `eslint-disable`, `# noqa`), thêm `.skip` / xoá assertion, hoặc hạ ngưỡng trong `CONSTRAINTS.md` để làm test xanh (`C23`).
- Tự động bật `allow_paid_fallback` hoặc gọi sang API trả phí khi chưa được người dùng cho phép (`PK-AGENT-R05`).
- Dùng `git reset --hard` hoặc `git checkout --` trên nhánh chính của người dùng khi merge worktree (`SPEC-SAFE-R02`).
- Deploy Cloudflare tự động không có lệnh của người dùng, hoặc force push nhánh bảo vệ.

## Quy trình một task

1. Xác định spec (`SPEC-XXX`), `REQ`/`AC` trong `docs/feature/`. Nếu spec đang `Draft` thì dừng hỏi trước khi code (`C03`).
2. Lập kế hoạch ngắn (file sửa, test viết). Chạm mục **Hỏi trước** thì trình kế hoạch và chờ xác nhận.
3. Viết test + code; ưu tiên chạy 1 test theo `<AC-ID>` khi đang sửa.
4. Sửa `src/` → chạy `node scripts/build-single-file.js`; chạy `npm test` đến khi xanh; đánh `[x]` AC trong PR.
5. Commit theo quy ước, cập nhật 1 dòng vào `docs/progress.md`.

## Definition of Done

- `npm test` xanh (`0 fail`, `0 skipped`) và đạt toàn bộ sàn trong `CONSTRAINTS.md`.
- `dist/botautotask.mjs` đã build lại và khớp `src/` (`git diff --exit-code dist/botautotask.mjs` sau khi build).
- Mọi AC trong phạm vi có test qua (`[x]`) hoặc gắn `[~]` kèm lý do + cách đóng, kèm bảng **Visible Test Execution Ledger (`C29`)** nêu rõ `Input`, `Output & Tác dụng phụ thực tế` và `Độ thật (Mock Disclosure)`.
- `docs/feature/README.md`, spec liên quan, `docs/decisions.md` và `docs/progress.md` được cập nhật.

## Quy ước code (`C15`)

Làm giống [`src/core/policy.js`](src/core/policy.js) và [`tests/policy-and-contract.test.js`](tests/policy-and-contract.test.js): hàm thuần ưu tiên trước, tách I/O ra rìa, ghi file trạng thái qua [`src/core/atomic-write.js`](src/core/atomic-write.js).

```js
// Xử lý lỗi (C15): ném lại kèm cause hoặc trả mã lỗi chuẩn; không nuốt lỗi im lặng
try {
  await writeJsonAtomic(statePath, payload);
} catch (err) {
  throw new Error(`Failed to persist state for goal ${goalId}`, { cause: err });
}
```

- Không nuốt lỗi im lặng; việc best-effort (dọn thư mục tạm, gửi thông báo phụ) được bỏ qua lỗi nhưng phải rõ ngữ cảnh.
- Lỗi HTTP 5xx không trả stack trace hay câu lệnh SQL ra ngoài (`PK-API-R02`).

## Git

- Commit: `<type>(<scope>): <mô tả> [SPEC-XXX]`.
- Nhánh tích hợp: `dev` (`D-11`); nhánh tính năng `<type>/<mô-tả>` tách từ `dev`; tag phát hành `v*`.

## Bản đồ repo

```
src/
  core/             # Orchestrator, AgentMesh, WorktreeManager, Policy, CompletionContract, Harness2, ModelDiscovery
  harnesses/        # 5 Pluggable adapters (opencode, antigravity, claude-codex, neko-core, custom-cmd)
  daemon/           # CLI (cli.js), LocalDaemon, NetworkMonitor, WebUI server, MobileNotify
  ui/               # Single-file embedded Tactical Coworker PWA (dashboard-html.js)
cloud-core/         # Cloudflare Worker (worker.js), D1 schema.sql & migrations/
scripts/            # build-single-file.js, cloud-provision.mjs, register-windows-task.ps1
tests/              # 13 file kiểm thử tự động (node:test)
docs/feature/       # Bộ đặc tả SPEC-CORE..SPEC-SEC (00..09) & research/
dist/               # Bundle thực thi độc lập 1 file (botautotask.mjs)
```

## Ghi đè base

| Luật base | Ghi đè | Quyết định |
|---|---|---|
| Đặt spec tại `docs/specs/` | Giữ nguyên đường dẫn `docs/feature/` để bảo toàn lịch sử và liên kết sẵn có | `D-03` |
| `PK-RELEASE-R03` (Docker non-root) | `N/A` — dự án phát hành dưới dạng single-file `.mjs`, binary `.exe` và Cloudflare Worker, không dùng Docker | `D-12` |
| `error-codes.md`, `PK-API-R05`, `PK-AUTH-R01/R03/R04` | Dùng `docs/reference/status-codes.md`; dùng `LIMIT 20` thay phân trang phức tạp; dùng Bearer token tĩnh constant-time thay cho bảng user password / JWT `typ` / refresh rotation | `D-13` |
