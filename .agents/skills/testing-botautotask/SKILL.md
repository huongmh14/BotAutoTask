---
name: testing-botautotask
description: Kích hoạt khi viết test mới, chạy bộ kiểm thử node:test, hoặc gỡ lỗi test thất bại liên quan tới Windows CLI spawn (.cmd/.exe), git worktree, port binding, hoặc D1 Lease CAS trong repo BotAutoTask.
---

# Testing BotAutoTask — Kỹ năng kiểm thử & Gotchas thực chiến

Mục tiêu: chạy test nhanh, cô lập hoàn toàn khỏi mạng và cấu hình thật của máy cá nhân, không để lại tiến trình con hay thư mục tạm.

## 1. Lệnh chạy kiểm thử

```powershell
# Chạy 1 test cụ thể theo tên hoặc AC-ID (ưu tiên số 1 khi đang sửa code):
node --test --test-name-pattern="SAFE-AC01" tests/worktree-manager.test.js

# Chạy 1 file test:
node --test tests/policy-and-contract.test.js

# Chạy toàn bộ 13 file test (~4.5s):
npm test

# Đóng gói và kiểm tra đồng bộ dist/botautotask.mjs (PK-RELEASE-R06):
node scripts/build-single-file.js
git diff --exit-code dist/botautotask.mjs
```

## 2. Quy tắc viết test trong BotAutoTask

1. **Chỉ dùng `node:test` và `node:assert/strict` (`D-01`, `D-02`):** Không cài Jest, Vitest, Sinon hay thư viện mock ngoài.
2. **Tên `test(...)` phải chứa `AC-ID` hoặc mã `SPEC-XXX`:** Để truy vết trực tiếp từ bảng điều kiện nghiệm thu trong `docs/feature/00..09`.
3. **Cô lập hệ thống file bằng `os.tmpdir()` + `t.after()`:**
   ```js
   const tempDir = join(tmpdir(), `botautotask-test-${Date.now()}`);
   t.after(() => {
     try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
   });
   ```
4. **Test HTTP/SSE bind trên port `0` (`127.0.0.1`):** Để hệ điều hành tự cấp cổng rảnh, tránh lỗi `EADDRINUSE` khi chạy song song.
5. **Không gọi CLI AI thật hoặc mạng ngoài trong unit/integration test:** Inject hàm giả (`execFn`, `fetchFn`, `nowFn`) hoặc dùng `CustomCmdHarness` với lệnh `node -e "..."`.

## 3. Gotchas đã xác nhận (`C18` — bắt buộc cập nhật ngày kiểm khi sửa code liên quan)

| Triệu chứng | Nguyên nhân gốc | Cách tránh chuẩn trong repo | Kiểm lần cuối |
|---|---|---|---|
| `spawn EINVAL` hoặc không tìm thấy `opencode`/`npx` trên Windows | Node.js trên Windows không tự chạy được shim `.cmd` nếu `shell: false`, nhưng bật `shell: true` lại gây cảnh báo bảo mật `DEP0190` và lỗi nối chuỗi tham số | Dùng helper trong `src/core/spawn-cli.js` hoặc gọi trực tiếp `node <npm-global>/node_modules/.../bin/cli.js` như trong `scripts/cloud-provision.mjs` | 2026-10-20 |
| Test `worktree-manager.test.js` thất bại với `fatal: 'HEAD' is not a commit` | Tạo repo tạm bằng `git init` nhưng chưa có commit đầu tiên trước khi gọi `WorktreeManager.ensure()` | Luôn tạo ít nhất 1 file và `git commit -m "initial"` (kèm `git config user.email/user.name` cục bộ trong repo tạm) trước khi tạo worktree | 2026-10-20 |
| EventSource SSE trên trình duyệt trả `401 Unauthorized` dù đã mở URL có `#k=<token>` | API `EventSource` của trình duyệt không hỗ trợ gắn header `Authorization`, nên dashboard truyền qua query `?k=<token>` trong khi server cũ chỉ đọc `?token=` | Trong `src/daemon/web-ui.js` (`_isAuthorized`), luôn chấp nhận cả `url.searchParams.get('k')`, `url.searchParams.get('token')` và header `Authorization` qua `crypto.timingSafeEqual` | 2026-10-20 |
| `crypto.timingSafeEqual` ném `RangeError: Input buffers must have the same byte length` | So sánh trực tiếp 2 chuỗi token có độ dài khác nhau | Kiểm tra `bufA.length === bufB.length` trước khi gọi `timingSafeEqual` (như `web-ui.js`) hoặc băm `SHA-256` cả hai vế thành 32 bytes cố định trước khi so sánh (như `cloud-core/worker.js`) | 2026-10-20 |
| CI báo `dist/botautotask.mjs` bị dirty sau khi sửa `src/` | Sửa file trong `src/` nhưng quên chạy script đóng gói trước khi commit | Luôn chạy `node scripts/build-single-file.js` ở bước cuối cùng của mọi task sửa `src/` | 2026-10-20 |
| Lệnh `git reset --hard HEAD~1` khi revert merge làm mất code đang sửa dở của người dùng | `reset --hard` xoá toàn bộ working tree của nhánh chính | Trước khi merge phải kiểm tra `git status --porcelain -- <changedFiles>` (trả `MAIN_DIRTY_COLLISION` nếu bẩn); khi revert merge dùng `git reset --keep HEAD~1` | 2026-10-20 |
| Khởi tạo `new AgentMesh({ registry, ranker, stateFile })` trong test mà quên truyền `workspaceDir` | `workspaceDir` mặc định là `process.cwd()` (chính là repo `BotAutoTask` thật), khiến agent `coder` tạo git worktree thật trong `.botautotask/worktrees/coder` và vướng `MAIN_DIRTY_COLLISION` khi repo đang có file chưa commit | Trong mọi test khởi tạo `AgentMesh`, luôn truyền `workspaceDir: join(tmpdir(), ...)` tách biệt hoàn toàn với `process.cwd()` | 2026-10-20 |
