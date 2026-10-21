# Nghiên cứu kiến trúc — 5 repo OSS + 1 sản phẩm đóng

Thư mục này trả lời một câu: **WhaleBot nên vay gì từ 6 nguồn tham chiếu này, và vay ở dạng nào cho vừa một người vận hành?**

Toàn bộ là phân tích tĩnh trên bản clone / artefact đã ship (không build, không chạy test, không chạy app). Mọi kết luận đều kèm `file:line` để bạn tự kiểm.

| Tài liệu | Một câu | Dòng |
|---|---|---|
| [`REFERENCE-ARCHITECTURE.md`](./REFERENCE-ARCHITECTURE.md) | **Đọc trước.** Kiến trúc v0.2, 12 quyết định, schema 9 bảng, lộ trình 4 tuần | 502 |
| [`reason-network-architecture.md`](./reason-network-architecture.md) | Bưu điện cho phiên agent: delivery tier, `doing` đọc dấu vết, setup tự vá config | 340 |
| [`neko-bot-architecture.md`](./neko-bot-architecture.md) | Nghĩa vụ ghi trước khi chạy, không retry mù, hash chain — nhưng **AGPL, không copy code** | 521 |
| [`orca-architecture.md`](./orca-architecture.md) | Worktree + fan-out ở quy mô IDE: adapter dialect, relay chỉ outbound, docs khớp version | 327 |
| [`harness2-architecture.md`](./harness2-architecture.md) | Harness là dữ liệu, không phải code; vòng propose → probe → compose | 369 |
| [`openmuse-architecture.md`](./openmuse-architecture.md) | Lease/CAS/heartbeat trong cùng DB, approval có hash, trạng thái `unknown` | 350 |
| [`grokbot-architecture.md`](./grokbot-architecture.md) | **Sản phẩm đóng, không có LICENSE.** Hai máy tính, quyền là dữ liệu, box điều khiển bằng file | 521 |

> Bản hợp nhất các kết luận thành kiến trúc WhaleBot: [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — `Proposal`, chờ duyệt.

## Đọc bao lâu

- **30 phút, chỉ cần quyết định:** `REFERENCE-ARCHITECTURE.md` §1 (bảng so sánh), §2 (4 giả định của MVP sẽ vỡ), §8 (bảng áp dụng + LOC).
- **2 giờ, trước khi viết code:** thêm §3 (kiến trúc v0.2), §4 (12 quyết định), §5 (harness registry), §6 (schema), §12 (8 bất biến).
- **Chỉ khi cần chi tiết một repo:** báo cáo riêng của repo đó, mục "Cơ chế cốt lõi".

## Kết luận ngắn nhất

1. **SQLite trên PC là nguồn sự thật**, D1 chỉ là transport. (G1)
2. **`/steer` là hợp đồng có tier**, không phải lời hứa 15 giây cho mọi core. (G2)
3. **Attempt phải có trạng thái `unknown`**, vì daemon có thể chết giữa một side effect. (G3)
4. **Không tin trạng thái agent tự khai** — suy ra từ transcript/todo/exit code. (G4)

Tổng công: ~840 dòng, bản tối thiểu đáng làm trước ~370 dòng.

## Không nên đọc hết

`neko-bot` (192k dòng, 3 ngôn ngữ, 3 tầng) và `orca` (38,6k file, ~1,46 GB) là ví dụ về **cái giá của việc tổng quát hoá quá sớm**. Đọc phần cơ chế, đừng đọc phần hạ tầng.
