# BotAutoTask v2.0 — Feature Specifications & Architectural Blueprint

Thư mục này tài liệu hoá toàn bộ các nghiên cứu, đặc tả kỹ thuật và kế hoạch kiến trúc cho các tính năng trọng điểm của **BotAutoTask v2.0**, bao gồm Giao diện Điều khiển Trực quan Web/Mobile, Điều khiển Độc lập 100% từ Điện thoại qua Cloudflare D1 24/7, Cơ chế Song song hoá Git Worktree, và Sự tích hợp hệ thống đệ quy tự tiến hoá từ **Google Research Harness²** (`google-research/harness2`).

---

## Danh Mục Tính Năng

```
docs/feature/
├── README.md                      # Tổng quan kiến trúc v2.0 & sơ đồ kết nối hệ thống
├── 01-web-mobile-ui.md            # Giao diện Điều khiển Trực quan (Local & Mobile Web/PWA)
├── 02-mobile-cloud-control.md     # Điều khiển Độc lập 100% từ Điện thoại & Cloud D1 24/7
├── 03-git-worktree-parallel.md    # Song song hoá Git Worktree per Agent & Auto-Merge
└── 04-harness2-integration.md     # Tích hợp Google Research Harness² (c1..c8 & Propose-Probe-Compose)
```

---

## Kiến Trúc Tổng Thể v2.0

```mermaid
flowchart TB
    subgraph Client["Tầng Người Dùng (Commander)"]
        MobilePWA["📱 Mobile Web/PWA (Cloudflare 24/7)\nKhung chat, Steer, Đổi lõi, Xem log"]
        NtfyClient["🔔 App ntfy (iOS / Android)\nPush Notification & Lệnh nhanh 0-API-Key"]
        LocalWeb["💻 Local Web UI (http://127.0.0.1:8765)\nSSE Real-time Dashboard trên PC"]
    end

    subgraph CloudCore["Tầng Cloud Control Plane 24/7 (Khi tắt PC)"]
        CFWorker["Cloudflare Worker (cloud-core/worker.js)\nPhục vụ Mobile UI + API Điều phối"]
        D1DB[("Cloudflare D1 SQLite\ngoals + journal + remote_commands + experience_library")]
        GHARunner["GitHub Actions Cloud Runner (.github/workflows/botautotask-worker.yml)\nKích hoạt tức thì 0s khi PC tắt"]
        CFWorker <--> D1DB
        CFWorker -->|"Trigger tức thì khi PC offline"| GHARunner
    end

    subgraph LocalRuntime["Tầng Local Runtime (Khi PC bật)"]
        Daemon["LocalDaemon (src/daemon/local-daemon.js)\nHeartbeat 25s đồng bộ với Cloud D1"]
        Mesh["AgentMesh + Loopback MCP Bridge\n(lead, coder-1, coder-2, reviewer)"]
        WTManager["WorktreeManager (src/core/worktree-manager.js)"]
        H2Engine["Harness² Engine (src/core/harness2-engine.js)\nSurfaceSpec c1..c8 + Propose-Probe-Compose"]
    end

    subgraph Isolation["Tầng Cô Lập Nhánh (Git Worktrees)"]
        W1[".botautotask/worktrees/coder-1\n(Nhánh: botautotask/agent-coder-1)"]
        W2[".botautotask/worktrees/coder-2\n(Nhánh: botautotask/agent-coder-2)"]
        WR[".botautotask/worktrees/reviewer\n(Nhánh: botautotask/agent-reviewer)"]
        MainRepo["Nhánh Chính Workspace / GitHub Repo\n(Auto-Merge sau khi Pass Test)"]
    end

    MobilePWA <-->|"HTTPS"| CFWorker
    NtfyClient <-->|"HTTP Push"| CFWorker
    LocalWeb <-->|"HTTP + SSE"| Mesh
    CFWorker <-.->|"Heartbeat 25s & Steer queue"| Daemon
    Daemon --> Mesh
    GHARunner --> Mesh
    Mesh --> H2Engine
    H2Engine --> WTManager
    WTManager --> W1 & W2 & WR
    W1 & W2 -->|"Verify Pass"| MainRepo
```

---

## 4 Trụ Cột Phát Triển

1. **[01-web-mobile-ui.md](01-web-mobile-ui.md):**
   - Thiết kế Single-Page Dashboard Dark UI (Zero External Dependencies) dùng chung cho cả Local Server (`127.0.0.1:8765`) và Cloudflare Worker 24/7.
   - Luồng sự kiện Server-Sent Events (SSE) stream trực tiếp cuộc hội thoại giữa `lead`, `coder-1`, `coder-2`, `reviewer`.
   - Nút bấm **⚡ Priority Steer**, dropdown đổi lõi **Claude / Codex / OpenCode / Antigravity**, và tail log thời gian thực.

2. **[02-mobile-cloud-control.md](02-mobile-cloud-control.md):**
   - Vận hành 100% từ điện thoại ngay cả khi **máy tính ở nhà tắt hoàn toàn**.
   - Cloudflare D1 lưu trữ trạng thái hàng đợi lệnh từ xa (`remote_commands`) và kích hoạt GitHub Actions tức thì (0 giây chờ).
   - Kênh thông báo đẩy & nhận lệnh di động 2 chiều qua **`ntfy.sh`** (miễn phí, không cần đăng ký tài khoản hay tạo Bot) kết hợp tuỳ chọn Telegram/Discord.

3. **[03-git-worktree-parallel.md](03-git-worktree-parallel.md):**
   - Module `WorktreeManager` tạo môi trường file độc lập tại `.botautotask/worktrees/<agentId>` cho mỗi Agent.
   - Công cụ MCP `DelegateParallel` kích hoạt nhiều Agent chạy song song (`Promise.all`) không xung đột git commit.
   - Công cụ MCP `MergeAgentWorktree` tự động chạy bộ test `--check`, nếu pass thì merge sạch về nhánh chính, nếu conflict thì trả diff về cho Agent xử lý.

4. **[04-harness2-integration.md](04-harness2-integration.md):**
   - Hiện thực hoá các nguyên lý từ nghiên cứu `google-research/harness2` (*Harness²: Recursive Agent Harnessing for an Open World*).
   - Cây 8 thành phần $c_1 \dots c_8$ (`SurfaceSpec`) trên substrate OpenCode và Codex.
   - Chu trình đệ quy `Propose – Probe – Compose` phân tách kiểm chứng tổng quát (Invariant) và lời giải chuyên môn (Domain).
   - Thư viện kinh nghiệm tích luỹ `Experience Library R` ({cue, lesson, evidence}) giúp Agent tự thông minh hơn sau mỗi task.
