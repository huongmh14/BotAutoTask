# CONSTRAINTS.md — BotAutoTask

> Kiểm lần cuối: `2026-10-20` bởi `@huongmh14`
> Nguồn sự thật về sàn chất lượng được kiểm bằng lệnh máy (`C23`). Không hạ ngưỡng hoặc xoá quy tắc trong file này để làm PR/test qua.

## 1. Sàn cứng (Floor — luôn áp dụng, kiểm trên git diff)

- Không thêm cờ bịt miệng trình kiểm tra mới: `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error`, `eslint-disable`, `biome-ignore`, `# noqa`, `# type: ignore`, `istanbul ignore`, `nosemgrep`, `gitleaks:allow`.
- Không để hàm rỗng / chưa cài đặt trong code giao: `throw new Error("Not implemented")`, `TODO` thay cho nhánh xử lý thật, hoặc `catch {}` rỗng nuốt lỗi ngoài các tác vụ best-effort đã ghi chú rõ.
- Không thêm `.skip`, `.only`, ` { skip: true }`, xoá file test (`tests/*.test.js`), hoặc rút `assert.*` khỏi test hiện có để làm test xanh.
- Không có secret, token thật, mật khẩu, hoặc nội dung `~/.codex/auth.json`, `~/.claude/.credentials.json`, `.env` trong mã nguồn hoặc log (`PK-AUTH-R07`, `PK-AGENT-R06`).
- Không bật `allow_paid_fallback` mặc định hoặc tự động gọi sang API trả phí khi chưa được người dùng cho phép (`PK-AGENT-R05`).
- Không sửa giảm ngưỡng trong file `CONSTRAINTS.md` cùng commit với tính năng đang bị đỏ.

## 2. Ngưỡng cưỡng chế bằng lệnh (Enforced with numbers)

Mỗi dòng bắt buộc có lệnh kiểm tra thực tế ở cột `Lệnh kiểm`.

| Chiều chất lượng | Ngưỡng bắt buộc | Lệnh kiểm (`Checked by`) | Chạy ở giai đoạn | Lý do chọn ngưỡng |
|---|---|---|---|---|
| Unit & Integration Tests | 100% test xanh (`0 fail`, `0 skipped`) | `npm test` | Mọi lần sửa (`check:fast`, CI) | Bảo vệ toàn bộ các invariants về lease CAS, policy hard-refuse, worktree merge và failover |
| Đồng bộ Bundle (`PK-RELEASE-R06`) | `dist/botautotask.mjs` khớp 100% với `src/` | `node scripts/build-single-file.js && git diff --exit-code dist/botautotask.mjs` | Cuối task & CI (`check:task`) | Chặn lỗi sửa `src/` nhưng quên đóng gói lại file thực thi độc lập |
| Zero Runtime Dependencies (`D-01`) | `0` package trong `dependencies` | `node -e "const p=require('./package.json'); if(Object.keys(p.dependencies||{}).length>0) process.exit(1)"` | Trước commit & CI (`check:fast`) | Giữ kiến trúc standalone single-file không phụ thuộc thư viện ngoài |
| Cloud Provision Dry-Run | Exit code `0` | `npm run cloud:setup:dry` | Khi chạm `cloud-core/` hoặc `scripts/` (`check:task`) | Đảm bảo luồng sinh cấu hình Cloudflare không gãy |

## 3. Bánh cóc chất lượng (Ratchets — đo và giữ không tụt lùi)

Các chỉ số toàn cục tuyệt đối không được tệ hơn hiện trạng (`must not fall` / `must not exceed`):

| Chỉ số | Giá trị hiện tại (Baseline 2026-10-20) | Chiều bắt buộc | Lệnh đo |
|---|---|---|---|
| Tổng số bài test tự động (`tests/*.test.js`) | `38` tests pass | Không được giảm (`>= 38`) | `npm test` |
| Dung lượng bundle `dist/botautotask.mjs` | `~260 KB` (`265932 bytes`) | Không vượt quá `350 KB` (`358400 bytes`) | `node -e "const s=require('fs').statSync('dist/botautotask.mjs').size; if(s>358400) process.exit(1)"` |
| Độ dài `AGENTS.md` | `124 dòng` | Không vượt quá `150 dòng` | `node -e "const n=require('fs').readFileSync('AGENTS.md','utf8').split('\n').length; if(n>150) process.exit(1)"` |

## 4. Ngoại lệ có thời hạn (Exceptions)

Mọi ngoại lệ phải có chủ sở hữu (`Owner`) và ngày hết hạn (`Expires` ≤ 90 ngày).

| ID | Luật được miễn | Phạm vi đường dẫn | Lý do & Ticket xử lý | Owner | Ngày hết hạn |
|---|---|---|---|---|---|
| — | Không có ngoại lệ đang mở | — | — | — | — |
