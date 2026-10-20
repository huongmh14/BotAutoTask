# SPEC-VERIFY (Spec 05) — Closed-Loop Verification, Permission Policy & Auth/Failover An Toàn

| Thuộc tính | Giá trị |
|---|---|
| ID | `SPEC-VERIFY` |
| Trạng thái | `As-built` (`policy.js`, `completion-contract.js`, `auth-bridge.js`, chặn auto-pass) |
| Giai đoạn | 1 |
| Phụ thuộc (`Depends on`) | `SPEC-CORE` |
| Quyết định liên quan | `D-04`, `D-06`, `D-09` |
| Module triển khai | `src/core/completion-contract.js`, `src/core/policy.js`, `src/core/orchestrator.js`, `src/core/supervisor.js`, `src/core/auth-bridge.js`, `src/core/model-discovery.js` |

## 1. Mục tiêu & Phạm vi

### 1.1 Vấn đề gốc & Mục tiêu
| # | Vấn đề trước đây | Vị trí | Trạng thái |
|---|---|---|---|
| 1 | Không có `acceptance_cmd` ⇒ coi như **pass** (`COMPLETED`) | `orchestrator.js` `_verifyAcceptance` | ✅ Đã sửa (`COMPLETED_UNVERIFIED`) |
| 2 | Không có trạng thái "đã sửa code nhưng chưa kiểm chứng ở epoch mới" | `completion-contract.js` | ✅ Đã có `validation_missing` |
| 3 | Lặp vô ích tới hết `max_steps` khi model kẹt cùng một lỗi | `completion-contract.js` | ✅ Đã có `recordStepGap` (`SWAP_CORE` → `STALLED`) |
| 4 | Không có lớp quyền: mọi lệnh agent phát ra đều chạy | `policy.js`, `agent-mesh.js` | ✅ Đã có `decide()` + Approval Gate |
| 5 | Failover 429 có thể nhảy sang API trả tiền | `model-discovery.js` | ✅ Chỉ quét model free / local CLI |

### 1.2 Phạm vi
- **Trong phạm vi:**
  - Hợp đồng hoàn thành `CompletionContract` (append-only tối đa 16 tiêu chí, `mutation_epoch`, `recordStepGap`).
  - Động cơ chính sách `policy.js` (`decide()`, `isHardRefuseCommand()`, `plan` / `default` / `auto`, `yolo`, `killSwitch`).
  - Cầu nối kiểm tra trạng thái đăng nhập 0-API-Key (`getZeroKeyAuthStatus()` trong `src/core/auth-bridge.js`).
- **Ngoài phạm vi:**
  - Cơ chế xoay vòng nhiều tài khoản OAuth cùng một nhà cung cấp (thuộc [`SPEC-ARENA` §2](07-orca-arena-accounts-ratchet-awake.md)).

## 2. Completion contract + validator độc lập (Neko)
- Khi tạo goal: sinh tối đa **16 tiêu chí** `{id, requirement, check?}`. Tiêu chí **chỉ được thêm** (append-only), không sửa/xoá; trùng `id` sẽ ném lỗi.
- Verdict `complete` ⇔ mọi tiêu chí pass ở đúng `currentMutationEpoch`.
- `evaluate()` trả một trong: `complete`, `outcome_unverified` (không có tiêu chí lẫn `acceptance_cmd`), `validation_missing` (có diff mới khiến `mutation_epoch` thay đổi nhưng chưa validate lại), `validation_failed`.
- **`mutation_epoch`** = mã băm `SHA-256` (16 ký tự hex đầu) của nội dung `git diff HEAD`.

## 3. Chống lặp / không tiến triển (Neko)
- `gap_signature = sha256(sorted failing ids + mutation_epoch)` lưu mỗi step qua `recordStepGap(failingIds, mutationEpoch)`.
- 2 step liên tiếp cùng chữ ký ⇒ trả `SWAP_CORE` (đổi core); 3 step liên tiếp cùng chữ ký ⇒ trả `STALLED`.

## 4. Policy quyền (`src/core/policy.js`) — hàm thuần (GrokBot + Neko)
```js
decide({ mode, yolo, action, command, path, grants, killSwitch }) // → 'allow' | 'ask' | 'refused'
```
| Lớp | Quy tắc | Nguồn |
|---|---|---|
| Hard refuse (mọi mode, kể cả `yolo: true`) | `rm -rf /`, `rm -rf ~`, `format C:`, `rd /s C:\`, `mkfs`, `dd of=/dev/*`, fork bomb, đọc/ghi file credential (`~/.codex/auth.json`, `~/.claude/.credentials.json`, `.env`, `~/.ssh`) | Neko `dangerousCommand`, `read-policy` |
| Ask once (kể cả `auto` khi `yolo: false`) | `rm -r/-f`, `git reset --hard`, `git clean -f`, `git push --force`, `curl … \| sh`, `sudo`, ghi `.git/hooks`/`.git/config` | Neko `destructiveInWorkspace`, GrokBot protected paths |
| Mode | `plan` (chỉ đọc `read` → `allow`; `write`/`exec` → `ask`) · `default` (`read`/`write` → `allow`; `exec` → `ask`) · `auto` (`allow` trừ 2 lớp trên); `yolo` chỉ mở lớp Ask-once khi đang ở `auto` | Neko `permissions.ts` |
| Kill-switch | `killSwitch === true` hoặc `{ isOn: false }` ⇒ trả `'refused'` cho mọi lệnh thực thi (fail-closed) | GrokBot `local-computer-use-gate.json` |

## 5. Auth 0-key & failover an toàn (`src/core/auth-bridge.js`)
| Cải tiến | Nguồn |
|---|---|
| Chỉ đọc *trạng thái đăng nhập* (`getZeroKeyAuthStatus()`), không chép token giữa CLI và không bao giờ ném lỗi nếu file chưa tồn tại | Neko README |
| `allow_paid_fallback = false`: không tự động rơi sang API trả phí khi hết model miễn phí | Neko provider routes |

## 6. Kế thừa Pack & Yêu cầu chuẩn EARS (`VERIFY-Rnn`)

### 6.1 Kế thừa từ Pack (`PK-AGENT`, `PK-AUTH`)

| REQ dự án | Kế thừa từ Pack | Tham số / Giá trị áp dụng tại BotAutoTask |
|---|---|---|
| `VERIFY-R01` | `PK-AGENT-R01` | `{hard-refuse-policy} = src/core/policy.js`; từ chối cứng ở mọi mode kể cả `yolo: true` |
| `VERIFY-R04` | `PK-AGENT-R03` | Chống lặp vô hạn bằng `gap_signature`: lần 2 → `SWAP_CORE`, lần 3 → `STALLED` |
| `VERIFY-R05` | `PK-AUTH-R07`, `PK-AGENT-R05` | `{allow-paid-fallback} = false`; `getZeroKeyAuthStatus()` không trả hoặc log giá trị token |

### 6.2 Bảng Yêu cầu (EARS)

| ID | Mức | Yêu cầu (EARS) | Bằng chứng (`As-built`) |
|---|---|---|---|
| `VERIFY-R01` | MUST | Khi gọi `policy.decide()`, nếu `command` hoặc `path` khớp danh sách `HARD_REFUSE_PATTERNS` (`rm -rf /`, `format c:`, `~/.ssh/*`, `~/.codex/auth.json`, `~/.claude/.credentials.json`, `.env`) hoặc `killSwitch` đang kích hoạt, hệ thống MUST trả về `'refused'` bất kể `mode` hay `yolo`. | `src/core/policy.js:8-65`, `tests/policy-and-contract.test.js` |
| `VERIFY-R02` | MUST | Trong chế độ `mode: 'plan'`, `policy.decide()` MUST chỉ trả `'allow'` cho `action: 'read'` và trả `'ask'` cho mọi thao tác `write` hoặc `exec`; với các lệnh phá huỷ cục bộ (`git push --force`, `git reset --hard`) ở `mode: 'auto', yolo: false`, hệ thống MUST trả `'ask'` trừ khi lệnh đó đã nằm trong `grants`. | `src/core/policy.js:67-101`, `tests/policy-and-contract.test.js` |
| `VERIFY-R03` | MUST | `CompletionContract` MUST chỉ cho phép thêm tiêu chí mới (tối đa `16` tiêu chí, trùng `id` phải ném lỗi); khi đánh giá `evaluate()`, nếu không có tiêu chí lẫn `acceptance_cmd` thì MUST trả `verdict: 'outcome_unverified'`, và nếu `epoch` của kết quả khác `currentMutationEpoch` thì MUST trả `verdict: 'validation_missing'`. | `src/core/completion-contract.js:10-65`, `tests/policy-and-contract.test.js` |
| `VERIFY-R04` | MUST | Khi cùng một tập tiêu chí thất bại lặp lại ở cùng một `mutation_epoch`, `CompletionContract.recordStepGap()` MUST trả `PROGRESSING` ở lần 1, `SWAP_CORE` ở lần 2 liên tiếp, và `STALLED` ở lần 3 liên tiếp. | `src/core/completion-contract.js:67-95`, `tests/policy-and-contract.test.js` |
| `VERIFY-R05` | MUST | Khi kiểm tra trạng thái đăng nhập qua `getZeroKeyAuthStatus()`, hệ thống MUST trả về trạng thái sẵn sàng của từng nhà cung cấp (`codex`, `claude`, `opencode`, `antigravity`) mà không làm lộ chuỗi token gốc và không ném lỗi khi thiếu file cấu hình. | `src/core/auth-bridge.js:1-120`, `tests/agent-mesh-and-auth.test.js` |

## 7. Yêu cầu phi chức năng (NFR)

| Khía cạnh | Yêu cầu (số liệu) hoặc `N/A — lý do` |
|---|---|
| Hiệu năng | `decide()` và `CompletionContract.evaluate()` là hàm thuần trong bộ nhớ, thời gian chạy `< 1 ms`. |
| Bảo mật | Fail-closed khi `killSwitch` bật hoặc hỏng; cấm tuyệt đối bypass `HARD_REFUSE_PATTERNS`. |
| Giới hạn / rate limit | Tối đa `16` tiêu chí mỗi `CompletionContract`; tối đa `3` bước lặp cùng `gap_signature` trước khi `STALLED`. |
| Khả dụng / khôi phục | `getZeroKeyAuthStatus()` luôn bắt lỗi đọc file để trả `{ ready: false }` thay vì làm sập CLI. |
| Quan sát (log, metric, audit) | Mỗi lần đánh giá contract trả danh sách rõ ràng các tiêu chí chưa đạt (`missing` / `failed`). |
| i18n | `N/A — các mã verdict và policy decision dùng hằng số tiếng Anh chuẩn`. |
| a11y | `N/A — module logic lõi không có giao diện`. |
| Trạng thái UI | `N/A — hiển thị qua SPEC-UI và SPEC-SAFE`. |

## 8. Trường hợp biên (Edge Cases)

- Bật cả `mode: 'auto'` và `yolo: true` nhưng agent phát lệnh `rm -rf /` hoặc đọc `~/.ssh/id_rsa` → vẫn trả `'refused'` (`VERIFY-AC01`).
- Thêm tiêu chí trùng `id: 'c1'` vào `CompletionContract` → ném `Error` ngay lập tức (`VERIFY-AC02`).
- Tất cả tiêu chí đều `passed: true` ở `epochA`, nhưng sau đó agent sửa thêm 1 dòng code làm chuyển sang `epochB` → `evaluate()` trả `validation_missing`, buộc phải chạy kiểm chứng lại (`VERIFY-AC02`).

## 9. Điều kiện nghiệm thu (`AC`)

- [x] **VERIFY-AC01** *(unit)* — **Cho** các tổ hợp `mode` (`plan`, `default`, `auto`), `yolo` (`true`/`false`), `grants` và `killSwitch`, **khi** gọi `decide()` với lệnh cấm (`rm -rf /`, `format c:`, `~/.ssh/id_rsa`), lệnh nguy hiểm (`git push --force`) và lệnh thường, **thì** lệnh cấm luôn trả `'refused'`, `killSwitch` luôn trả `'refused'`, và `git push --force` trả `'ask'` khi `yolo: false`. *(Test: `tests/policy-and-contract.test.js`)*
- [x] **VERIFY-AC02** *(unit)* — **Cho** một `CompletionContract`, **khi** kiểm tra contract rỗng, thêm trùng `id`, đổi `currentMutationEpoch` sau khi pass, và gọi `recordStepGap()` 3 lần liên tiếp cùng lỗi, **thì** lần lượt nhận `outcome_unverified`, ném lỗi trùng `id`, trả `validation_missing`, và chuyển trạng thái `PROGRESSING → SWAP_CORE → STALLED`. *(Test: `tests/policy-and-contract.test.js`)*
- [x] **VERIFY-AC03** *(unit)* — **Cho** môi trường máy tính bất kỳ, **khi** gọi `getZeroKeyAuthStatus()`, **thì** hàm trả về đối tượng chứa các khoá `codex`, `claude`, `opencode`, `antigravity` mà không ném ngoại lệ. *(Test: `tests/agent-mesh-and-auth.test.js`)*

## 10. Kiểm tra end-to-end

```powershell
node --test tests/policy-and-contract.test.js tests/agent-mesh-and-auth.test.js
```

## 11. Làm rõ & Câu hỏi mở

- **Làm rõ (2026-10-20):** Việc nối `policy.decide()` vào cổng duyệt `MergeAgentWorktree` và chặn lỗi auto-pass (`COMPLETED_UNVERIFIED`) trên cả `GoalOrchestrator` lẫn `SupervisorLoop` đã hoàn tất trong [`SPEC-SAFE`](08-mesh-safety-attention-ui.md).
- **Câu hỏi mở:** Không có.
