# BotAutoTask v2.0 — Danh mục Đặc tả & Bản đồ Năng lực (`docs/feature/`)

> Base: `writing-spec-for-ai v1.2.1` · Profile: `M` · Pack: `PK-API, PK-AUTH, PK-RELEASE, PK-DB, PK-FE, PK-JOB, PK-AGENT`
> Nguồn sự thật về yêu cầu (`REQ`) và điều kiện nghiệm thu (`AC`). Quyết định ở [`../decisions.md`](../decisions.md), thuật ngữ ở [`../glossary.md`](../glossary.md), sàn chất lượng ở [`../../CONSTRAINTS.md`](../../CONSTRAINTS.md), tiến độ ở [`../progress.md`](../progress.md).

## 1. Quy ước

- **Hệ ID (`C04`):** Spec `SPEC-<KHU-VỰC>`; yêu cầu `<KHU-VỰC>-R<số>`; nghiệm thu `<KHU-VỰC>-AC<số>`. Không đánh số lại; bỏ thì ghi `deprecated`.
- **Mức:** **MUST**, **SHOULD** (lệch phải ghi lý do), **MAY**.
- **Nghiệm thu (`C05`, `C19`):** Mẫu *Cho / Khi / Thì* kèm tầng test (`*(unit)*`, `*(integration)*`, `*(contract)*`, `*(e2e)*`). `[x]` khi có test tự động xanh trong `tests/*.test.js`; `[~]` khi phụ thuộc hạ tầng ngoài (Cloudflare/Telegram thật), kèm lý do và cách đóng.
- **Template:** Dùng [`_template.md`](_template.md) khi tạo spec mới.

## 2. Quyền của AI theo trạng thái Spec (`C03`, `C10`)

| Trạng thái | AI được làm | AI không được làm |
|---|---|---|
| `Draft` | Đọc, chỉ chỗ thiếu/mâu thuẫn/mơ hồ, đề xuất phương án kèm đánh đổi, viết AC | **Viết code triển khai**; tự chọn phương án thay người dùng |
| `Ready` | Lập plan (`plan-tasks`), chia PR, chuẩn bị migration, viết test theo AC | Đổi nội dung spec trong lúc làm |
| `In progress` | Viết code + test, đánh `[x]` AC khi `npm test` xanh, báo blocker | Lệch khỏi spec mà không nói; thêm chức năng "nhân tiện" |
| `Done` | Sửa lỗi đã xác nhận, đúng hành vi spec mô tả | Đổi hành vi khi chưa cập nhật spec / `CHG-xx` được duyệt |
| `As-built` | Ghi bằng chứng (`file:dòng`, tên test), nêu hành vi đáng ngờ vào câu hỏi mở | Coi mọi dòng code hiện có là chuẩn; tự ý đổi hành vi khi chưa hỏi |

- Được yêu cầu code cho phần `Draft`: dừng lại báo phần đó đang `Draft`, hỏi người dùng có duyệt chuyển sang `Ready` không.
- **Ngoại lệ Hotfix (`C10`):** Hotfix sản xuất được sửa code trước nhưng bắt buộc cập nhật spec trong **≤ 1 ngày làm việc**; trong thời gian chờ phải ghi nợ vào [`../progress.md`](../progress.md) (`Còn dở: nợ spec <SPEC-X>`).

## 3. Tài liệu phải sửa theo loại thay đổi (`C11`, `C20`)

Sửa trong **cùng PR / commit** với code:

| Loại thay đổi | File bắt buộc phải sửa |
|---|---|
| Sửa bất kỳ file nào trong `src/` | Chạy `node scripts/build-single-file.js` để cập nhật [`../../dist/botautotask.mjs`](../../dist/botautotask.mjs) (`PK-RELEASE-R06`) |
| Feature mới / Khu vực mới | Tạo spec mới trong `docs/feature/` + thêm dòng vào bảng **Capability Map** bên dưới |
| Đổi hành vi của spec `Ready` / `Done` | Cập nhật REQ/AC trong spec tương ứng + ghi chú lý do |
| Contract công khai (endpoint HTTP/SSE, CLI, mã lỗi/trạng thái) | Spec liên quan + [`../reference/status-codes.md`](../reference/status-codes.md) |
| Schema D1 (`cloud-core/`) | [`02-mobile-cloud-control.md`](02-mobile-cloud-control.md) + `cloud-core/schema.sql` + `cloud-core/migrations/000N_*.sql` (`PK-DB-R01`) |
| Biến môi trường / cấu hình | [`../reference/config.md`](../reference/config.md) + [`../../.env.example`](../../.env.example) (`C16`, `PK-RELEASE-R01`) |
| Breaking change / Phát hành tag `v*` | [`../changelog/`](../changelog/) (`PK-RELEASE-R04`) |
| Quyết định kiến trúc | [`../decisions.md`](../decisions.md) (`D-xx`) |
| Khuôn mẫu code / ngưỡng chất lượng / gotcha test | [`../../AGENTS.md`](../../AGENTS.md), [`../../CONSTRAINTS.md`](../../CONSTRAINTS.md), hoặc [`../../.agents/skills/testing-botautotask/SKILL.md`](../../.agents/skills/testing-botautotask/SKILL.md) (`C18`) |
| **Đổi stack / công cụ build (`C20`)** | Lệnh trong `AGENTS.md` + `CONSTRAINTS.md` + `.github/workflows/` + skill dự án — trong cùng 1 PR |

## 4. Danh mục & Bản đồ Năng lực (`Capability Map`)

Chiều phụ thuộc chỉ đi một chiều (không có vòng lặp).

| ID | File | Trách nhiệm khu vực | Phụ thuộc vào (`Depends on`) | Trạng thái | Bằng chứng code & test chính |
|---|---|---|---|---|---|
| `SPEC-CORE` | [00-core-orchestrator.md](00-core-orchestrator.md) | Orchestrator, Pluggable Harnesses, FreeModelRanker, Failover 429, SupervisorLoop, LocalDaemon, NetworkMonitor | — | `As-built` | `src/core/orchestrator.js`, `src/harnesses/*`, `tests/orchestrator-failover.test.js`, `tests/model-and-limit.test.js`, `tests/supervisor-and-logs.test.js` |
| `SPEC-VERIFY` | [05-verification-policy-auth.md](05-verification-policy-auth.md) | CompletionContract, Policy Engine (`policy.js`), Zero-Key AuthBridge & Failover an toàn | `SPEC-CORE` | `As-built` | `src/core/policy.js`, `src/core/completion-contract.js`, `src/core/auth-bridge.js`, `tests/policy-and-contract.test.js` |
| `SPEC-SEC` | [09-security-threat-model.md](09-security-threat-model.md) | Phân loại 5 loại Token, Threat Model (STRIDE), Ranh giới tin cậy & chống Prompt Injection | `SPEC-VERIFY` | `As-built` (một phần) + `Draft` | `cloud-core/worker.js`, `src/daemon/web-ui.js`, `src/core/policy.js`, `tests/worker-auth.test.js` |
| `SPEC-MESH` | [03-git-worktree-parallel.md](03-git-worktree-parallel.md) | AgentMesh v2, Loopback HTTP MCP Bridge, Delivery Modes (`send`/`interrupt`/`queue`), `WorktreeManager` | `SPEC-CORE`, `SPEC-VERIFY` | `As-built` | `src/core/agent-mesh.js`, `src/core/worktree-manager.js`, `tests/agent-mesh-v2.test.js`, `tests/worktree-manager.test.js` |
| `SPEC-H2` | [04-harness2-integration.md](04-harness2-integration.md) | Google Research Harness² Surface Tree, Path Validation, Autotriggers & Experience Library (`{cue, lesson, evidence}`) | `SPEC-CORE` | `As-built` (Library) + `Draft` (Propose-Probe) | `src/core/harness2-engine.js`, `tests/policy-and-contract.test.js` |
| `SPEC-UI` | [01-web-mobile-ui.md](01-web-mobile-ui.md) | Local Web UI (`127.0.0.1`), SSE Frame Protocol + Replay (`Last-Event-ID`), Nonce Idempotency, Mobile PWA | `SPEC-CORE`, `SPEC-MESH` | `As-built` | `src/daemon/web-ui.js`, `src/ui/dashboard-html.js`, `tests/web-ui.test.js` |
| `SPEC-SAFE` | [08-mesh-safety-attention-ui.md](08-mesh-safety-attention-ui.md) | Sửa 3 lỗi nền tảng (SSE `?k=`, `MAIN_DIRTY_COLLISION`, chặn auto-pass), Peer Framing `<peer-message>`, Sliding Loop Guard, Approval Gate, Diff Modal & Attention UI | `SPEC-UI`, `SPEC-MESH`, `SPEC-VERIFY`, `SPEC-H2` | `Done` (`As-built`) | `src/core/agent-mesh.js`, `src/core/worktree-manager.js`, `src/ui/dashboard-html.js`, `tests/agent-mesh-and-auth.test.js` |
| `SPEC-CLOUD` | [02-mobile-cloud-control.md](02-mobile-cloud-control.md) | Cloudflare Worker + D1 SQLite, Atomic Lease CAS + `lease_epoch` Fencing, Telegram Bot, ntfy, GitHub Actions Fallback & DO RelayHub | `SPEC-CORE`, `SPEC-SEC` | `As-built` (D1/Lease/Telegram) + `Draft` (DO Relay E2E) | `cloud-core/worker.js`, `cloud-core/schema.sql`, `tests/lease-cas.test.js`, `tests/cloud-and-daemon.test.js`, `tests/mobile-notify.test.js` |
| `SPEC-PROVISION` | [06-cloudflare-auto-provision.md](06-cloudflare-auto-provision.md) | Tự động dựng Cloudflare Worker + D1 + Secrets bằng Playwright (Edge/Chrome) + Wrangler | `SPEC-CLOUD` | `Done` (`As-built`) | `scripts/cloud-provision.mjs`, `tests/cloud-provision.test.js` |
| `SPEC-ARENA` | [07-orca-arena-accounts-ratchet-awake.md](07-orca-arena-accounts-ratchet-awake.md) | Arena Fan-Out (2–4 lõi chấm điểm xác định), Multi-Account OAuth Pool, Ratchet Guard trên diff, Awake Lease | `SPEC-CORE`, `SPEC-MESH`, `SPEC-VERIFY`, `SPEC-SAFE` | `Draft` | Đặc tả thiết kế chi tiết cho giai đoạn tiếp theo |

**Thứ tự xây dựng & phụ thuộc (Build Order):**
`SPEC-CORE` → `SPEC-VERIFY` → `SPEC-SEC` / `SPEC-H2` / `SPEC-MESH` → `SPEC-UI` → `SPEC-SAFE` → `SPEC-CLOUD` → `SPEC-PROVISION` → `SPEC-ARENA`.

## 5. Tài liệu nghiên cứu nền tảng (`research/` & `superpowers/`)

- [`research/grokbot-findings.md`](research/grokbot-findings.md) — Reverse-engineering GrokBot `0.71.2` (frame protocol, delivery modes, lineage limits, local-exec-daemon, kill-switch).
- [`research/neko-core-findings.md`](research/neko-core-findings.md) — Phân tích Neko Core (DO relay dial-out, E2E fragment `#k=`, completion-supervisor, atomic write).
- [`research/orca-findings.md`](research/orca-findings.md) — Phân tích `stablyai/orca v1.4.214` (worktree fan-out, account pool, ratchet guard, attention buckets).
- [`../superpowers/specs/2026-10-19-botautotask-design.md`](../superpowers/specs/2026-10-19-botautotask-design.md) — Tài liệu thiết kế kiến trúc gốc (Hexagonal Pluggable Core & Dynamic Free-Model Discovery).
- [`../superpowers/plans/2026-10-19-botautotask.md`](../superpowers/plans/2026-10-19-botautotask.md) — Kế hoạch triển khai 9 tác vụ nền tảng Giai đoạn 1 (lưu trữ lịch sử).
