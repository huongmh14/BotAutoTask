# BotAutoTask v2.0 — Feature Specs

Đặc tả chi tiết từng tính năng, đã cải tiến dựa trên **reverse-engineering GrokBot 0.71.2** và **mã nguồn Neko Core**, cộng nghiên cứu **Google Research Harness²**.

```
docs/feature/
├── README.md                          # (file này) chỉ mục, trạng thái, lộ trình
├── 01-web-mobile-ui.md                # Dashboard Local + PWA: frame protocol, nonce, stale status, mirror seq
├── 02-mobile-cloud-control.md         # Điều khiển từ điện thoại: DO relay dial-out, E2E, lease CAS, approvals
├── 03-git-worktree-parallel.md        # Agent Mesh v2: delivery modes, await, lineage limits, worktree, handoff ack
├── 04-harness2-integration.md         # Harness² c1..c8, Propose–Probe–Compose, Experience Library, ngân sách k
├── 05-verification-policy-auth.md     # Completion contract, validator độc lập, policy quyền, failover an toàn
├── 06-cloudflare-auto-provision.md    # Playwright + wrangler tự dựng Cloudflare (ĐÃ TRIỂN KHAI)
├── 07-orca-arena-accounts-ratchet-awake.md # Arena fan-out, multi-account pool, ratchet guard, awake lease (từ Orca)
├── 08-mesh-safety-attention-ui.md     # Sửa 3 bug (SSE 401, merge mất dữ liệu, auto-pass) + mesh safety, approval gate, experience library, attention UI (reason-network, Orca, harness2, OpenMuse)
└── research/
    ├── grokbot-findings.md            # REA GrokBot 0.71.2 (file:dòng, nhãn Verified/Inferred)
    ├── neko-core-findings.md          # Pattern Neko Core + bug BotAutoTask phát hiện được
    └── orca-findings.md               # stablyai/orca v1.4.214: worktree fan-out, account pool, hooks, ratchet
```

## Trạng thái
| Spec | Trạng thái | Đã làm |
|---|---|---|
| 06 Cloudflare auto-provision | ✅ Triển khai | `scripts/cloud-provision.mjs`, `npm run cloud:setup`, daemon đọc `~/.botautotask/config.json` |
| 02 (một phần) | ✅ Sửa bảo mật | Auth Worker fail-closed + constant-time (`isAuthorized`) |
| 08 Mesh safety + approval + experience + attention UI | ✅ Triển khai | SSE auth `?k=`, merge `MAIN_DIRTY_COLLISION` + `reset --keep`, `COMPLETED_UNVERIFIED` (orchestrator/supervisor/worker), `framePeerMessage` defang, loop guard cửa sổ trượt, trạng thái giao tin thật, approval gate hash-bound cho merge từ agent, experience library nạp/lưu runtime, diff modal, roster attention, Ctrl+K, tool chip, notification |
| 01, 02, 03, 04, 05, 07 | 📝 Spec | Một phần đã vào theo Spec 08 (lease CAS, completion contract, policy, worktree có sẵn từ trước) |

## Phát hiện quan trọng từ nghiên cứu
1. **GrokBot là client mỏng**: agent chạy trên VM cloud; client **không có** routed loopback MCP bridge (đính chính tài liệu cũ). Học được: 3 chế độ giao tin subagent, await có timeout, lineage + `maxRunning=32`, stale 90s, nonce idempotent, dial-out daemon (doorbell + poll/ack), permission `min(choice, ceiling)`, kill-switch fail-closed.
2. **Neko Core relay** là mẫu tốt nhất cho điều khiển từ điện thoại: PC dial-out WebSocket tới Durable Object của chính người dùng, E2E AES-GCM với secret trong URL fragment, queue offline, `/control` approval không xếp hàng.
3. **Neko không có git worktree** — writer chạy tuần tự. Worktree per writer là điểm BotAutoTask vượt trội.
4. **Bug thật** trong BotAutoTask lộ ra khi đối chiếu: auth fail-open (đã sửa), lease race, auto-pass khi thiếu acceptance, `/pause` tác động mọi goal, ghi state không atomic.

## Lộ trình đề xuất (ưu tiên)
| # | Việc | Spec | Lý do |
|---|---|---|---|
| 1 | Lease CAS + `lease_epoch` + unique step; `/pause` theo goal; Telegram secret header | 02 | Đúng đắn dữ liệu, sửa nhỏ |
| 2 | Bỏ auto-pass; `completionStatus` + `mutation_epoch`; no-progress stop | 05 | Chặn báo "xong" giả |
| 3 | `policy.js` + kill-switch | 05 | An toàn trước khi chạy không người |
| 4 | `WorktreeManager` + `DelegateParallel` + `MergeAgentWorktree` | 03 | Song song hoá writer |
| 5 | Delivery modes / CheckSubagent await / lineage limits / atomic state | 03 | Điều khiển subagent |
| 6 | Web UI local (`botautotask ui`) | 01 | Quan sát + steer |
| 7 | DO RelayHub + `relay-client.js` + `botautotask pair` + PWA cloud | 02 | Điện thoại khi PC bật/tắt |
| 8 | Harness² engine | 04 | Tự tiến hoá |

## Bắt đầu nhanh với Cloud
```powershell
npm install                 # cài playwright-core (dev)
npm run cloud:setup:dry     # xem trước
npm run cloud:setup         # đăng nhập Cloudflare trong cửa sổ Edge, phần còn lại tự động
```
