# Progress — BotAutoTask

> Cập nhật: 2026-10-20

## Lịch sử phiên

- **2026-10-20 (Giai đoạn 3 — Chuẩn hoá bộ tài liệu AI theo Base `writing-spec-for-ai v1.2.1` & vượt qua Cổng 2 + Cổng 3):**
  - Tạo mới và chuẩn hoá: [`AGENTS.md`](../AGENTS.md) (124 dòng), [`CLAUDE.md`](../CLAUDE.md), [`CONSTRAINTS.md`](../CONSTRAINTS.md), [`.env.example`](../.env.example) (20 biến), [`docs/decisions.md`](decisions.md) (`D-01..D-13`), [`docs/glossary.md`](glossary.md) (17 thuật ngữ), [`docs/reference/config.md`](reference/config.md), [`docs/reference/status-codes.md`](reference/status-codes.md), [`docs/changelog/v1.0.0.md`](changelog/v1.0.0.md), [`.agents/skills/testing-botautotask/SKILL.md`](../.agents/skills/testing-botautotask/SKILL.md) và [`.github/workflows/test.yml`](../.github/workflows/test.yml).
  - Ánh xạ 1-1 toàn bộ 10 đặc tả trong [`docs/feature/README.md`](feature/README.md) (`SPEC-CORE`, `SPEC-UI`, `SPEC-CLOUD`, `SPEC-MESH`, `SPEC-H2`, `SPEC-VERIFY`, `SPEC-PROVISION`, `SPEC-ARENA`, `SPEC-SAFE`, `SPEC-SEC`) kèm Capability Map, REQ EARS, NFR 8 dòng, kế thừa 7 Pack, AC Cho/Khi/Thì và gắn thẻ `[<AC-ID>]` vào toàn bộ `38/38` bài test tự động (`tests/*.test.js`).
- **2026-10-20 (`SPEC-SAFE` / Spec 08):** Hoàn tất sửa 3 lỗi nền tảng (`SSE ?k=`, `MAIN_DIRTY_COLLISION`, `COMPLETED_UNVERIFIED`), đóng khung `<peer-message>`, cửa sổ trượt Loop Guard 10 phút, Approval Gate, Diff Review Modal và Attention UI (`38/38` tests pass).
