# Mã trạng thái & Mã lỗi — BotAutoTask

> Nguồn sự thật duy nhất về các mã trạng thái và mã lỗi (`PK-API-R01`, `C01`). Khi thêm mã mới trong code hoặc spec, bắt buộc cập nhật bảng này trong cùng PR.

## 1. Trạng thái Goal (`goals.status`)

| Mã | Ý nghĩa | Khi nào chuyển sang | Nơi phát sinh |
|---|---|---|---|
| `QUEUED` | Goal nằm trong hàng đợi D1 hoặc hàng đợi local chờ worker nhận | Vừa tạo qua `/goal`, CLI `submit`, hoặc Web UI | `cloud-core/worker.js`, `src/daemon/local-daemon.js` |
| `RUNNING_LOCAL` | Đang được thực thi bởi Local PC Daemon (giữ lease hợp lệ) | Local Daemon acquire lease thành công | `cloud-core/worker.js`, `src/daemon/local-daemon.js` |
| `RUNNING_CLOUD` | Đang được thực thi bởi GitHub Actions Cloud Worker | Lease local hết hạn > 90s và `shouldTriggerCloudFallback` kích hoạt | `cloud-core/worker.js` |
| `RUNNING` | Đang chạy trong vòng lặp `GoalOrchestrator` / `SupervisorLoop` nội bộ | Bắt đầu `runGoal()` hoặc `runSupervision()` | `src/core/orchestrator.js`, `src/core/supervisor.js` |
| `COMPLETED` | Hoàn thành và **đã vượt qua** lệnh kiểm chứng (`acceptance_cmd` exit 0) | Model báo `GOAL_COMPLETED` VÀ `_verifyAcceptance()` trả `verified: true` | `src/core/orchestrator.js`, `src/core/supervisor.js` |
| `COMPLETED_UNVERIFIED` | Model báo xong nhưng **chưa có lệnh kiểm chứng** (`acceptance_cmd` rỗng) | Model báo `GOAL_COMPLETED` nhưng không cấu hình `acceptance_cmd` (`SPEC-SAFE-R03`) | `src/core/orchestrator.js`, `src/core/supervisor.js`, `cloud-core/worker.js` |
| `PAUSED` | Tạm dừng theo lệnh người dùng cho đúng `goal_id` chỉ định | Lệnh `/pause` hoặc nút Pause | `cloud-core/worker.js` |
| `PAUSED_LIMIT` | Tạm dừng do hết toàn bộ model/lõi miễn phí khả dụng | Mọi candidate trong `FreeModelRanker` đều đang cooldown hoặc hết quota (`PK-AGENT-R05`) | `src/core/orchestrator.js` |
| `STALLED` | Bị kẹt không tiến triển sau 3 bước liên tiếp có cùng `gap_signature` | `CompletionContract.recordStepGap()` phát hiện lặp lần thứ 3 | `src/core/completion-contract.js` |
| `MAX_STEPS_REACHED` | Chạm trần `max_steps` mà chưa đạt điều kiện hoàn thành | Vòng lặp vượt `goal.maxSteps` (`PK-AGENT-R03`) | `src/core/orchestrator.js`, `src/core/supervisor.js` |
| `FAILED` | Thất bại không thể phục hồi | Lỗi thực thi hoặc lệnh kiểm chứng thất bại khi kết thúc | `src/core/orchestrator.js`, `cloud-core/worker.js` |
| `CANCELLED` | Huỷ vĩnh viễn theo lệnh người dùng | Lệnh `/cancel` | `cloud-core/worker.js` |

## 2. Kết quả một Step (`StepReceipt.outcome`)

| Mã | Ý nghĩa | Hành động của Orchestrator |
|---|---|---|
| `STEP_DONE` | Hoàn thành 1 bước trung gian, cần bước tiếp theo | Ghi `StepReceipt` vào Journal, tạo Git checkpoint, chạy step kế tiếp |
| `GOAL_COMPLETED` | Agent báo đã hoàn thành mục tiêu (`<OMNIGOAL_STATUS>COMPLETED</OMNIGOAL_STATUS>`) | Chạy `_verifyAcceptance()` trước khi quyết định `COMPLETED` hay `COMPLETED_UNVERIFIED` |
| `RATE_LIMITED` | Chạm giới hạn `HTTP 429` / hết quota / usage limit | Đưa `harness:model` vào bảng cooldown (`cooldownMs`), trượt ngay sang model free kế tiếp trong cùng step |
| `ERROR` | Lỗi tiến trình CLI hoặc lỗi cú pháp phản hồi | Ghi nhận lỗi và chuyển sang candidate tiếp theo hoặc dừng |
| `UNKNOWN` | Tiến trình bị ngắt đột ngột giữa turn (crash/kill) | Không tự động chạy lại mù; yêu cầu kiểm tra `git status` trước khi tiếp tục (`SPEC-MESH`) |

## 3. Trạng thái Kiểm chứng (`CompletionContract.evaluate().verdict`)

| Mã | Ý nghĩa |
|---|---|
| `complete` | Tất cả tiêu chí trong contract đều `passed: true` ở đúng `currentMutationEpoch` |
| `outcome_unverified` | Không có cả `acceptance_cmd` lẫn tiêu chí trong contract |
| `validation_missing` | Có thay đổi code (`mutation_epoch` mới) nhưng chưa chạy lại bước kiểm chứng ở epoch hiện tại |
| `validation_failed` | Có ít nhất 1 tiêu chí kiểm chứng trả kết quả thất bại |

## 4. Trạng thái Giao tin, Worktree & Approval (`AgentMesh` / `WorktreeManager`)

| Mã | Thành phần | Ý nghĩa |
|---|---|---|
| `interrupted` | `SendToAgent` | Đã ngắt tiến trình CLI đang chạy của agent đích và xếp chỉ thị mới vào lượt kế tiếp |
| `queued_busy` | `SendToAgent` | Agent đích đang bận (`running`), tin nhắn đã vào hàng đợi `pendingFollowUps` |
| `queued_idle` | `SendToAgent` | Agent đích đang rảnh (`idle`), tin nhắn sẽ được đọc ở lượt chạy tới |
| `awaiting_review` | `MergeAgentWorktree` | Yêu cầu merge từ agent đã tạo bản ghi `pending` trong Approval Gate, chờ người dùng duyệt |
| `already_decided` | `decideApproval` | Bản ghi approval đã được duyệt/từ chối/hết hạn trước đó (chống bấm đúp) |
| `MAIN_DIRTY_COLLISION` | `WorktreeManager.merge` | Nhánh chính đang có thay đổi chưa commit trùng với file agent sửa; từ chối merge để bảo toàn dữ liệu người dùng (`SPEC-SAFE-R02`) |
| `MERGE_CONFLICT` | `WorktreeManager.merge` | Xung đột `git merge --no-ff`; đã tự động `git merge --abort` và trả danh sách `conflicts` |
| `VERIFY_FAILED` | `WorktreeManager.merge` | Lệnh `verifyCmd` thất bại trong worktree hoặc sau khi merge trên nhánh chính (đã `git reset --keep HEAD~1`) |
| `CLEAN_WORKING_TREE` | `WorktreeManager.commit` | Không có file nào thay đổi trong worktree |

## 5. Mã HTTP & Giao thức API (`PK-API`, `PK-AUTH`, `PK-JOB`)

| HTTP | Mã `error` / `status` | Khi nào trả về |
|---|---|---|
| `200` | `ok` / `healthy` | Thành công hoặc health probe (`GET /health`, `GET /`) |
| `400` | `INVALID_INPUT` / `Missing field` | Thiếu trường bắt buộc (`goal`, `text`, `confirm: true`) hoặc JSON hỏng |
| `401` | `Unauthorized` | Thiếu hoặc sai Bearer token / `?k=` / `?token=` (so sánh constant-time `PK-AUTH-R02`, fail-closed `PK-AUTH-R06`) |
| `403` | `Forbidden (Origin/Host mismatch)` | Header `Origin` hoặc `Host` không khớp `127.0.0.1` / `localhost` (chống DNS-rebinding/CSRF) |
| `404` | `Not found` | Đường dẫn API hoặc `approvalId` / `agentId` không tồn tại |
| `409` | `LEASE_CONFLICT` / `Hash mismatch` | `lease_epoch` hoặc `lease_owner` cũ bị fence (`PK-JOB-R04`), hoặc `hash` của approval không khớp với hành động đã đề xuất |
| `413` | `Payload too large` | Request body vượt quá trần `1 MB` |
| `429` | `RATE_LIMITED` | Quá giới hạn tốc độ gọi API hoặc hàng đợi relay đầy |
| `500` | `INTERNAL_ERROR` | Lỗi nội bộ server (không trả stack trace ra ngoài theo `PK-API-R02`, `C15`) |
