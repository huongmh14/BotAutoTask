/**
 * BotAutoTask — Tactical Multi-Agent Coworker Command Center UI.
 * Original Cyber-Editorial Mission Control UX inspired by multi-agent coworker workflows
 * (Roster & Channels, 3-Mode Delivery Dock, 2-Step Confirm Interrupt, Live Handoff Graph,
 * Isolated Git Worktree Merger, Closed-Loop Contract Telemetry, and Inline Policy Approvals).
 * Zero external dependencies — pure embedded HTML5/CSS3/ES2022.
 */

export function renderDashboardHtml(sessionToken = '', { mode = 'local', cloudUrl = '' } = {}) {
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>BotAutoTask — Tactical Coworker Mesh</title>
<style>
  :root {
    color-scheme: dark;
    --bg-void: #06080d;
    --bg-surface: #0c1018;
    --bg-elevated: #121824;
    --bg-card: #161e2e;
    --bg-hover: #1c263b;
    --border-dim: #1e293b;
    --border-bright: #334155;
    --fg-primary: #f1f5f9;
    --fg-secondary: #94a3b8;
    --fg-muted: #64748b;
    --cyan: #06b6d4;
    --cyan-dim: rgba(6, 182, 212, 0.14);
    --amber: #f59e0b;
    --amber-dim: rgba(245, 158, 11, 0.15);
    --emerald: #10b981;
    --emerald-dim: rgba(16, 185, 129, 0.15);
    --rose: #f43f5e;
    --rose-dim: rgba(244, 63, 94, 0.16);
    --violet: #8b5cf6;
    --violet-dim: rgba(139, 92, 246, 0.15);
    --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --font-mono: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', ui-monospace, Consolas, monospace;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg-void);
    color: var(--fg-primary);
    font-family: var(--font-sans);
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    user-select: none;
  }

  /* ─── TOP COMMAND BAR ─── */
  .topbar {
    height: 54px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border-dim);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    gap: 12px;
    flex-shrink: 0;
  }
  .brand-cluster {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .brand-logo {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: linear-gradient(135deg, var(--cyan), var(--violet));
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-mono);
    font-weight: 800;
    font-size: 0.85rem;
    color: #fff;
    box-shadow: 0 0 16px rgba(6, 182, 212, 0.35);
  }
  .brand-title {
    font-weight: 700;
    font-size: 0.98rem;
    letter-spacing: -0.01em;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .brand-sub {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--fg-muted);
  }
  .telemetry-strip {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 6px;
    font-family: var(--font-mono);
    font-size: 0.73rem;
    font-weight: 600;
    border: 1px solid var(--border-dim);
    background: var(--bg-elevated);
    color: var(--fg-secondary);
  }
  .pill .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--fg-muted);
  }
  .pill.LIVE { border-color: rgba(16,185,129,0.4); color: var(--emerald); background: var(--emerald-dim); }
  .pill.LIVE .dot { background: var(--emerald); box-shadow: 0 0 8px var(--emerald); }
  .pill.STALE { border-color: rgba(245,158,11,0.4); color: var(--amber); background: var(--amber-dim); }
  .pill.STALE .dot { background: var(--amber); }
  .pill.DISCONNECTED { border-color: rgba(244,63,94,0.4); color: var(--rose); background: var(--rose-dim); }
  .pill.DISCONNECTED .dot { background: var(--rose); }

  /* ─── BUTTONS & INPUTS ─── */
  button {
    font-family: var(--font-sans);
    font-size: 0.8rem;
    font-weight: 600;
    padding: 7px 12px;
    border-radius: 7px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--cyan);
    color: #04131a;
  }
  button:hover { filter: brightness(1.1); }
  button:active { transform: translateY(1px); }
  button.btn-ghost {
    background: var(--bg-elevated);
    color: var(--fg-primary);
    border-color: var(--border-dim);
  }
  button.btn-ghost:hover { background: var(--bg-hover); border-color: var(--border-bright); }
  button.btn-amber {
    background: var(--amber-dim);
    color: var(--amber);
    border-color: rgba(245, 158, 11, 0.4);
  }
  button.btn-danger {
    background: var(--rose-dim);
    color: var(--rose);
    border-color: rgba(244, 63, 94, 0.4);
  }
  button.btn-danger.armed {
    background: var(--rose);
    color: #fff;
    box-shadow: 0 0 14px rgba(244, 63, 94, 0.5);
  }
  button.btn-emerald {
    background: var(--emerald-dim);
    color: var(--emerald);
    border-color: rgba(16, 185, 129, 0.4);
  }

  input, select, textarea {
    background: var(--bg-void);
    color: var(--fg-primary);
    border: 1px solid var(--border-dim);
    border-radius: 7px;
    padding: 8px 11px;
    font-family: var(--font-sans);
    font-size: 0.84rem;
    outline: none;
    transition: border-color 0.15s;
  }
  input:focus, select:focus, textarea:focus {
    border-color: var(--cyan);
  }

  /* ─── 3-COLUMN TACTICAL WORKSPACE ─── */
  .workspace {
    display: grid;
    grid-template-columns: 290px 1fr 350px;
    flex: 1;
    overflow: hidden;
  }

  /* ─── LEFT: COWORKER ROSTER & CHANNELS ─── */
  .sidebar {
    background: var(--bg-surface);
    border-right: 1px solid var(--border-dim);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .section-hdr {
    padding: 12px 14px 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--fg-muted);
    text-transform: uppercase;
  }
  .channel-list {
    padding: 0 10px 8px;
    border-bottom: 1px solid var(--border-dim);
  }
  .channel-item {
    padding: 8px 10px;
    border-radius: 7px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.84rem;
    font-weight: 600;
    color: var(--fg-secondary);
    transition: background 0.12s;
  }
  .channel-item:hover { background: var(--bg-elevated); color: var(--fg-primary); }
  .channel-item.active {
    background: var(--cyan-dim);
    color: var(--cyan);
    border: 1px solid rgba(6, 182, 212, 0.3);
  }

  .roster-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 8px 10px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .coworker-card {
    background: var(--bg-elevated);
    border: 1px solid var(--border-dim);
    border-radius: 10px;
    padding: 11px;
    cursor: pointer;
    transition: all 0.15s;
    position: relative;
  }
  .coworker-card:hover { border-color: var(--border-bright); }
  .coworker-card.selected {
    border-color: var(--cyan);
    box-shadow: inset 3px 0 0 var(--cyan);
    background: var(--bg-card);
  }
  .coworker-card.running {
    border-color: rgba(6, 182, 212, 0.6);
  }
  .cw-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    margin-bottom: 4px;
  }
  .cw-name {
    font-weight: 700;
    font-size: 0.88rem;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .role-tag {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    padding: 1px 6px;
    border-radius: 4px;
    text-transform: uppercase;
  }
  .role-tag.writer { background: var(--violet-dim); color: #c4b5fd; border: 1px solid rgba(139,92,246,0.3); }
  .role-tag.reader { background: var(--cyan-dim); color: var(--cyan); border: 1px solid rgba(6,182,212,0.3); }

  .cw-status {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--bg-void);
    color: var(--fg-muted);
  }
  .cw-status.running { color: var(--cyan); background: var(--cyan-dim); }
  .cw-status.stale { color: var(--amber); background: var(--amber-dim); }
  .cw-status.aborted, .cw-status.error { color: var(--rose); background: var(--rose-dim); }

  .cw-desc {
    font-size: 0.76rem;
    color: var(--fg-secondary);
    line-height: 1.35;
    margin-bottom: 8px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .cw-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--fg-muted);
    margin-bottom: 8px;
  }
  .cw-controls {
    display: flex;
    gap: 5px;
    align-items: center;
  }
  .cw-controls select {
    flex: 1;
    padding: 4px 6px;
    font-size: 0.72rem;
    font-family: var(--font-mono);
    background: var(--bg-void);
  }
  .cw-controls button {
    padding: 4px 8px;
    font-size: 0.72rem;
  }

  /* ─── CENTER: MISSION STAGE & MESH TIMELINE ─── */
  .center-stage {
    display: flex;
    flex-direction: column;
    background: var(--bg-void);
    overflow: hidden;
  }

  /* Mission Launch Bar */
  .mission-bar {
    background: linear-gradient(180deg, var(--bg-elevated), var(--bg-surface));
    border-bottom: 1px solid var(--border-dim);
    padding: 10px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .mission-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .mission-row input.mission-prompt {
    flex: 1;
    background: var(--bg-void);
    border-color: var(--border-bright);
    font-weight: 500;
  }

  /* Stream Canvas */
  .stream-header {
    padding: 8px 16px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border-dim);
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--fg-secondary);
  }
  .stream-canvas {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    user-select: text;
  }

  /* Timeline Cards */
  .msg-node {
    background: var(--bg-surface);
    border: 1px solid var(--border-dim);
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    animation: fadeIn 0.16s ease-out;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .msg-node.interrupt {
    border-left: 3px solid var(--amber);
    background: linear-gradient(90deg, rgba(245,158,11,0.07), var(--bg-surface) 40%);
  }
  .msg-node.handoff {
    border-left: 3px solid var(--cyan);
  }
  .msg-node.completion {
    border-left: 3px solid var(--emerald);
    background: linear-gradient(90deg, rgba(16,185,129,0.08), var(--bg-surface) 40%);
  }
  .msg-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-family: var(--font-mono);
    font-size: 0.74rem;
  }
  .route-flow {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
  }
  .actor-chip {
    padding: 2px 7px;
    border-radius: 4px;
    background: var(--bg-elevated);
    color: var(--fg-primary);
    border: 1px solid var(--border-bright);
  }
  .actor-chip.commander { color: var(--amber); border-color: rgba(245,158,11,0.4); }
  .delivery-tag {
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 0.67rem;
    text-transform: uppercase;
  }
  .delivery-tag.interrupt { background: var(--amber-dim); color: var(--amber); }
  .delivery-tag.queue { background: var(--violet-dim); color: #c4b5fd; }
  .delivery-tag.send { background: var(--cyan-dim); color: var(--cyan); }

  .msg-body {
    font-size: 0.87rem;
    line-height: 1.5;
    color: var(--fg-primary);
    white-space: pre-wrap;
    word-break: break-word;
  }
  .msg-reply {
    margin-top: 6px;
    padding: 8px 10px;
    border-radius: 6px;
    background: var(--bg-void);
    border: 1px solid var(--border-dim);
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--fg-secondary);
    white-space: pre-wrap;
  }

  /* ─── BOTTOM 3-MODE STEER DOCK ─── */
  .steer-dock {
    background: var(--bg-surface);
    border-top: 1px solid var(--border-dim);
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .dock-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }
  .mode-segmented {
    display: inline-flex;
    background: var(--bg-void);
    border: 1px solid var(--border-dim);
    border-radius: 7px;
    padding: 2px;
    gap: 2px;
  }
  .mode-btn {
    background: transparent;
    color: var(--fg-secondary);
    border: none;
    padding: 5px 10px;
    border-radius: 5px;
    font-family: var(--font-mono);
    font-size: 0.73rem;
  }
  .mode-btn.active.send { background: var(--cyan-dim); color: var(--cyan); }
  .mode-btn.active.interrupt { background: var(--amber-dim); color: var(--amber); }
  .mode-btn.active.queue { background: var(--violet-dim); color: #c4b5fd; }

  .dock-input-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .dock-input-row input {
    flex: 1;
    padding: 10px 12px;
    font-size: 0.88rem;
  }

  /* ─── RIGHT: TELEMETRY, WORKTREES & POLICY INSPECTOR ─── */
  .inspector {
    background: var(--bg-surface);
    border-left: 1px solid var(--border-dim);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .insp-tabs {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border-bottom: 1px solid var(--border-dim);
    background: var(--bg-elevated);
  }
  .insp-tab {
    padding: 10px 6px;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--fg-muted);
    cursor: pointer;
    border-bottom: 2px solid transparent;
  }
  .insp-tab.active {
    color: var(--cyan);
    border-bottom-color: var(--cyan);
    background: var(--bg-surface);
  }
  .insp-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .info-box {
    background: var(--bg-elevated);
    border: 1px solid var(--border-dim);
    border-radius: 8px;
    padding: 10px;
    font-size: 0.8rem;
  }
  .info-box-title {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--fg-secondary);
    margin-bottom: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .mono-block {
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--fg-secondary);
    background: var(--bg-void);
    padding: 8px;
    border-radius: 6px;
    border: 1px solid var(--border-dim);
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 200px;
    overflow-y: auto;
    user-select: text;
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(3, 6, 12, 0.78);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 16px;
  }
  .modal-backdrop.open { display: flex; }
  .modal-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-bright);
    border-radius: 12px;
    width: 100%;
    max-width: 440px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Responsive Mobile */
  .mobile-nav {
    display: none;
    background: var(--bg-surface);
    border-top: 1px solid var(--border-dim);
    grid-template-columns: repeat(3, 1fr);
  }
  .mobile-nav button {
    background: transparent;
    color: var(--fg-secondary);
    border-radius: 0;
    justify-content: center;
    padding: 10px;
  }
  .mobile-nav button.active { color: var(--cyan); background: var(--cyan-dim); }

  @media (max-width: 900px) {
    .workspace { grid-template-columns: 1fr; }
    .sidebar, .inspector { display: none; }
    .workspace.mob-roster .sidebar { display: flex; }
    .workspace.mob-roster .center-stage { display: none; }
    .workspace.mob-insp .inspector { display: flex; }
    .workspace.mob-insp .center-stage { display: none; }
    .mobile-nav { display: grid; }
  }
</style>
</head>
<body>

  <!-- TOP COMMAND BAR -->
  <div class="topbar">
    <div class="brand-cluster">
      <div class="brand-logo">B²</div>
      <div>
        <div class="brand-title">
          BotAutoTask Mesh
          <span class="pill" style="font-size:0.65rem;padding:2px 6px">${mode.toUpperCase()}</span>
        </div>
        <div class="brand-sub">Multi-Agent Coworker Orchestrator · Worktree Sandbox · Closed-Loop Verify</div>
      </div>
    </div>

    <div class="telemetry-strip">
      <div id="ssePill" class="pill DISCONNECTED">
        <span class="dot"></span>
        <span id="sseText">CONNECTING</span>
      </div>
      <div id="seqPill" class="pill">SEQ #1000</div>
      <button class="btn-ghost" onclick="openSpawnModal()">➕ Spawn Specialist</button>
      <button id="stopAllBtn" class="btn-danger" onclick="triggerStopAll()">🛑 Stop All</button>
    </div>
  </div>

  <!-- 3-COLUMN TACTICAL WORKSPACE -->
  <div id="workspaceEl" class="workspace">

    <!-- LEFT: COWORKER ROSTER & CHANNELS -->
    <aside class="sidebar">
      <div class="section-hdr">
        <span>ROOMS & THREADS</span>
      </div>
      <div class="channel-list">
        <div id="chanAll" class="channel-item active" onclick="selectChannel('all')">
          <span>⚡ #mesh-command-room</span>
          <span class="cw-status" id="totalHandoffsBadge">0</span>
        </div>
      </div>

      <div class="section-hdr">
        <span>COWORKER SQUAD</span>
        <span id="squadCount">3 AGENTS</span>
      </div>
      <div id="rosterContainer" class="roster-scroll"></div>
    </aside>

    <!-- CENTER: MISSION BAR, STREAM TIMELINE & STEER DOCK -->
    <main class="center-stage">
      <!-- Team Mission Launcher -->
      <div class="mission-bar">
        <div class="mission-row">
          <input id="teamGoalInput" class="mission-prompt" placeholder="🎯 Launch Autonomous Team Mission (e.g. Refactor auth module & add unit tests)..." onkeydown="if(event.key==='Enter')launchTeamMission()"/>
          <input id="teamCheckInput" style="width:170px;font-family:var(--font-mono)" placeholder="Verify cmd (npm test)" value="npm test"/>
          <button onclick="launchTeamMission()">🚀 Dispatch Squad</button>
        </div>
      </div>

      <div class="stream-header">
        <span id="activeStreamTitle">Viewing: <b>#mesh-command-room</b> (All Inter-Agent Handoffs & Tool Calls)</span>
        <span id="nonceReceiptBadge" style="font-family:var(--font-mono);font-size:0.72rem;color:var(--fg-muted)">Ready</span>
      </div>

      <!-- Live Feed -->
      <div id="streamCanvas" class="stream-canvas"></div>

      <!-- 3-Mode Delivery Dock -->
      <div class="steer-dock">
        <div class="dock-controls">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-family:var(--font-mono);font-size:0.72rem;color:var(--fg-muted)">TARGET:</span>
            <select id="dockTarget" style="font-family:var(--font-mono);font-size:0.78rem;padding:4px 8px"></select>
            <label style="font-family:var(--font-mono);font-size:0.72rem;color:var(--fg-secondary);display:flex;align-items:center;gap:4px;cursor:pointer">
              <input type="checkbox" id="dockRunTurn" checked/> Execute Turn Now
            </label>
          </div>

          <div class="mode-segmented">
            <button id="modeSend" class="mode-btn active send" onclick="setDeliveryMode('send')">📨 SEND (TURN)</button>
            <button id="modeInterrupt" class="mode-btn interrupt" onclick="setDeliveryMode('interrupt')">⚡ INTERRUPT (STEER)</button>
            <button id="modeQueue" class="mode-btn queue" onclick="setDeliveryMode('queue')">⏳ QUEUE (FOLLOW-UP)</button>
          </div>
        </div>

        <div class="dock-input-row">
          <input id="dockMessage" placeholder="Direct instruction, mid-run course correction, or task handoff..." onkeydown="if(event.key==='Enter')submitDockMessage()"/>
          <button id="dockSendBtn" onclick="submitDockMessage()">Transmit ↵</button>
        </div>
      </div>
    </main>

    <!-- RIGHT: TELEMETRY, WORKTREES & POLICY INSPECTOR -->
    <aside class="inspector">
      <div class="insp-tabs">
        <div id="tabWt" class="insp-tab active" onclick="switchInspectorTab('wt')">🌿 WORKTREES</div>
        <div id="tabVerify" class="insp-tab" onclick="switchInspectorTab('verify')">🛡 CONTRACT</div>
        <div id="tabSys" class="insp-tab" onclick="switchInspectorTab('sys')">🔑 0-KEY & IDE</div>
      </div>

      <!-- Tab 1: Git Worktrees & Sandbox -->
      <div id="paneWt" class="insp-body">
        <div class="info-box">
          <div class="info-box-title">
            <span>ISOLATED WRITER WORKTREES</span>
            <button class="btn-ghost" style="padding:2px 6px;font-size:0.68rem" onclick="refreshState()">↻</button>
          </div>
          <div style="font-size:0.75rem;color:var(--fg-muted);margin-bottom:8px">
            Each writer coworker operates in its own Git branch (<code>.botautotask/worktrees/&lt;id&gt;</code>) to prevent file collisions.
          </div>
          <div id="worktreeList" style="display:flex;flex-direction:column;gap:8px"></div>
        </div>
      </div>

      <!-- Tab 2: Closed-Loop Contract & Policy Approvals -->
      <div id="paneVerify" class="insp-body" style="display:none">
        <div class="info-box">
          <div class="info-box-title">
            <span>PERMISSION APPROVAL QUEUE</span>
            <span id="approvalCountBadge" class="cw-status">0</span>
          </div>
          <div id="approvalList" style="font-size:0.76rem;color:var(--fg-muted)">
            No destructive commands awaiting approval. Hard-refuse policy is active.
          </div>
        </div>

        <div class="info-box">
          <div class="info-box-title">
            <span>CLOSED-LOOP COMPLETION CONTRACT</span>
          </div>
          <div style="font-size:0.75rem;color:var(--fg-secondary);line-height:1.4">
            • Append-only criteria (max 16)<br/>
            • Bound to <code>mutation_epoch</code> (git diff SHA)<br/>
            • 2 identical gap signatures → Auto-Swap Core<br/>
            • Unverified goals stop at <code>outcome_unverified</code>
          </div>
        </div>
      </div>

      <!-- Tab 3: 0-API-Key Auth & Antigravity IDE Transcript -->
      <div id="paneSys" class="insp-body" style="display:none">
        <div class="info-box">
          <div class="info-box-title"><span>ZERO-API-KEY SESSIONS</span></div>
          <div id="authList" class="mono-block">Scanning local CLI credentials...</div>
        </div>

        <div class="info-box">
          <div class="info-box-title"><span>ANTIGRAVITY IDE TRANSCRIPT</span></div>
          <div id="ideTranscriptBox" class="mono-block">No active IDE session detected.</div>
        </div>
      </div>
    </aside>
  </div>

  <!-- MOBILE NAVIGATION BAR -->
  <div class="mobile-nav">
    <button id="mobBtnSquad" onclick="setMobileView('roster')">👥 Squad</button>
    <button id="mobBtnComms" class="active" onclick="setMobileView('comms')">⚡ Comms</button>
    <button id="mobBtnInsp" onclick="setMobileView('insp')">🛠 Telemetry</button>
  </div>

  <!-- SPAWN SPECIALIST MODAL -->
  <div id="spawnModal" class="modal-backdrop">
    <div class="modal-card">
      <div style="font-weight:700;font-size:1rem">➕ Spawn New Coworker Specialist</div>
      <input id="spId" placeholder="Short ID (e.g. security-auditor, db-architect)"/>
      <input id="spName" placeholder="Display Name (e.g. Security & Hardening Auditor)"/>
      <select id="spRole">
        <option value="writer">Role: Writer (Isolated Git Worktree)</option>
        <option value="reader">Role: Reader / Reviewer (Shared Read-Only)</option>
      </select>
      <select id="spCore">
        <option value="auto">Core: Auto (Best Free / Signed-in Model)</option>
        <option value="opencode:opencode/deepseek-v4.1-flash-free">OpenCode: deepseek-v4.1-flash-free</option>
        <option value="codex">Codex (ChatGPT OAuth 0-Key)</option>
        <option value="claude">Claude Code</option>
        <option value="antigravity">Antigravity IDE</option>
      </select>
      <textarea id="spDesc" rows="3" placeholder="System persona & specialized instructions..."></textarea>
      <div style="display:flex;justify-content:flex-end;gap:8px">
        <button class="btn-ghost" onclick="closeSpawnModal()">Cancel</button>
        <button onclick="submitSpawnAgent()">Create Coworker</button>
      </div>
    </div>
  </div>

<script>
  // 1. Secret Fragment Extraction (Neko/GrokBot pattern: strip #k= from address bar immediately)
  let token = '${sessionToken}';
  if (window.location.hash.startsWith('#k=')) {
    token = decodeURIComponent(window.location.hash.slice(3));
    history.replaceState(null, '', window.location.pathname);
  } else if (window.location.hash.startsWith('#token=')) {
    token = decodeURIComponent(window.location.hash.slice(7));
    history.replaceState(null, '', window.location.pathname);
  }

  let currentChannel = 'all'; // 'all' or agent.id
  let currentDelivery = 'send';
  let agentsCache = [];
  let feedItems = [];
  let stopArmedTimers = {};
  let stopAllArmed = false;

  const CORE_OPTIONS = [
    { value: 'auto', label: 'auto (Best Free)' },
    { value: 'opencode:opencode/deepseek-v4.1-flash-free', label: 'deepseek-v4.1-free' },
    { value: 'opencode:freemodel/claude-sonnet-4-6', label: 'sonnet-4.6-free' },
    { value: 'codex', label: 'codex (OAuth)' },
    { value: 'claude', label: 'claude-code' },
    { value: 'antigravity', label: 'antigravity-ide' }
  ];

  function makeNonce() {
    return 'n-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async function api(path, opts = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
      ...(opts.headers || {})
    };
    return fetch(path, { ...opts, headers });
  }

  function setConnState(state, seq) {
    const pill = document.getElementById('ssePill');
    const txt = document.getElementById('sseText');
    pill.className = 'pill ' + state;
    txt.innerText = state;
    if (seq !== undefined) {
      document.getElementById('seqPill').innerText = 'SEQ #' + seq;
    }
  }

  // 2. Live SSE Stream with Replay
  function connectStream() {
    const es = new EventSource('/api/events?token=' + encodeURIComponent(token));
    es.onopen = () => setConnState('LIVE');
    es.onerror = () => setConnState('DISCONNECTED');
    es.addEventListener('frame', (evt) => {
      try {
        const frame = JSON.parse(evt.data);
        if (frame.seq) setConnState('LIVE', frame.seq);
        if (frame.t === 'hello') {
          refreshState();
          return;
        }
        handleIncomingEvent(frame);
      } catch {}
    });
  }

  function handleIncomingEvent(frame) {
    const p = frame.payload || {};
    if (frame.family === 'agent_message' || frame.family === 'agent_steered' || frame.family === 'team_step') {
      pushTimelineEvent({
        id: 'evt-' + frame.seq,
        from: p.fromId || p.from || 'commander',
        to: p.targetId || p.agentId || 'all',
        delivery: p.delivery || (p.priority ? 'interrupt' : 'send'),
        message: p.message || p.summary || '',
        reply: p.reply || null,
        core: p.harnessId ? (p.harnessId + ':' + (p.modelId || '')) : null,
        ts: new Date().toLocaleTimeString()
      });
    }
    refreshState();
  }

  function pushTimelineEvent(item) {
    feedItems.push(item);
    if (feedItems.length > 300) feedItems.shift();
    document.getElementById('totalHandoffsBadge').innerText = String(feedItems.length);
    renderTimeline();
  }

  function renderTimeline() {
    const canvas = document.getElementById('streamCanvas');
    const filtered = currentChannel === 'all'
      ? feedItems
      : feedItems.filter((x) => x.from === currentChannel || x.to === currentChannel);

    if (filtered.length === 0) {
      canvas.innerHTML = \`
        <div class="msg-node" style="color:var(--fg-muted);text-align:center;padding:28px">
          No handoffs or turns recorded in this view yet.<br/>
          Use the <b>Mission Bar</b> above to dispatch a full squad task, or transmit a direct instruction below.
        </div>
      \`;
      return;
    }

    canvas.innerHTML = filtered.map((item) => {
      const modeClass = item.delivery === 'interrupt' ? 'interrupt' : 'handoff';
      return \`
        <div class="msg-node \${modeClass}">
          <div class="msg-head">
            <div class="route-flow">
              <span class="actor-chip \${item.from === 'commander' ? 'commander' : ''}">@\${esc(item.from)}</span>
              <span style="color:var(--fg-muted)">→</span>
              <span class="actor-chip">@\${esc(item.to)}</span>
              <span class="delivery-tag \${esc(item.delivery)}">\${esc(item.delivery)}</span>
              \${item.core ? \`<span class="cw-status">\${esc(item.core)}</span>\` : ''}
            </div>
            <span style="color:var(--fg-muted)">\${esc(item.ts)}</span>
          </div>
          <div class="msg-body">\${esc(item.message)}</div>
          \${item.reply ? \`<div class="msg-reply">↳ Reply: \${esc(item.reply)}</div>\` : ''}
        </div>
      \`;
    }).join('');
    canvas.scrollTop = canvas.scrollHeight;
  }

  // 3. State Snapshot Rendering
  async function refreshState() {
    try {
      const res = await api('/api/state');
      if (!res.ok) return;
      const data = await res.json();
      agentsCache = data.agents || [];
      renderRoster(agentsCache);
      renderWorktrees(agentsCache);
      renderAuthAndIde(data.auth || {}, data.latestIdeLog);
      if (Array.isArray(data.handoffs) && feedItems.length === 0 && data.handoffs.length > 0) {
        feedItems = data.handoffs.map((h) => ({
          id: h.id,
          from: h.fromAgentId,
          to: h.targetAgentId,
          delivery: h.delivery || (h.priority ? 'interrupt' : 'send'),
          message: h.summary,
          ts: new Date(h.createdAt).toLocaleTimeString()
        }));
        document.getElementById('totalHandoffsBadge').innerText = String(feedItems.length);
        renderTimeline();
      } else if (feedItems.length === 0) {
        renderTimeline();
      }
    } catch {}
  }

  function renderRoster(agents) {
    document.getElementById('squadCount').innerText = agents.length + ' AGENTS';
    const container = document.getElementById('rosterContainer');
    const dockTarget = document.getElementById('dockTarget');
    const prevTarget = dockTarget.value;

    container.innerHTML = agents.map((a) => {
      const isStale = a.status === 'running' && a.elapsedMs > 90000;
      const dispStatus = isStale ? 'stale' : (a.status || 'idle');
      const elapsedSec = a.elapsedMs ? Math.round(a.elapsedMs / 1000) + 's' : '';
      const isSelected = currentChannel === a.id;
      const isArmed = Boolean(stopArmedTimers[a.id]);

      const coreOpts = CORE_OPTIONS.map((c) =>
        \`<option value="\${esc(c.value)}" \${a.preferredCore === c.value ? 'selected' : ''}>\${esc(c.label)}</option>\`
      ).join('');

      return \`
        <div class="coworker-card \${isSelected ? 'selected' : ''} \${a.status === 'running' ? 'running' : ''}" onclick="selectChannel('\${esc(a.id)}')">
          <div class="cw-top">
            <div class="cw-name">
              <span>@\${esc(a.id)}</span>
              <span class="role-tag \${esc(a.role || 'writer')}">\${esc(a.role || 'writer')}</span>
            </div>
            <span class="cw-status \${dispStatus}">\${dispStatus.toUpperCase()} \${elapsedSec}</span>
          </div>
          <div style="font-size:0.78rem;font-weight:600;color:var(--fg-primary);margin-bottom:2px">\${esc(a.name)}</div>
          <div class="cw-desc">\${esc(a.description)}</div>
          <div class="cw-meta">
            <span>⚙ calls: \${a.toolCallCount || 0}</span>
            <span>📥 inbox: \${a.inboxCount || 0} · ⚡ steers: \${a.pendingSteers || 0}</span>
          </div>
          <div class="cw-controls" onclick="event.stopPropagation()">
            <select onchange="changeAgentCore('\${esc(a.id)}', this.value)" title="Switch AI Core/Model for @\${esc(a.id)}">
              \${coreOpts}
            </select>
            <button class="btn-amber" onclick="quickFocusSteer('\${esc(a.id)}')" title="Steer @\${esc(a.id)}">⚡</button>
            <button id="stopBtn-\${esc(a.id)}" class="btn-danger \${isArmed ? 'armed' : ''}" onclick="armOrStopAgent('\${esc(a.id)}')">
              \${isArmed ? 'Confirm?' : '🛑'}
            </button>
          </div>
        </div>
      \`;
    }).join('');

    dockTarget.innerHTML =
      '<option value="all">@all (Broadcast Squad)</option>' +
      agents.map((a) => \`<option value="\${esc(a.id)}">@\${esc(a.id)} — \${esc(a.name)}</option>\`).join('');

    if (prevTarget && (prevTarget === 'all' || agents.some((a) => a.id === prevTarget))) {
      dockTarget.value = prevTarget;
    } else if (agents.some((a) => a.id === 'lead')) {
      dockTarget.value = 'lead';
    }
  }

  function renderWorktrees(agents) {
    const wtList = document.getElementById('worktreeList');
    const writers = agents.filter((a) => (a.role || 'writer') === 'writer');
    if (writers.length === 0) {
      wtList.innerHTML = '<div style="color:var(--fg-muted);font-size:0.75rem">No writer agents registered.</div>';
      return;
    }
    wtList.innerHTML = writers.map((w) => \`
      <div style="background:var(--bg-void);border:1px solid var(--border-dim);border-radius:6px;padding:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <b style="font-family:var(--font-mono);font-size:0.76rem;color:var(--cyan)">@\${esc(w.id)}</b>
          <span class="cw-status">branch: botautotask/agent-\${esc(w.id)}</span>
        </div>
        <div style="font-family:var(--font-mono);font-size:0.68rem;color:var(--fg-muted);margin-bottom:6px">
          \${esc(w.worktreePath || '.botautotask/worktrees/' + w.id)}
        </div>
        <button class="btn-emerald" style="width:100%;justify-content:center;padding:5px" onclick="mergeAgentWorktree('\${esc(w.id)}')">
          ✔ Verify & Merge into Main
        </button>
      </div>
    \`).join('');
  }

  function renderAuthAndIde(auth, ideLog) {
    const authEl = document.getElementById('authList');
    const entries = Object.entries(auth || {});
    if (entries.length === 0) {
      authEl.innerText = 'No auth bridge data.';
    } else {
      authEl.innerHTML = entries.map(([k, v]) => {
        const ok = v.authenticated || v.signedIn;
        const badge = ok ? '🟢 SIGNED IN' : (v.installed ? '🟡 INSTALLED' : '⚪ NOT INSTALLED');
        return \`\${k.padEnd(12)} : \${badge} (\${v.authMode || 'cli'})\`;
      }).join('\\n');
    }

    const ideEl = document.getElementById('ideTranscriptBox');
    if (!ideLog) {
      ideEl.innerText = 'No active Antigravity IDE transcript found.';
    } else {
      ideEl.innerText = \`Status: \${ideLog.status || 'IDLE'}\\n\\n\${ideLog.lastResponse || ''}\`;
    }
  }

  // 4. User Actions (GrokBot 2-step Stop, 3-mode Send/Interrupt/Queue, Hot Core Swap, Worktree Merge)
  function selectChannel(chanId) {
    currentChannel = chanId;
    document.getElementById('chanAll').className = 'channel-item ' + (chanId === 'all' ? 'active' : '');
    const titleEl = document.getElementById('activeStreamTitle');
    if (chanId === 'all') {
      titleEl.innerHTML = 'Viewing: <b>#mesh-command-room</b> (All Inter-Agent Handoffs & Tool Calls)';
    } else {
      titleEl.innerHTML = 'Viewing Coworker Thread: <b>@' + esc(chanId) + '</b>';
      document.getElementById('dockTarget').value = chanId;
    }
    renderRoster(agentsCache);
    renderTimeline();
  }

  function setDeliveryMode(mode) {
    currentDelivery = mode;
    ['send', 'interrupt', 'queue'].forEach((m) => {
      const btn = document.getElementById('mode' + m.charAt(0).toUpperCase() + m.slice(1));
      btn.className = 'mode-btn ' + m + (m === mode ? ' active' : '');
    });
  }

  function quickFocusSteer(agentId) {
    document.getElementById('dockTarget').value = agentId;
    setDeliveryMode('interrupt');
    document.getElementById('dockMessage').focus();
  }

  async function submitDockMessage() {
    const target = document.getElementById('dockTarget').value;
    const input = document.getElementById('dockMessage');
    const wait = document.getElementById('dockRunTurn').checked;
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    const nonce = makeNonce();
    const badge = document.getElementById('nonceReceiptBadge');
    badge.innerText = 'Dispatching ' + nonce + '...';

    const res = await api('/api/agents/' + encodeURIComponent(target) + '/message', {
      method: 'POST',
      body: JSON.stringify({ nonce, text, delivery: currentDelivery, wait })
    });
    const out = await res.json().catch(() => ({}));
    badge.innerText = out.status === 'duplicate'
      ? 'Duplicate Ignored (' + nonce + ')'
      : 'Acked (' + (out.status || currentDelivery) + ')';
    refreshState();
  }

  async function launchTeamMission() {
    const goalInput = document.getElementById('teamGoalInput');
    const checkInput = document.getElementById('teamCheckInput');
    const goal = goalInput.value.trim();
    if (!goal) return;

    goalInput.value = '';
    const nonce = makeNonce();
    document.getElementById('nonceReceiptBadge').innerText = 'Squad Dispatched (' + nonce + ')';

    await api('/api/team/start', {
      method: 'POST',
      body: JSON.stringify({
        nonce,
        goal,
        check: checkInput.value.trim() || null
      })
    });
    refreshState();
  }

  async function changeAgentCore(agentId, preferredCore) {
    await api('/api/agents/' + encodeURIComponent(agentId) + '/core', {
      method: 'POST',
      body: JSON.stringify({ nonce: makeNonce(), preferredCore })
    });
    refreshState();
  }

  // GrokBot 2-step 3-second confirmation window for Stop
  async function armOrStopAgent(agentId) {
    if (!stopArmedTimers[agentId]) {
      stopArmedTimers[agentId] = setTimeout(() => {
        delete stopArmedTimers[agentId];
        renderRoster(agentsCache);
      }, 3000);
      renderRoster(agentsCache);
      return;
    }
    clearTimeout(stopArmedTimers[agentId]);
    delete stopArmedTimers[agentId];
    await api('/api/agents/' + encodeURIComponent(agentId) + '/stop', {
      method: 'POST',
      body: JSON.stringify({ nonce: makeNonce(), confirm: true })
    });
    refreshState();
  }

  async function triggerStopAll() {
    const btn = document.getElementById('stopAllBtn');
    if (!stopAllArmed) {
      stopAllArmed = true;
      btn.classList.add('armed');
      btn.innerText = '⚠️ Confirm Stop All (3s)';
      setTimeout(() => {
        stopAllArmed = false;
        btn.classList.remove('armed');
        btn.innerText = '🛑 Stop All';
      }, 3000);
      return;
    }
    stopAllArmed = false;
    btn.classList.remove('armed');
    btn.innerText = '🛑 Stop All';
    await api('/api/agents/stop-all', {
      method: 'POST',
      body: JSON.stringify({ nonce: makeNonce(), confirm: true })
    });
    refreshState();
  }

  async function mergeAgentWorktree(agentId) {
    const checkCmd = document.getElementById('teamCheckInput').value.trim() || null;
    const res = await api('/api/agents/' + encodeURIComponent(agentId) + '/merge', {
      method: 'POST',
      body: JSON.stringify({ nonce: makeNonce(), verifyCmd: checkCmd })
    });
    const out = await res.json().catch(() => ({}));
    pushTimelineEvent({
      id: 'merge-' + Date.now(),
      from: agentId,
      to: 'main-branch',
      delivery: 'send',
      message: out.success
        ? '✅ Worktree verified & merged cleanly into main (commit: ' + (out.sha || 'HEAD') + ')'
        : '❌ Merge aborted (' + (out.reason || 'conflict') + '): ' + JSON.stringify(out.conflicts || out.error || ''),
      ts: new Date().toLocaleTimeString()
    });
    refreshState();
  }

  function switchInspectorTab(tab) {
    ['wt', 'verify', 'sys'].forEach((t) => {
      document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1)).className = 'insp-tab' + (t === tab ? ' active' : '');
      document.getElementById('pane' + t.charAt(0).toUpperCase() + t.slice(1)).style.display = t === tab ? 'flex' : 'none';
    });
  }

  function setMobileView(view) {
    const ws = document.getElementById('workspaceEl');
    ws.className = 'workspace' + (view === 'roster' ? ' mob-roster' : view === 'insp' ? ' mob-insp' : '');
    document.getElementById('mobBtnSquad').className = view === 'roster' ? 'active' : '';
    document.getElementById('mobBtnComms').className = view === 'comms' ? 'active' : '';
    document.getElementById('mobBtnInsp').className = view === 'insp' ? 'active' : '';
  }

  function openSpawnModal() { document.getElementById('spawnModal').classList.add('open'); }
  function closeSpawnModal() { document.getElementById('spawnModal').classList.remove('open'); }

  async function submitSpawnAgent() {
    const id = document.getElementById('spId').value.trim();
    const name = document.getElementById('spName').value.trim();
    const role = document.getElementById('spRole').value;
    const preferredCore = document.getElementById('spCore').value;
    const description = document.getElementById('spDesc').value.trim();
    if (!name) return;

    await api('/api/agents', {
      method: 'POST',
      body: JSON.stringify({ nonce: makeNonce(), id, name, role, preferredCore, description })
    });
    closeSpawnModal();
    refreshState();
  }

  connectStream();
</script>
</body>
</html>`;
}
