# Research Findings: Stably AI Orca (`stablyai/orca` v1.4.214)

**Repository:** [https://github.com/stablyai/orca](https://github.com/stablyai/orca)
**License:** MIT
**Tagline:** *"The AI Orchestrator for 100x builders —Agent Development Environment (ADE)"*

---

## 1. Tổng Quan Kiến Trúc Của Orca

Orca là một **Agent Development Environment (ADE)** mã nguồn mở được xây dựng bằng **Electron + Node.js + Headless Daemon (`orcad`)**, đóng vai trò mặt phẳng điều phối (control plane) cho nhiều CLI Coding Agents chạy song song trên các Git Worktree cô lập.

Cấu trúc thư mục chính (`src/`):
- `src/main/`: Tiến trình chính điều phối Agent, quản lý tài khoản OAuth, Git Worktree, Agent Hooks, Browser Sidecar, và SSH/WSL relay.
- `src/packages/`: Các gói dùng chung (RPC catalog, Agent Communication Protocol - ACP).
- `src/cli/` & `orcad`: Daemon chạy ngầm độc lập với giao diện (`build:orcad`), cho phép kết nối từ Desktop, SSH/WSL (`src/wsl-guest`), hoặc ứng dụng Mobile Companion (iOS/Android).
- `src/renderer/`: Giao diện đa khung (multi-pane) (tiling terminal + chat UI + diff viewer + embedded browser).
- `src/shared/`: Định nghĩa giao thức, trạng thái phiên làm việc, kiểu dữ liệu quyền hạn (`agent-chat-permission-mode.ts`, `agent-workspace-trust.ts`).

---

## 2. 8 Cơ Chế Đắt Giá Nhất Trong `stablyai/orca`

### 2.1. Parallel Worktree Fan-Out ("Arena Mode" — Phân Tán 1 Prompt Cho N Agent)
- **Cách Orca hoạt động:** Thay vì chỉ chạy tuần tự hoặc chia việc thủ công, Orca cho phép **Fan-out cùng 1 prompt** tới $N$ Agent khác nhau (ví dụ: `Codex` + `Claude Code` + `OpenCode` + `Antigravity`), mỗi Agent tự động nhận một **Git Worktree riêng** (`check-worktree-id-composer-ratchet.mjs`).
- **Kết quả:** Người dùng xem Diff song song của từng Agent, chạy kiểm thử độc lập trên từng Worktree và bấm **"Merge the Winner"** để gộp nhánh tốt nhất vào nhánh chính.

### 2.2. Universal Agent Hook Listener (`agent-hook-listener-*.ts`)
Thay vì chỉ đọc `stdout` bị động từ tiến trình con, Orca tiêm các **Lifecycle Hooks** vào từng loại Agent thông qua một local endpoint (`agent-hook-endpoint-file.ts`):
- `agent-hook-listener-antigravity.ts`: Bắt sự kiện trực tiếp từ Antigravity.
- `agent-hook-listener-claude.ts` & `agent-hook-listener-claude-subagents.ts` & `agent-hook-listener-claude-task-notification.ts`: Theo dõi vòng đời turn, subagent được sinh ra, và thông báo hoàn thành tác vụ của Claude Code.
- `agent-hook-listener-codex.ts` & `agent-hook-codex-approval-ownership.ts`: Quản lý quyền phê duyệt lệnh (approval ownership) và ngắt turn (`agent-hook-interrupt-reconciliation.ts`).
- `agent-hook-listener-opencode.ts`: Bắt trạng thái thực thi của OpenCode.
- `agent-hook-cancel-verdict-latch.ts`: Chốt chặn hủy lệnh an toàn (latch) khi người dùng bấm Interrupt/Cancel giữa chừng.

### 2.3. Multi-Account OAuth Pool & Quota Tracking (`*-accounts` & `*-usage`)
Trong `src/main/`:
- Có các module chuyên biệt: `claude-accounts/`, `claude-usage/`, `codex-accounts/`, `codex-usage/`, và `account-runtime-capabilities.ts`.
- **Giá trị:** Cho phép đăng nhập **nhiều tài khoản OAuth 0-API-Key** cho cùng một hãng (ví dụ 3 tài khoản ChatGPT Plus/Pro cho Codex, 2 tài khoản Claude). Khi tài khoản 1 chạm ngưỡng 5-hour/weekly quota hoặc dính `429`, hệ thống tự động xoay vòng (rotate) sang tài khoản OAuth số 2 mà không cần đổi loại mô hình nếu người dùng vẫn muốn giữ nguyên chất lượng của Codex/Claude.

### 2.4. Headless Daemon (`orcad`) & Typed RPC Catalog
- Orca tách rời hoàn toàn bộ máy thực thi (`orcad`) khỏi lớp hiển thị Electron.
- Giao tiếp qua danh mục RPC định kiểu nghiêm ngặt (`scripts/verify-rpc-params-catalog.mjs`) và giao thức ACP (`src/main/acp`).
- Nhờ đó, phiên chạy Agent không bị chết khi tắt cửa sổ UI, và có thể điều khiển qua SSH, WSL2 (`src/wsl-guest`), hoặc điện thoại.

### 2.5. Agent Awake Service (`agent-awake-service.ts` & `agent-awake-status-lease.ts`)
- Quản lý **Power Assertion Lease** theo trạng thái thực thi thực tế của các Agent.
- Khi có ít nhất 1 Agent đang ở trạng thái `RUNNING` (giữ lease), dịch vụ sẽ ngăn hệ điều hành (Windows/macOS/Linux) rơi vào trạng thái Sleep/Hibernate làm đứt kết nối mạng hoặc treo tiến trình con. Khi mọi Agent về `IDLE`, lease tự giải phóng để tiết kiệm pin.

### 2.6. Design Mode — Trình Duyệt Nhúng Chọn Phần Tử DOM (`src/main/browser`)
- Tích hợp `browser-sidecar-owner.ts` ngay bên cạnh Agent.
- Khi phát triển Frontend, người dùng mở trang web local ngay trong Orca, click vào bất kỳ phần tử UI nào: Orca tự động trích xuất **HTML + Computed CSS + Ảnh chụp cắt vùng (cropped screenshot)** của phần tử đó và đính kèm thẳng vào prompt của Agent.

### 2.7. Workspace Trust & Write Deadline (`agent-workspace-trust.ts`)
- Áp dụng cơ chế kiểm soát quyền theo từng thư mục (`agent-trust-presets.ts`, `agent-trust-spawn-guard.ts`) và giới hạn thời gian ghi (`agent-trust-write-deadline.ts`), ngăn Agent tự ý ghi file sau khi turn đã bị thu hồi quyền hoặc hết hạn.

### 2.8. Kỷ Luật "Ratchet" Chống Suy Thoái Code Do AI Viết (`package.json`)
Orca dùng các script kiểm tra tự động dạng **Ratchet (bánh cóc — chỉ cho phép giảm lỗi, cấm tăng thêm)** trong CI:
- `check:max-lines-ratchet`: Cấm các file code phình to quá giới hạn dòng quy định.
- `check:ts-nocheck-ratchet`: Cấm AI thêm `@ts-nocheck` để lách lỗi biên dịch.
- `check:worktree-id-composer-ratchet`: Đảm bảo tính toàn vẹn định danh Worktree.
- `check:reliability-gates`: Kiểm tra các cổng an toàn trước khi merge.

---

## 3. So Sánh Trực Tiếp: `stablyai/orca` vs. `BotAutoTask v2`

| Tiêu chí | `stablyai/orca` (v1.4.214) | `BotAutoTask v2` (Hiện tại) | Đánh giá & Cơ hội học hỏi |
| :--- | :--- | :--- | :--- |
| **Triết lý vận hành** | **ADE cho con người điều khiển trực tiếp** (IDE đa cửa sổ, người dùng tự gõ lệnh hoặc duyệt từng tab). | **Autonomous Supervisor + Coworker Mesh 24/7** (Giao 1 Goal lớn, Supervisor tự kiểm tra `--check`, tự sửa lỗi, tự đẩy lên Cloud/GitHub Actions khi tắt PC). | **BotAutoTask** mạnh hơn ở khả năng *tự hành khép kín (Supervisor Loop + Cloud 24/7)*; **Orca** mạnh hơn ở *công cụ tương tác trực tiếp & quản lý phiên CLI*. |
| **Độ nặng (Footprint)** | Rất nặng (Electron, React, `node-pty`, hàng chục dependencies). | **Zero-dependency Node.js** + 1 file Cloudflare Worker siêu nhẹ. | Giữ nguyên kiến trúc Zero-dependency gọn nhẹ của BotAutoTask. |
| **Git Worktree** | Hỗ trợ **Fan-out 1 Prompt -> N Agents** để so sánh kết quả và chọn bản thắng cuộc. | Đã có `WorktreeManager` (`src/core/worktree-manager.js`) cô lập từng Agent theo nhánh `botautotask/agent-<id>`. | **Nên học Orca:** Thêm chế độ **Arena / Fan-Out Mode** (`botautotask arena` hoặc nút Fan-Out trên UI) giao cùng 1 task cho 2-3 lõi (VD: `codex` vs `opencode`), lõi nào pass `--check` nhanh nhất và diff gọn nhất thì auto-merge! |
| **Quản lý Rate Limit / 0-API-Key** | **Multi-Account Pool** (`codex-accounts`, `claude-accounts`) xoay vòng nhiều tài khoản OAuth cùng hãng + đo % quota còn lại. | Đổi sang lõi AI khác (`codex` -> `opencode` -> `antigravity`) khi gặp lỗi `429`. | **Nên học Orca:** Hỗ trợ lưu **nhiều profile OAuth** (`~/.botautotask/accounts/codex-*.json`) để xoay vòng nhiều tài khoản ChatGPT/Claude trước khi phải hạ cấp xuống model khác. |
| **Giao tiếp với Agent con** | **Universal Agent Hooks** (`agent-hook-listener-*.ts`) tiêm hook vào Claude/Codex/OpenCode/Antigravity để bắt sự kiện tức thì. | Đọc `stdout` JSON stream + theo dõi file `transcript.jsonl` + MCP Loopback (`src/core/agent-mesh.js`). | **Nên học Orca:** Bổ sung `agent-hook-listener` nhẹ (qua HTTP endpoint của `agent-mesh.js`) để bắt chính xác thời điểm Agent bắt đầu/kết thúc tool call và trạng thái chờ duyệt lệnh. |
| **Chống ngủ máy (OS Sleep)** | `agent-awake-service.ts` giữ máy thức bằng lease khi Agent đang chạy. | Chưa có (nếu Windows tự Sleep sau 15 phút không chạm chuột, LocalDaemon sẽ ngừng và bàn giao lên Cloud). | **Nên học Orca:** Thêm module `AwakeLease` siêu gọn (dùng PowerShell `SetThreadExecutionState` trên Windows / `caffeinate` trên macOS) giữ PC thức khi đang chạy Goal dài. |
| **Kiểm soát chất lượng Code** | Bộ script **Ratchet Gates** (`max-lines-ratchet`, `ts-nocheck-ratchet`) kết hợp với `CONSTRAINTS.md`. | `CompletionContract` (`src/core/completion-contract.js`) đã có class nhưng **chưa được gọi trong runtime**; orchestrator còn auto-pass khi thiếu `acceptance_cmd`. | **Nên học Orca:** Tích hợp kiểm tra **Ratchet** vào `completion-contract.js` (cấm Agent xóa test cũ, cấm thêm `@ts-ignore`/`eslint-disable`, giới hạn số dòng mỗi file). |

---

## 4. Đề Xuất Nâng Cấp Thực Tế Cho `BotAutoTask v2` Từ Nghiên Cứu Orca

Từ mã nguồn của `stablyai/orca`, có **4 tính năng thực chiến, cực kỳ hợp với triết lý Zero-Dependency** mà chúng ta có thể tích hợp thẳng vào `BotAutoTask`:

1. **Arena Fan-Out Mode (`src/core/arena-runner.js` + Nút trên Web UI):**
   - Giao cùng 1 nhiệm vụ cho $N$ Agent chạy song song trên $N$ Git Worktree (`codex`, `opencode`, `claude`).
   - Tự động chạy lệnh `--check` và chấm điểm (`CompletionContract` + độ gọn của Diff).
   - Tự động merge nhánh thắng cuộc (hoặc hiển thị bảng so sánh Diff trên Web UI để bạn bấm 1 nút chọn).
2. **Multi-Account OAuth Pool (`src/core/account-pool.js`):**
   - Cho phép lưu nhiều phiên đăng nhập `codex` / `claude` (xoay vòng `~/.codex/auth.json` hoặc biến môi trường `CODEX_HOME` riêng cho từng tài khoản). Khi tài khoản A hết quota, tự động chuyển sang tài khoản B trong 1 giây.
3. **OS Awake Lease (`src/core/awake-lease.js`):**
   - Tự động ngăn Windows Sleep trong lúc `BotAutoTask` đang thực thi nhiệm vụ dài ở máy local, và tự nhả khóa ngay khi nhiệm vụ hoàn tất (`DONE`/`FAILED`).
4. **Code Quality Ratchet trong `CompletionContract`:**
   - Nâng cấp `src/core/completion-contract.js` để quét `git diff`: chặn đứng việc AI Agent tự ý xóa test sẵn có, thêm `@ts-ignore` / `# type: ignore` / `eslint-disable`, hoặc tạo file rác vượt quá số dòng quy định.
