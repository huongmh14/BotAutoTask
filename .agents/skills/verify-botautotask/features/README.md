# Bản đồ Tính năng Kiểm chứng — Verify BotAutoTask (`features/README.md`)

> Cập nhật: 2026-10-20 · Base: `writing-spec-for-ai v1.3.0` (`C18`, `C19`, `C29`)

## 1. Luồng Giao diện Web UI & Đội ngũ Đồng sự (`SPEC-UI`, `SPEC-SAFE`)
- **Các hành vi con (`AC-ID`):** `[UI-AC01]`, `[UI-AC02]`, `[UI-AC03]`, `[UI-AC04]`, `[SAFE-AC05]`
- **Cách đi tới luồng:** Mở `http://127.0.0.1:8765` trên trình duyệt (hoặc chạy `botautotask ui --open`).
- **Cách điều khiển bằng harness:** Dùng `playwright-core` mở `http://127.0.0.1:8765`, kiểm tra `pageerror === 0`, `#sseText === 'LIVE'`, `#coworkerRoster` có 3 thành viên (`@lead`, `@coder`, `@reviewer`), bấm `Ctrl+K` mở `#cmdkModal`, chụp ảnh màn hình lưu vào `.botautotask/evidence/ui-verified.png`.
- **Gotchas (`C18` — 2026-10-20):** Phải escape `\\n`, `\\r`, `\\s` trong template literal `src/ui/dashboard-html.js` và nhúng `defaultToken` để mở trực tiếp `http://127.0.0.1:8765` không cần `#k=` vẫn tải được `/api/state`.

## 2. Luồng Phê duyệt & Gộp Nhánh Git Worktree (`SPEC-MESH`, `SPEC-SAFE`)
- **Các hành vi con (`AC-ID`):** `[MESH-AC01]`, `[SAFE-AC01]`, `[SAFE-AC03]`, `[SEC-AC04]`
- **Cách đi tới luồng:** Bấm nút `Xem diff & Gộp` trên thanh tiêu đề hoặc duyệt thẻ Approval trong luồng chat.
- **Cách điều khiển bằng harness:** Gọi `GET /api/agents/coder/diff` và `POST /api/approvals/:id` kèm `hash` SHA-256; kiểm tra trạng thái chuyển sang `succeeded`/`denied`.
- **Gotchas (`C18` — 2026-10-20):** Trên Windows, tắt `core.autocrlf = false` trong repo test tạm để tránh cảnh báo CRLF làm nhiễu git diff.

## 3. Luồng Điều phối Đa Lõi & Chống Tự Khen Hoàn thành (`SPEC-CORE`, `SPEC-H2`, `SPEC-SAFE`)
- **Các hành vi con (`AC-ID`):** `[CORE-AC01]`, `[CORE-AC03]`, `[CORE-AC04]`, `[H2-AC03]`, `[SAFE-AC02]`
- **Cách đi tới luồng:** Chạy `botautotask run "<goal>" --check "<cmd>"` hoặc gửi tin nhắn trong kênh `Nhóm WhaleBot`.
- **Cách điều khiển bằng harness:** Chạy `node --test tests/orchestrator.test.js` và kiểm tra file bài học `.md` sinh ra trong `.botautotask/library/general/`.
- **Gotchas (`C18` — 2026-10-20):** Nếu `acceptance_cmd` rỗng, trạng thái bắt buộc là `COMPLETED_UNVERIFIED` (`SPEC-SAFE-R03`), không được tự ghi vào Experience Library.

## 4. Luồng Cloud-Core 24/7 & Tự động Triển khai Cloudflare (`SPEC-CLOUD`, `SPEC-PROVISION`)
- **Các hành vi con (`AC-ID`):** `[CLOUD-AC01]`, `[CLOUD-AC02]`, `[PROV-AC01]`, `[PROV-AC02]`
- **Cách đi tới luồng:** Chạy `npm run cloud:setup:dry` (kiểm thử khô) hoặc `npm run cloud:setup` (triển khai thật lên Cloudflare Workers + D1).
- **Cách điều khiển bằng harness:** Chạy `node --test tests/lease-cas.test.js tests/cloud-provision.test.js`.
- **Gotchas (`C18` — 2026-10-20):** Trên Windows phải gọi `npx.cmd wrangler` thay vì `npx` để tương thích `execFileSync(..., { shell: false })`.
