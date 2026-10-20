# SPEC-XXX — Tiêu đề

| Thuộc tính | Giá trị |
|---|---|
| Trạng thái | Draft <!-- Draft → Ready → In progress → Done; hoặc As-built --> |
| Giai đoạn | 1 |
| Phụ thuộc | SPEC-… |
| Quyết định liên quan | D-… |
| Thiết kế | <!-- link *-design.md nếu có --> |

## 1. Mục tiêu

<Vấn đề, cho ai, đo thành công bằng gì.>

## 2. Phạm vi

**Trong phạm vi:**
**Ngoài phạm vi:** <!-- không được rỗng -->

## 3. Kịch bản người dùng <!-- tuỳ chọn -->

- **US1 (P1)** — Là <vai trò>, tôi muốn <…> để <…>. Kiểm độc lập: <…>. AC: XXX-AC01..AC03.

## 4. Yêu cầu

| ID | Mức | Yêu cầu |
|---|---|---|
| XXX-R01 | MUST | Khi <sự kiện>, hệ thống MUST <…>. |
| XXX-R02 | MUST (GĐ2) | Nếu <điều kiện lỗi>, thì hệ thống MUST <…>. |

<!-- Mẫu EARS: Luôn / Khi <sự kiện> / Trong khi <trạng thái> / Nếu <lỗi> thì / Khi bật <tính năng>. Chỗ chưa rõ: [CẦN LÀM RÕ: …] -->

## 5. Yêu cầu phi chức năng

| Khía cạnh | Yêu cầu (số liệu) hoặc `N/A — lý do` |
|---|---|
| Hiệu năng | |
| Bảo mật (dữ liệu nhạy cảm, quyền, cấm log) | |
| Giới hạn / rate limit | |
| Khả dụng / khôi phục | |
| Quan sát (log, metric, audit) | |
| i18n | |
| a11y | |
| Trạng thái UI (loading / empty / error / forbidden) | |

## 6. Trường hợp biên

- <câu hỏi biên> → XXX-AC0n | ngoài phạm vi

## 7. Điều kiện nghiệm thu

| Trạng thái | ý nghĩa |
|---|---|
| `[ ]` | chưa đạt |
| `[x]` | test xanh trong CI của PR làm AC đó |
| `[~]` | cần môi trường thật — ghi lý do và cách đóng |

- [ ] **XXX-AC01** *(integration)* — *Cho* <trạng thái ban đầu cụ thể>, *khi* <hành động>, *thì* <kết quả quan sát được: mã HTTP, mã lỗi, dữ liệu>.
- [~] **XXX-AC02** *(e2e)* — … — *Lý do:* <…>. *Cách đóng:* <…>.

## 8. Kiểm tra end-to-end

<Lệnh hoặc kịch bản để agent tự xác nhận toàn bộ spec chạy.>

## 9. Ghi chú thiết kế

<Chỉ ràng buộc kiến trúc. Chi tiết thiết kế ở file design. Không chia việc ở đây — thuộc plan.>

## 10. Hướng dẫn vận hành <!-- tuỳ chọn; dành cho người vận hành, không phải REQ -->

## 11. Làm rõ

<!-- ### Phiên YYYY-MM-DD
- H: … → Đ: … (ghi vào R0n / D-xx) -->

## 12. Câu hỏi mở

<!-- Ghi "Không có" nếu rỗng. Mâu thuẫn với spec khác: ghi ở cả hai spec. -->
