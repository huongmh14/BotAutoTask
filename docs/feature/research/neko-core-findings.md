# Research: Neko Core → pattern áp dụng cho BotAutoTask

> Nguồn: mã nguồn local `D:\Workspace\StartUp\neko_core` (AGPL-3.0). **Chỉ học thiết kế, không chép code.**
> Đường dẫn Neko tính từ gốc repo Neko. Ngày khảo sát: 2026-10-19.

**Lưu ý:** `REQ-PB-006 / coworkers` **không tồn tại** trong repo Neko (chỉ có `coworkerName` ở `src/adapters/acp-computer.ts:420`). Multi-bot của Neko = relay *hub* nhiều host + session handoff + subagent `task`. Tài liệu Neko ghi rõ handoff **không** phải nhắn tin giữa agent (`docs/process/ARCHITECTURE.md:232-233`).

## 1. Remote relay qua Cloudflare (`cloudflare/relay/worker.js`, `src/adapters/remote-relay.ts`, `relay-crypto.ts`)
- Host **dial-out** WebSocket tới Worker, điện thoại POST lệnh; Worker là blind forwarder. Một Durable Object / capability, route `env.RELAY.idFromName(session)` (`worker.js:74-77`), session regex `^[A-Za-z0-9._~-]{1,128}$` (`:53`).
- WS hibernation: token ở subprotocol `t.<token>` (không ở URL) (`:256-275`); `ctx.acceptWebSocket(ws,["host","host:<id>"])` + `serializeAttachment`; reconnect đóng socket cũ; xả hàng đợi offline khi host nối lại (`:274`, `:524-533`); `getWebSockets(tag)` là nguồn sự thật online.
- Endpoint: `/register` (first token wins, lưu `kid`), `/client-ws` (mirror replay → `mirror_ready{seq}`), `/revoke` (đóng socket + `deleteAll`), `/control` (approval, **không xếp hàng**, offline → 409), `/alive`, `/sessions`, `/send` (queue bền tối đa 100 → 429), `/interrupt`, `/result?id&seen` (long-poll 25s theo `seq`), `/pull`,`/reply` (v1), `/healthz`.
- Giới hạn: body ≤ 1.05MB đọc stream; frame lớn → close 1009; ≤ 32 host; mirror ≤ 400 event/1.5MB (DO SQLite value ≤ 2MB); token so sánh SHA-256 + timingSafeEqual (`:160-174`).
- E2E: AES-256-GCM, key = PBKDF2-SHA256(secret, salt cố định, 100k vòng); secret trong URL fragment `#t=&k=` (không gửi lên server), client `history.replaceState` xoá hash; **strict mode** từ chối plaintext sau khi ghép cặp; `kid` = 8 hex đầu sha256(secret).
- Pairing: 128-bit CSPRNG, mỗi conversation một capability; rotate = revoke cũ trước rồi lưu mới.
- Host: FIFO 1 job; partial throttle 600ms; outbox 200 frame; backoff mũ ≤30s, 3 lần fail → long-poll; 401 → dừng.
- Wrangler: `[[durable_objects.bindings]]` + `[[migrations]] new_sqlite_classes` (SQLite DO chạy free plan).
- Test không cần miniflare: double `MemoryStorage` + `SocketDouble` (`test/relay-worker.test.ts:6-34`).

## 2. Handoff & durable session
- `session-handoff.ts`: schema khoá cố định, summary ≤16KiB, envelope ≤64KiB, provenance `local-unverified`; ghi bất biến `wx` + `linkSync`; đọc có kiểm tra dev/ino/mtime; **chưa có ack** (exactly-once để ngỏ).
- Session: ghi atomic temp→rename + `.bak`; `turnState{idle|running|interrupted, activeToolCallIds}`; lockfile `O_EXCL`+pid, thu hồi lock pid chết.
- Resume: `sealDanglingToolCalls()` ghi "outcome unknown — inspect actual state before retry"; không bao giờ replay mutation mù.

## 3. Closed-loop verification
- Completion contract: tiêu chí ID ổn định, chỉ được **thêm**; verdict pass khi mọi tiêu chí pass **và** coverage đủ; giới hạn 32 tiêu chí.
- Independent validator: provider mới, tool chỉ đọc + bash foreground; receipt SHA-256; implementer chỉ thấy gap mức outcome.
- Verification debt: `mutationEpoch` — kết quả validate chỉ tính khi cùng epoch.
- Loop guard: cùng call 3 lần → chặn; sửa cùng path 6 lần → nhắc. No-progress: chữ ký gap lặp lại → dừng. Chạm max_steps ≠ xong.

## 4. Permission & governance
- Mode `default|accept-edits|plan|auto`, `--yolo` cờ riêng chỉ hiệu lực trong auto.
- `destructiveInWorkspace()` (rm -rf, reset --hard, push --force, curl|sh...) hỏi một lần kể cả auto; `dangerousCommand()` hard-refuse mọi mode (rm -rf /, mkfs, format C:...); đường dẫn credential bị từ chối; optimistic concurrency khi file bị sửa từ ngoài.
- Approval từ xa `{type:"approval",id,decision}` qua `/control`, id hết hạn → false.

## 5. Provider route
- Profile = family + auth (`api_key|chatgpt_oauth|grok_oauth|...`), nhãn billing rõ; **không import credential của CLI khác, không âm thầm fallback** giữa subscription và API trả tiền.

## 6. Worktree / song song
- Neko **không có git worktree**; subagent ghi chạy tuần tự. Song song chỉ cho tool/agent chỉ đọc. → BotAutoTask làm tốt hơn bằng worktree per writer.

## 7. Deploy Cloudflare
- `DEPLOY.md`: `CLOUDFLARE_API_TOKEN` (template Edit Workers) hoặc `wrangler login`, `wrangler deploy`, smoke `/healthz`, `/alive` không auth → 401; cấm log body.
- Feedback D1: `migrations_dir`, `[[ratelimits]]`, `INSERT OR IGNORE` + digest idempotent, cron dọn dữ liệu, CI `wrangler deploy --dry-run`.

## Bugs phát hiện trong BotAutoTask nhờ đối chiếu
| # | Vấn đề | Vị trí | Trạng thái |
|---|---|---|---|
| 1 | Auth API **fail-open** khi thiếu `BOTAUTOTASK_API_TOKEN`, so sánh `!==` không constant-time | `cloud-core/worker.js` | ✅ Đã sửa (`isAuthorized`, test `tests/worker-auth.test.js`) |
| 2 | Lease SELECT-rồi-UPDATE → 2 worker cùng nhận goal; `/api/lease/step` không kiểm owner/epoch | `cloud-core/worker.js` | Spec 02 (CAS + `lease_epoch`) |
| 3 | Không có `acceptance_cmd` ⇒ tự coi là pass | `src/core/orchestrator.js` | Spec 05 (completion contract) |
| 4 | `_persistState` ghi không atomic; handoff không validate | `src/core/agent-mesh.js` | Spec 03 |
| 5 | `/pause` `/cancel` `/switch` UPDATE mọi goal đang chạy | `cloud-core/worker.js` | Spec 02 |
| 6 | Webhook Telegram chỉ kiểm chat_id, không secret header, không rate limit | `cloud-core/worker.js` | Spec 02 |
