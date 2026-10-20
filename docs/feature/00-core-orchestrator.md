# SPEC-CORE — Lõi Điều Phối Đa Lõi, Xếp Hạng Model Miễn Phí & Vòng Lặp Giám Sát

| Thuộc tính | Giá trị |
|---|---|
| ID | `SPEC-CORE` |
| Trạng thái | `As-built` (Đã triển khai và có test bảo vệ) |
| Giai đoạn | 1 |
| Phụ thuộc (`Depends on`) | — |
| Quyết định liên quan | `D-01`, `D-05`, `D-07`, `D-08`, `D-09` |
| Thiết kế gốc | [`../superpowers/specs/2026-10-19-botautotask-design.md`](../superpowers/specs/2026-10-19-botautotask-design.md) |
| Module triển khai | `src/core/orchestrator.js`, `src/core/model-discovery.js`, `src/core/rate-limit-detector.js`, `src/core/harness-registry.js`, `src/core/supervisor.js`, `src/core/log-reader.js`, `src/core/atomic-write.js`, `src/harnesses/*.js`, `src/daemon/local-daemon.js`, `src/daemon/network-monitor.js` |

## 1. Mục tiêu

Cung cấp bộ điều phối trung tâm (`GoalOrchestrator` & `SupervisorLoop`) tách biệt hoàn toàn khỏi công cụ AI thực thi thông qua hợp đồng `AgentHarness`, tự động quét và xếp hạng các model miễn phí tốt nhất tại thời điểm chạy, tự động chuyển đổi sang model/lõi tiếp theo khi gặp giới hạn tốc độ (`HTTP 429`), và duy trì tiến độ qua sổ cái `StepReceipt` ngay cả khi mất mạng.

## 2. Phạm vi

- **Trong phạm vi:**
  - Hợp đồng `AgentHarness` (`isAvailable`, `discoverModels`, `executeStep`) và sổ đăng ký `HarnessRegistry` (hỗ trợ 5 lõi: `opencode`, `antigravity`, `claude-codex`, `neko-core`, `custom-cmd`).
  - Bộ xếp hạng `FreeModelRanker` và nhận diện lỗi `isRateLimitError` (`429`, `quota exceeded`, `credit balance too low`).
  - Vòng lặp `GoalOrchestrator` (chạy từng step, ghi `StepReceipt`, tạo Git checkpoint, kiểm tra `acceptance_cmd`) và `SupervisorLoop` (đọc `transcript.jsonl` / NDJSON stream, sinh `.botautotask/DIRECTIVE.md`).
  - Hàng đợi bền vững khi mất mạng (`NetworkMonitor` + `LocalDaemon`) và ghi file trạng thái nguyên tử (`atomic-write.js`).
- **Ngoài phạm vi:**
  - Giao diện Web UI / PWA (thuộc [`SPEC-UI`](01-web-mobile-ui.md)).
  - Điều phối đa agent song song trên `git worktree` (thuộc [`SPEC-MESH`](03-git-worktree-parallel.md)).
  - Hạ tầng Cloudflare Worker + D1 SQLite (thuộc [`SPEC-CLOUD`](02-mobile-cloud-control.md)).

## 3. Kế thừa từ Pack (`PK-*`)

| REQ dự án | Kế thừa từ Pack | Tham số / Giá trị áp dụng tại BotAutoTask |
|---|---|---|
| `CORE-R04` | `PK-AGENT-R05` | `{allow-paid-fallback} = false`, `cooldownMs = 1800000` (30 phút) |
| `CORE-R05` | `PK-AGENT-R03` | `{max-turns} = 15` (`goal.maxSteps`), `{step-timeout-ms} = 300000` (5 phút) |
| `CORE-R07`, `CORE-R08` | `PK-JOB-R01`, `PK-JOB-R02` | `{job-timeout-ms} = 300000`, thao tác theo khoá định danh `goal.id` (`D-07`) |
| Quy trình phát hành & đóng gói | `PK-RELEASE-R01..R06` (`D-12`) | `{release-branch} = v*`, `{artifact-path} = dist/botautotask.mjs`, `{changelog-path} = docs/changelog/` (`PK-RELEASE-R03 = N/A` theo `D-12`) |

## 4. Yêu cầu chức năng (EARS)

| ID | Mức | Yêu cầu (EARS) | Bằng chứng (`As-built`) |
|---|---|---|---|
| `CORE-R01` | MUST | Hệ thống MUST giao tiếp với mọi lõi AI thông qua giao diện `AgentHarness` thống nhất (`id`, `isAvailable()`, `discoverModels()`, `executeStep()`) và cho phép thêm/thay thế lõi qua `customHarnesses` trong cấu hình mà không cần sửa code điều phối. | `src/core/harness-registry.js`, `src/harnesses/custom-cmd-harness.js` |
| `CORE-R02` | MUST | Khi xếp hạng model khả dụng, `FreeModelRanker` MUST chấm điểm dựa trên danh sách `priorityModels` (ưu tiên `deepseek-v4.1-flash-free`, `gpt-luna`, `opencode/*free*`, `gemini-2.5-pro/flash`), loại bỏ các cặp `harness:model` đang nằm trong thời gian `cooldownMs`. | `src/core/model-discovery.js:24-95` |
| `CORE-R03` | MUST | Khi đầu ra của CLI hoặc API chứa tín hiệu giới hạn (`429`, `rate_limit`, `quota exceeded`, `usage limit`, `credit balance is too low`), `isRateLimitError()` MUST trả về `true` và phân loại bước chạy đó là `RATE_LIMITED`. | `src/core/rate-limit-detector.js:1-33` |
| `CORE-R04` | MUST | Nếu một bước chạy trả về `outcome === 'RATE_LIMITED'`, `GoalOrchestrator` MUST đưa `harness:model` vừa chạy vào bảng cooldown và chuyển ngay sang model miễn phí có điểm cao kế tiếp trong cùng bước đó mà không làm mất lịch sử `journal`. | `src/core/orchestrator.js:75-135` |
| `CORE-R05` | MUST | Khi một bước trả về `outcome === 'GOAL_COMPLETED'`, hệ thống MUST thực thi lệnh `acceptance_cmd` (nếu có); chỉ khi `acceptance_cmd` thoát với mã `0` thì mới trả trạng thái `COMPLETED`, còn nếu không có `acceptance_cmd` thì MUST trả `COMPLETED_UNVERIFIED`. | `src/core/orchestrator.js:35-65, 140-175`, `src/core/supervisor.js:185-205` |
| `CORE-R06` | MUST | Trong chế độ `SupervisorLoop`, hệ thống MUST trích xuất bước chạy mới nhất từ `transcript.jsonl` (Antigravity) hoặc luồng NDJSON `--format json` (OpenCode), kết hợp kết quả `acceptance_cmd` để sinh chỉ thị bước tiếp theo vào `.botautotask/DIRECTIVE.md`. | `src/core/log-reader.js:1-145`, `src/core/supervisor.js:40-180` |
| `CORE-R07` | MUST | Khi ghi các file trạng thái cục bộ (`queue.json`, `mesh-state.json`, `config.json`, `EXPERIENCE.md`), hệ thống MUST ghi vào file tạm cùng thư mục rồi `rename` nguyên tử qua `atomic-write.js`. | `src/core/atomic-write.js:1-42` |
| `CORE-R08` | MUST | Khi mất kết nối mạng hoặc Cloud-Core không phản hồi, `LocalDaemon` MUST giữ các Goal trong hàng đợi cục bộ (`~/.botautotask/queue.json`) và chỉ thực thi/đồng bộ khi `NetworkMonitor` xác nhận có mạng trở lại. | `src/daemon/network-monitor.js:1-54`, `src/daemon/local-daemon.js:1-165` |

## 5. Yêu cầu phi chức năng (NFR)

| Khía cạnh | Yêu cầu (số liệu) hoặc `N/A — lý do` |
|---|---|
| Hiệu năng | Chấm điểm và xếp hạng danh sách 100 model trong `FreeModelRanker` hoàn tất `< 10 ms` (in-memory). |
| Bảo mật | Không truyền hoặc ghi log giá trị biến môi trường nhạy cảm trong `StepReceipt` hoặc `journal` (`PK-AUTH-R07`). |
| Giới hạn / rate limit | Mặc định `maxSteps = 15` mỗi Goal; thời gian cooldown khi dính `429` mặc định `cooldownMs = 1800000` (30 phút). |
| Khả dụng / khôi phục | Tự động trượt qua tối đa toàn bộ danh sách model miễn phí khả dụng trước khi dừng ở `PAUSED_LIMIT`; bảo toàn ngữ cảnh bàn giao qua `buildHandoverPrompt()`. |
| Quan sát (log, metric, audit) | Mỗi bước hoàn tất đều tạo một bản ghi `StepReceipt` gồm `stepNumber`, `core_used`, `model_used`, `outcome`, `summary`, `git_commit`. |
| i18n | Hỗ trợ prompt và tóm tắt tiếng Việt / tiếng Anh (UTF-8 không BOM). |
| a11y | `N/A — module điều phối lõi và CLI không có giao diện đồ hoạ (UI thuộc SPEC-UI)`. |
| Trạng thái UI | `N/A — module lõi trả mã trạng thái chuẩn theo docs/reference/status-codes.md`. |

## 6. Trường hợp biên (Edge Cases)

- Model không in thẻ `<OMNIGOAL_STATUS>` trong output → `parseStepTags()` fallback về `STEP_DONE` và lấy dòng cuối làm `summary` (`CORE-AC02`).
- Tất cả các model miễn phí trong mọi Harness đều đang bị cooldown `429` → `GoalOrchestrator` trả `status: 'PAUSED_LIMIT'`, không gọi sang model trả phí (`CORE-AC03`).
- Goal khai báo hoàn thành (`GOAL_COMPLETED`) nhưng không truyền `--check` (`acceptance_cmd` rỗng) → trả `status: 'COMPLETED_UNVERIFIED'` (`CORE-AC04`).
- Thay thế `neko-core` bằng một lõi CLI tự viết trong `customHarnesses` → `HarnessRegistry` nạp lõi mới và chạy đúng template lệnh (`CORE-AC05`).

## 7. Điều kiện nghiệm thu (`AC`)

- [x] **CORE-AC01** *(unit)* — **Cho** danh sách model gồm `google/gemini-2.5-flash`, `opencode/deepseek-v4.1-flash-free` và `opencode/gpt-luna`, **khi** gọi `FreeModelRanker.rankModels()` rồi đánh dấu `deepseek-v4.1-flash-free` vào cooldown, **thì** lần đầu `deepseek-v4.1-flash-free` đứng số 1 và lần sau `gpt-luna` tự động lên đứng số 1. *(Test: `tests/model-and-limit.test.js`)*
- [x] **CORE-AC02** *(unit)* — **Cho** các chuỗi lỗi chứa `HTTP 429`, `Rate limit reached`, `Quota exceeded` và output thiếu thẻ `<OMNIGOAL_STATUS>`, **khi** gọi `isRateLimitError()` và `parseStepTags()`, **thì** nhận diện đúng 100% lỗi rate-limit và fallback an toàn về `STEP_DONE`. *(Test: `tests/model-and-limit.test.js`)*
- [x] **CORE-AC03** *(integration)* — **Cho** một Goal chạy trên `GoalOrchestrator` với model đầu tiên trả `RATE_LIMITED` và model thứ hai trả `GOAL_COMPLETED`, **khi** thực thi `runGoal()`, **thì** orchestrator tự động chuyển sang model thứ hai ngay trong cùng step và lưu `StepReceipt` của model thứ hai. *(Test: `tests/orchestrator-failover.test.js`)*
- [x] **CORE-AC04** *(integration)* — **Cho** một Goal có `acceptance_cmd: "node -e \"process.exit(0)\""` so với một Goal không có `acceptance_cmd`, **khi** model trả `GOAL_COMPLETED`, **thì** Goal có check nhận `status: 'COMPLETED'` (kèm lưu Experience Library) còn Goal không có check nhận `status: 'COMPLETED_UNVERIFIED'`. *(Test: `tests/orchestrator-failover.test.js`)*
- [x] **CORE-AC05** *(integration)* — **Cho** cấu hình tắt `neko-core` và thêm `my-custom-core` trong `customHarnesses`, **khi** khởi tạo `HarnessRegistry`, **thì** `neko-core` bị loại bỏ và `my-custom-core` thực thi thành công lệnh qua `CustomCmdHarness`. *(Test: `tests/orchestrator-failover.test.js`)*
- [x] **CORE-AC06** *(integration)* — **Cho** file `transcript.jsonl` của Antigravity và luồng NDJSON của OpenCode, **khi** chạy `SupervisorLoop.runSupervision()`, **thì** hệ thống đọc đúng phản hồi mới nhất, sinh file `.botautotask/DIRECTIVE.md` và trả `COMPLETED` khi `acceptance_cmd` pass. *(Test: `tests/supervisor-and-logs.test.js`)*
- [x] **CORE-AC07** *(integration)* — **Cho** `LocalDaemon` với `NetworkMonitor` giả lập mất mạng và có mạng trở lại, **khi** xếp hàng Goal (`enqueueGoal`) và chạy `tick()`, **thì** khi mất mạng Goal được giữ nguyên tử trong `queue.json` (không gọi orchestrator) và chỉ thực thi khi mạng online trở lại. *(Test: `tests/cloud-and-daemon.test.js`)*

## 8. Kiểm tra end-to-end

```powershell
node --test tests/model-and-limit.test.js tests/orchestrator-failover.test.js tests/supervisor-and-logs.test.js tests/cloud-and-daemon.test.js
```

## 9. Làm rõ & Câu hỏi mở

- **Làm rõ (2026-10-20):** Tách đặc tả lõi điều phối thành `00-core-orchestrator.md` (`SPEC-CORE`) để ánh xạ 1-1 trong `docs/feature/` (`D-10`). Giữ nguyên file thiết kế gốc tại `docs/superpowers/specs/2026-10-19-botautotask-design.md` làm tài liệu tham khảo lịch sử.
- **Câu hỏi mở:** Không có.
