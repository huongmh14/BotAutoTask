# Spec 05 — Closed-Loop Verification, Permission Policy & Auth/Failover An Toàn

| Mục | Giá trị |
|---|---|
| Trạng thái | 📝 Spec mới (tổng hợp từ Neko Core + GrokBot) |
| Module | `src/core/completion-contract.js`, `src/core/policy.js`, sửa `orchestrator.js`, `supervisor.js`, `auth-bridge.js`, `model-discovery.js` |

## 1. Vấn đề hiện tại
| # | Vấn đề | Vị trí |
|---|---|---|
| 1 | Không có `acceptance_cmd` ⇒ coi như **pass** | `orchestrator.js` `_verifyAcceptance` |
| 2 | Không có trạng thái "đã sửa code nhưng chưa kiểm chứng" | `orchestrator.js`, `supervisor.js` |
| 3 | Lặp vô ích tới hết `max_steps` khi model kẹt | `orchestrator.js` |
| 4 | Không có lớp quyền: mọi lệnh agent phát ra đều chạy | `spawn-cli.js`, `agent-mesh.js` |
| 5 | Failover 429 có thể nhảy từ gói subscription/free sang API trả tiền | `model-discovery.js` |
| 6 | Failover gửi lại prompt có thể tạo thao tác đôi | `orchestrator.js` |

## 2. Completion contract + validator độc lập (Neko)
- Khi tạo goal: một core (chỉ đọc) sinh tối đa **16 tiêu chí** `{id, requirement, check?}` → lưu `goals.contract_json`. Tiêu chí **chỉ được thêm**, không sửa/xoá; tiêu chí vừa thêm không thể pass trong cùng lượt review.
- Verdict `pass` ⇔ mọi tiêu chí pass **và** `coverageComplete`.
- **Validator chạy trên harness khác worker** (worker opencode-free → validator codex/claude hoặc model khác). Tool cho phép: đọc file, `git diff`, `acceptance_cmd`, bash foreground ≤30s. Implementer chỉ nhận *gap* `{criterionId, outcome}`, không nhận lệnh test.
- `completionStatus()` trả một trong: `complete`, `validation_missing` (có diff nhưng chưa validate ở epoch hiện tại), `validation_failed`, `contract_failed`, `failed_checks_unresolved`.
- **`mutation_epoch`** = hash của `git diff HEAD` (hoặc sha commit). Kết quả validate chỉ có giá trị khi cùng epoch.
- Không có contract lẫn `acceptance_cmd` ⇒ trạng thái `outcome_unverified` (không còn tự pass).

## 3. Chống lặp / không tiến triển (Neko)
- `gap_signature = sha256(sorted failing ids + mutation_epoch)` lưu mỗi step.
- 2 step liên tiếp cùng chữ ký ⇒ **đổi core** (dùng cơ chế failover sẵn có); lần nữa ⇒ `STALLED`, báo điện thoại.
- Chạm `max_steps` = `MAX_STEPS_REACHED`, **không bao giờ** được hiển thị như hoàn thành.

## 4. Policy quyền (`policy.js`) — hàm thuần (GrokBot + Neko)
```js
decide({ mode, yolo, action, grants, killSwitch }) → 'allow' | 'ask' | 'refused'
```
| Lớp | Quy tắc | Nguồn |
|---|---|---|
| Hard refuse (mọi mode, kể cả yolo) | `rm -rf /`, `rm -rf ~`, `format C:`, `rd /s C:\`, `mkfs`, `dd of=/dev/*`, fork bomb, đọc/ghi file credential (`~/.codex/auth.json`, `~/.claude/.credentials.json`, `.env`, `~/.ssh`) | Neko `dangerousCommand`, `read-policy` |
| Ask once (kể cả auto) | `rm -r/-f`, `git reset --hard`, `git clean -f`, `git push --force`, `curl … \| sh`, `sudo`, ghi `.git/hooks`/`.git/config` | Neko `destructiveInWorkspace`, GrokBot protected paths |
| Mode | `plan` (chỉ đọc) · `default` (sửa file trong workspace, shell hỏi) · `auto` (chạy không hỏi trừ 2 lớp trên); `yolo` là cờ riêng, chỉ có hiệu lực trong `auto` | Neko `permissions.ts` |
| Mức hiệu lực | `min(lựa chọn, trần)` với `never < ask < always`; approval dùng **một lần**; standing grant lưu `~/.botautotask/grants.json` | GrokBot permission model |
| Kill-switch | `~/.botautotask/kill-switch.json {isOn}` — thiếu hoặc hỏng ⇒ coi như **tắt** tool nguy hiểm (fail-closed) | GrokBot `local-computer-use-gate.json` |
| Subagent | `permission_mode: default \| readonly \| agent_only` theo agent | GrokBot `CustomSubagentPermissionMode` |

`ask` khi chạy không người: tạo `approvals` (Spec 02) → điện thoại; **hết hạn = deny**; không xếp hàng khi PC offline.

## 5. Auth 0-key & failover an toàn
| Cải tiến | Nguồn |
|---|---|
| Mỗi core gắn nhãn `route: "subscription" \| "free" \| "api"`; failover **không** nhảy sang `api` trả tiền nếu `allow_paid_fallback` chưa bật | Neko provider routes ("không âm thầm fallback") |
| Ưu tiên để mỗi CLI tự giữ OAuth của nó; chỉ đọc *trạng thái đăng nhập*, không chép token giữa CLI | Neko README |
| Refresh token **single-flight** + `epoch` (huỷ kết quả refresh sau khi đăng xuất), deadline 20s, refresh khi còn <5 phút | GrokBot auth (report §4) |
| Secret của BotAutoTask (relay token…) lưu bằng DPAPI (PowerShell `ProtectedData`) trên Windows, không có thì chỉ giữ RAM | GrokBot `safeStorage` |
| Mỗi prompt một `clientNonce`; failover 429 gửi lại **cùng nonce**, journal `queued→dispatching→accepted→acked/failed/timeout` | GrokBot idempotent prompt |
| Resume sau crash: step đang `running` ⇒ `outcome: UNKNOWN`, agent phải kiểm tra `git status` trước khi tiếp | Neko `sealDanglingToolCalls` |

## 6. Tiêu chí chấp nhận
- [ ] Goal không có contract/acceptance kết thúc ở `outcome_unverified`, không phải `COMPLETED`.
- [ ] Sửa file sau lần validate pass ⇒ trạng thái quay về `validation_missing`.
- [ ] 2 step cùng `gap_signature` ⇒ đổi core; lần 3 ⇒ `STALLED`.
- [ ] `decide()` với `rm -rf /` trả `refused` ở mọi mode kể cả `yolo`; `git push --force` trả `ask` ở `auto`.
- [ ] Kill-switch file hỏng ⇒ tool nguy hiểm bị chặn.
- [ ] Không có core free/subscription rảnh và `allow_paid_fallback=false` ⇒ `PAUSED_LIMIT`, không gọi API trả tiền.

## 7. Test tối thiểu
`tests/policy.test.js` (bảng case thuần, không I/O), `tests/completion-contract.test.js` (append-only, epoch, no-progress) — bằng `node:test`.
