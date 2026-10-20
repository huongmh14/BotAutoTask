@AGENTS.md

<!-- Claude Code không đọc AGENTS.md mặc định nên cần dòng import trên. @import nạp nguyên văn. Kiểm bằng /context. -->

## Riêng cho Claude Code

- Dùng **plan mode** khi chạm các vùng nhạy cảm: `src/core/policy.js`, `src/core/agent-mesh.js`, `src/core/worktree-manager.js`, `cloud-core/`.
- Khi compact (`/compact`): giữ danh sách file đã sửa, lệnh test đang dùng (`node --test tests/<file>.test.js`), và mã `SPEC-XXX / AC-ID` đang làm.
- Kết thúc phiên dài: cập nhật `docs/progress.md` và chạy `node scripts/build-single-file.js && npm test`.
