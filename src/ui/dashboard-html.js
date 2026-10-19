/**
 * BotAutoTask — Coworker Mesh Console (GrokBot-style edition).
 * Chat-first monochrome control surface: roster sidebar, live transcript thread,
 * contextual composer (mission dispatch / 3-mode steer), collapsible telemetry rail.
 * Zero external runtime dependencies — pure embedded HTML5/CSS3/ES2022, system fonts only.
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
    --bg: #000000;
    --panel: #0a0a0a;
    --panel-2: #101010;
    --panel-3: #161616;
    --line: #1f1f1f;
    --line-2: #2c2c2c;
    --fg: #ededed;
    --fg-2: #9a9a9a;
    --fg-3: #5f5f5f;
    --ok: #22c55e;
    --warn: #e5b113;
    --err: #ef4444;
    --idle: #4d4d4d;
    --mono: ui-monospace, 'Cascadia Code', 'SF Mono', Consolas, Menlo, monospace;
    --sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Roboto, 'Helvetica Neue', Arial, sans-serif;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    height: 100%;
    background: var(--bg);
    color: var(--fg);
    font-family: var(--sans);
    font-size: 14px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
    user-select: none;
  }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #232323; border-radius: 999px; }
  ::-webkit-scrollbar-thumb:hover { background: #333; }

  .mono { font-family: var(--mono); }
  button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; }
  input, textarea, select {
    font-family: inherit; color: var(--fg); background: transparent; border: none; outline: none;
  }
  textarea { resize: none; }

  .ico { width: 15px; height: 15px; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; fill: none; flex-shrink: 0; }
  .ico-sm { width: 12px; height: 12px; }
  .ico-lg { width: 18px; height: 18px; }

  /* ─── APP SHELL ─── */
  .app { display: flex; height: 100%; }

  /* ─── SIDEBAR (roster) ─── */
  .sb {
    width: 264px; flex-shrink: 0; display: flex; flex-direction: column;
    background: var(--panel); border-right: 1px solid var(--line);
  }
  .sb-brand {
    display: flex; align-items: baseline; gap: 8px;
    padding: 18px 16px 14px;
  }
  .sb-brand b { font-size: 0.95rem; font-weight: 650; letter-spacing: -0.01em; }
  .sb-brand span { font-family: var(--mono); font-size: 0.6rem; color: var(--fg-3); letter-spacing: 0.08em; }

  .new-mission {
    margin: 0 12px 14px; padding: 9px 12px; border-radius: 8px;
    background: var(--fg); color: #000; font-size: 0.82rem; font-weight: 600;
    display: flex; align-items: center; justify-content: center; gap: 7px;
    transition: background 0.12s;
  }
  .new-mission:hover { background: #d6d6d6; }

  .sb-label {
    padding: 4px 16px 8px;
    font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.1em;
    color: var(--fg-3); display: flex; justify-content: space-between; align-items: center;
  }
  .sb-scroll { flex: 1; overflow-y: auto; padding: 0 8px; }

  .chan {
    display: flex; align-items: center; gap: 9px;
    padding: 8px 9px; border-radius: 8px; cursor: pointer;
    color: var(--fg-2); transition: background 0.1s, color 0.1s;
    position: relative;
  }
  .chan:hover { background: var(--panel-2); color: var(--fg); }
  .chan.active { background: var(--panel-3); color: var(--fg); }
  .chan.active::before {
    content: ''; position: absolute; left: -8px; top: 8px; bottom: 8px;
    width: 2px; background: var(--fg); border-radius: 2px;
  }
  .chan-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .chan-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .chan .hash { font-family: var(--mono); font-size: 0.78rem; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chan .sub { font-size: 0.66rem; color: var(--fg-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .role-pill {
    font-family: var(--mono); font-size: 0.54rem; letter-spacing: 0.06em; text-transform: uppercase;
    padding: 0 4px; border-radius: 3px; border: 1px solid var(--line-2); color: var(--fg-3); flex-shrink: 0;
  }

  .dot { width: 7px; height: 7px; border-radius: 999px; background: var(--idle); flex-shrink: 0; position: relative; }
  .dot.running { background: var(--ok); }
  .dot.running::after {
    content: ''; position: absolute; inset: -3px; border-radius: 999px;
    border: 1px solid var(--ok); opacity: 0.5; animation: pulse 1.6s ease-out infinite;
  }
  .dot.queued, .dot.composing { background: var(--warn); }
  .dot.stale { background: #8a8a8a; }
  .dot.error, .dot.aborted { background: var(--err); }
  @keyframes pulse { 0% { transform: scale(0.6); opacity: 0.7; } 100% { transform: scale(1.6); opacity: 0; } }

  .badge {
    font-family: var(--mono); font-size: 0.6rem; min-width: 17px; height: 17px;
    border-radius: 999px; background: var(--fg); color: #000;
    display: inline-flex; align-items: center; justify-content: center;
    padding: 0 5px; font-weight: 600;
  }
  .badge.hidden { display: none; }

  .sb-spawn {
    margin: 8px 12px; padding: 7px 10px; border-radius: 8px;
    border: 1px dashed var(--line-2); color: var(--fg-2);
    font-size: 0.76rem; display: flex; align-items: center; justify-content: center; gap: 6px;
    transition: border-color 0.12s, color 0.12s;
  }
  .sb-spawn:hover { border-color: var(--fg-2); color: var(--fg); }

  .sb-foot {
    padding: 10px 16px 14px; border-top: 1px solid var(--line);
    display: flex; align-items: center; justify-content: space-between;
    font-family: var(--mono); font-size: 0.6rem; color: var(--fg-3); letter-spacing: 0.05em;
  }
  .conn { display: inline-flex; align-items: center; gap: 6px; }
  .conn-dot { width: 6px; height: 6px; border-radius: 999px; background: var(--err); }
  .conn.LIVE .conn-dot { background: var(--ok); }
  .conn.POLLING .conn-dot { background: var(--warn); }
  .conn.CONNECTING .conn-dot, .conn.DISCONNECTED .conn-dot { background: var(--err); }

  /* ─── CHAT COLUMN ─── */
  .chat { flex: 1; display: flex; flex-direction: column; min-width: 0; }

  .chat-head {
    height: 54px; flex-shrink: 0; display: flex; align-items: center; gap: 12px;
    padding: 0 18px; border-bottom: 1px solid var(--line);
  }
  .ch-id { display: flex; align-items: center; gap: 11px; min-width: 0; flex: 1; }
  .ch-title { font-weight: 650; font-size: 0.9rem; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ch-sub { font-family: var(--mono); font-size: 0.62rem; color: var(--fg-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ch-actions { display: flex; align-items: center; gap: 8px; }

  .core-sel {
    font-family: var(--mono); font-size: 0.68rem; color: var(--fg-2);
    background: var(--panel-2); border: 1px solid var(--line);
    border-radius: 6px; padding: 5px 8px; max-width: 190px; cursor: pointer;
  }
  .core-sel:hover { border-color: var(--line-2); color: var(--fg); }
  .core-sel option { background: var(--panel-2); }

  .gbtn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 11px; border-radius: 7px; font-size: 0.74rem; font-weight: 550;
    border: 1px solid var(--line); color: var(--fg-2); background: transparent;
    transition: all 0.12s; white-space: nowrap;
  }
  .gbtn:hover { color: var(--fg); border-color: var(--line-2); background: var(--panel-2); }
  .gbtn.solid { background: var(--fg); color: #000; border-color: var(--fg); }
  .gbtn.solid:hover { background: #d6d6d6; }
  .gbtn.danger-armed { background: var(--err); border-color: var(--err); color: #000; }

  /* ─── THREAD (transcript) ─── */
  .thread { flex: 1; overflow-y: auto; padding: 22px 18px 12px; scroll-behavior: smooth; }

  .hero { max-width: 620px; margin: 8vh auto 0; text-align: center; }
  .hero h1 { font-size: 1.7rem; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 10px; }
  .hero p { color: var(--fg-2); font-size: 0.86rem; max-width: 460px; margin: 0 auto 26px; }
  .hero .chips { display: flex; flex-direction: column; gap: 8px; max-width: 420px; margin: 0 auto; }
  .chip {
    padding: 11px 16px; border: 1px solid var(--line); border-radius: 10px;
    color: var(--fg-2); font-size: 0.8rem; text-align: left;
    transition: border-color 0.12s, color 0.12s, background 0.12s;
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
  }
  .chip:hover { border-color: var(--line-2); color: var(--fg); background: var(--panel); }
  .chip b { color: var(--fg); font-weight: 600; }
  .chip .go { color: var(--fg-3); font-family: var(--mono); font-size: 0.7rem; }

  .day-sep { display: flex; align-items: center; gap: 12px; margin: 4px 0 18px; }
  .day-sep::before, .day-sep::after { content: ''; flex: 1; height: 1px; background: var(--line); }
  .day-sep span { font-family: var(--mono); font-size: 0.58rem; color: var(--fg-3); letter-spacing: 0.1em; }

  .msg { display: flex; flex-direction: column; margin-bottom: 16px; max-width: 78%; }
  .msg.out { margin-left: auto; align-items: flex-end; }
  .msg-meta {
    font-family: var(--mono); font-size: 0.6rem; color: var(--fg-3);
    display: flex; align-items: center; gap: 7px; margin-bottom: 5px; letter-spacing: 0.02em; flex-wrap: wrap;
  }
  .msg-meta .who { color: var(--fg-2); font-weight: 600; }
  .msg-meta .deliv { border: 1px solid var(--line); border-radius: 4px; padding: 0 4px; }
  .msg-meta .deliv.interrupt { color: var(--err); border-color: rgba(239,68,68,0.4); }
  .msg-meta .deliv.queue { color: var(--warn); border-color: rgba(229,177,19,0.35); }
  .msg-meta .core-tag { background: var(--panel-3); border: 1px solid var(--line-2); border-radius: 4px; padding: 0 5px; color: var(--fg-2); }
  .bubble {
    background: var(--panel-2); border: 1px solid var(--line);
    border-radius: 12px; padding: 10px 13px; font-size: 0.84rem; line-height: 1.55;
    white-space: pre-wrap; word-break: break-word; user-select: text; color: var(--fg);
  }
  .msg.out .bubble { background: #1c1c1c; border-color: #2b2b2b; }
  .msg.system .bubble { background: transparent; border-style: dashed; color: var(--fg-2); font-family: var(--mono); font-size: 0.72rem; }
  .bubble .quote {
    margin-top: 8px; padding: 7px 10px; border-left: 2px solid var(--line-2);
    color: var(--fg-2); font-size: 0.78rem; border-radius: 0 6px 6px 0; background: rgba(255,255,255,0.02);
  }
  .live-activity {
    display: flex; align-items: center; gap: 9px; padding: 9px 13px; margin-top: 4px;
    border: 1px dashed var(--line-2); border-radius: 10px; background: var(--panel);
    font-family: var(--mono); font-size: 0.68rem; color: var(--fg-2); max-width: 78%;
  }

  .new-pill {
    position: absolute; bottom: 108px; left: 50%; transform: translateX(-50%);
    background: var(--fg); color: #000; font-size: 0.7rem; font-weight: 600;
    border-radius: 999px; padding: 6px 13px; display: none; z-index: 5;
    box-shadow: 0 4px 18px rgba(0,0,0,0.6);
  }

  /* ─── COMPOSER ─── */
  .composer-wrap { flex-shrink: 0; padding: 12px 18px 16px; position: relative; }
  .composer {
    max-width: 780px; margin: 0 auto; border: 1px solid var(--line-2); border-radius: 14px;
    background: var(--panel); transition: border-color 0.15s;
  }
  .composer:focus-within { border-color: #3d3d3d; }
  .composer textarea {
    width: 100%; padding: 12px 14px 6px; font-size: 0.86rem; line-height: 1.5;
    max-height: 150px; color: var(--fg); user-select: text;
  }
  .composer textarea::placeholder { color: var(--fg-3); }
  .comp-row {
    display: flex; align-items: center; gap: 8px; padding: 6px 10px 9px 12px; flex-wrap: wrap;
  }
  .check-in {
    font-family: var(--mono); font-size: 0.68rem; color: var(--fg-3);
    border: 1px solid var(--line); border-radius: 6px; padding: 5px 8px; width: 168px;
  }
  .check-in:focus { color: var(--fg-2); border-color: var(--line-2); }
  .tgt-sel {
    font-family: var(--mono); font-size: 0.68rem; color: var(--fg-2);
    border: 1px solid var(--line); border-radius: 6px; padding: 5px 6px; max-width: 150px; cursor: pointer;
  }
  .tgt-sel option { background: var(--panel-2); }

  .seg { display: inline-flex; border: 1px solid var(--line); border-radius: 7px; overflow: hidden; }
  .seg button {
    font-family: var(--mono); font-size: 0.64rem; letter-spacing: 0.04em;
    padding: 5px 10px; color: var(--fg-3); transition: all 0.1s;
  }
  .seg button + button { border-left: 1px solid var(--line); }
  .seg button:hover { color: var(--fg-2); }
  .seg button.active { background: var(--fg); color: #000; font-weight: 600; }

  .sendbtn {
    margin-left: auto; width: 32px; height: 32px; border-radius: 999px;
    background: var(--fg); color: #000; display: inline-flex;
    align-items: center; justify-content: center; transition: background 0.12s, opacity 0.12s;
  }
  .sendbtn:hover { background: #d6d6d6; }
  .sendbtn:disabled { opacity: 0.3; cursor: default; }
  .comp-hint { text-align: center; font-family: var(--mono); font-size: 0.58rem; color: var(--fg-3); margin-top: 8px; letter-spacing: 0.04em; }
  .comp-hint b { color: var(--fg-2); font-weight: 500; }

  .wait-toggle { display: inline-flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 0.62rem; color: var(--fg-3); cursor: pointer; }
  .wait-toggle input { accent-color: var(--fg); cursor: pointer; }

  /* ─── TELEMETRY RAIL ─── */
  .tele {
    width: 300px; flex-shrink: 0; border-left: 1px solid var(--line);
    background: var(--panel); overflow-y: auto; display: flex; flex-direction: column;
  }
  .tele.hidden { display: none; }
  .tele-head {
    height: 54px; flex-shrink: 0; padding: 0 16px; border-bottom: 1px solid var(--line);
    display: none; align-items: center; justify-content: space-between;
    font-family: var(--mono); font-size: 0.68rem; letter-spacing: 0.08em; color: var(--fg-2);
  }
  .tsec { padding: 14px 16px; border-bottom: 1px solid var(--line); }
  .tsec h3 {
    font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.12em;
    color: var(--fg-3); font-weight: 600; margin-bottom: 11px;
    display: flex; align-items: center; gap: 7px;
  }
  .tblock {
    font-family: var(--mono); font-size: 0.66rem; color: var(--fg-2); line-height: 1.7;
    background: var(--panel-2); border: 1px solid var(--line); border-radius: 8px;
    padding: 10px 12px; white-space: pre-wrap; word-break: break-word; user-select: text;
  }
  .wt-row { border: 1px solid var(--line); border-radius: 9px; padding: 10px 11px; margin-bottom: 9px; }
  .wt-row .wt-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  .wt-row .wt-id { font-family: var(--mono); font-size: 0.72rem; }
  .wt-row .wt-branch { font-family: var(--mono); font-size: 0.6rem; color: var(--fg-3); }
  .wt-row .wt-path { font-family: var(--mono); font-size: 0.6rem; color: var(--fg-3); margin-bottom: 8px; word-break: break-all; }
  .wt-merge {
    width: 100%; padding: 6px; border-radius: 6px; border: 1px solid var(--line-2);
    font-size: 0.7rem; color: var(--fg-2); display: flex; align-items: center; justify-content: center; gap: 6px;
    transition: all 0.12s;
  }
  .wt-merge:hover { color: var(--fg); border-color: var(--fg-2); }
  .auth-line { display: flex; align-items: center; gap: 8px; }
  .auth-line .st { font-family: var(--mono); font-size: 0.6rem; margin-left: auto; }
  .auth-line .st.ok { color: var(--ok); }
  .auth-line .st.no { color: var(--fg-3); }

  /* ─── MODAL ─── */
  .modal-bg {
    position: fixed; inset: 0; background: rgba(0,0,0,0.72); backdrop-filter: blur(3px);
    display: none; align-items: center; justify-content: center; z-index: 50;
  }
  .modal-bg.open { display: flex; }
  .modal {
    width: min(420px, calc(100vw - 40px)); background: var(--panel);
    border: 1px solid var(--line-2); border-radius: 16px; padding: 22px;
  }
  .modal h2 { font-size: 1rem; font-weight: 650; margin-bottom: 3px; }
  .modal .m-sub { font-size: 0.74rem; color: var(--fg-3); margin-bottom: 17px; }
  .field { margin-bottom: 11px; }
  .field label { display: block; font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.08em; color: var(--fg-3); margin-bottom: 5px; }
  .field input, .field select, .field textarea {
    width: 100%; background: var(--panel-2); border: 1px solid var(--line);
    border-radius: 8px; padding: 9px 11px; font-size: 0.8rem; user-select: text;
  }
  .field textarea { font-family: var(--mono); font-size: 0.72rem; }
  .field input:focus, .field select:focus, .field textarea:focus { border-color: var(--line-2); }
  .m-actions { display: flex; gap: 9px; margin-top: 16px; }
  .m-actions .gbtn { flex: 1; justify-content: center; padding: 9px; }

  /* ─── MOBILE ─── */
  .mobnav { display: none; }
  @media (max-width: 1149px) {
    .tele { position: fixed; inset: 0; width: 100%; z-index: 30; display: none; }
    .tele-head { display: flex; }
    .app.mob-insp .tele { display: flex; }
  }
  @media (max-width: 760px) {
    .sb { position: fixed; inset: 0; width: 100%; z-index: 30; display: none; }
    .app.mob-roster .sb { display: flex; }
    .app.mob-insp .tele { display: flex; }
    .mobnav {
      display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 40;
      background: rgba(10,10,10,0.92); backdrop-filter: blur(10px);
      border-top: 1px solid var(--line);
    }
    .mobnav button {
      flex: 1; padding: 11px 0 calc(11px + env(safe-area-inset-bottom));
      color: var(--fg-3); font-size: 0.66rem; font-family: var(--mono); letter-spacing: 0.06em;
      display: flex; flex-direction: column; align-items: center; gap: 3px;
    }
    .mobnav button.active { color: var(--fg); }
    .composer-wrap { padding-bottom: calc(12px + 52px); }
    .msg, .live-activity { max-width: 92%; }
    .tele-toggle { display: none; }
  }
</style>
</head>
<body>
<div class="app" id="appEl">

  <!-- ══ SIDEBAR ══ -->
  <aside class="sb" id="sbEl">
    <div class="sb-brand"><b>BotAutoTask</b><span>${mode === 'cloud' ? 'CLOUD' : 'LOCAL'}</span></div>
    <button class="new-mission" onclick="focusNewMission()">
      <svg class="ico ico-sm" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      New Mission
    </button>
    <div class="sb-label"><span>COWORKERS</span><span id="squadCount">—</span></div>
    <div class="sb-scroll">
      <div class="chan active" id="chanAll" onclick="selectChannel('all')">
        <span class="hash">#mesh-command-room</span>
        <span class="badge hidden" id="totalHandoffsBadge">0</span>
      </div>
      <div id="rosterContainer"></div>
    </div>
    <button class="sb-spawn" onclick="openSpawnModal()">
      <svg class="ico ico-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
      Add specialist
    </button>
    <div class="sb-foot">
      <span class="conn CONNECTING" id="connPill"><span class="conn-dot"></span><span id="sseText">CONNECTING</span></span>
      <span id="seqPill">—</span>
    </div>
  </aside>

  <!-- ══ CHAT COLUMN ══ -->
  <main class="chat">
    <header class="chat-head" id="chatHead"></header>
    <div class="thread" id="threadEl"></div>
    <div class="composer-wrap">
      <button class="new-pill" id="newPill" onclick="jumpToLatest()">↓ new</button>
      <div class="composer">
        <textarea id="composerInput" rows="1" placeholder="Describe the mission for the squad…"></textarea>
        <div class="comp-row" id="compRow"></div>
      </div>
      <div class="comp-hint" id="compHint"></div>
    </div>
  </main>

  <!-- ══ TELEMETRY RAIL ══ -->
  <aside class="tele" id="teleEl">
    <div class="tele-head">
      <span>TELEMETRY & WORKTREES</span>
      <button class="gbtn" onclick="closeTelemetry()">Close ×</button>
    </div>
    <div class="tsec">
      <h3><svg class="ico ico-sm" viewBox="0 0 24 24"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>WORKTREES</h3>
      <div id="worktreeList"></div>
    </div>
    <div class="tsec">
      <h3><svg class="ico ico-sm" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>ZERO-KEY SESSIONS</h3>
      <div class="tblock" id="authList">Scanning local CLI credentials…</div>
    </div>
    <div class="tsec">
      <h3><svg class="ico ico-sm" viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>IDE FEED</h3>
      <div class="tblock" id="ideTranscriptBox">No active IDE session detected.</div>
    </div>
  </aside>
</div>

<!-- ══ MOBILE NAV ══ -->
<nav class="mobnav">
  <button id="mobBtnSquad" onclick="setMobileView('roster')">
    <svg class="ico" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    Squad
  </button>
  <button id="mobBtnComms" class="active" onclick="setMobileView('comms')">
    <svg class="ico" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    Chat
  </button>
  <button id="mobBtnInsp" onclick="setMobileView('insp')">
    <svg class="ico" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>
    Telemetry
  </button>
</nav>

<!-- ══ SPAWN MODAL ══ -->
<div class="modal-bg" id="spawnModal" onclick="if(event.target===this)closeSpawnModal()">
  <div class="modal">
    <h2>Add specialist coworker</h2>
    <div class="m-sub">Spawn a new agent into the mesh with its own role and preferred AI core.</div>
    <div class="field"><label>HANDLE</label><input id="spId" placeholder="sec-audit"/></div>
    <div class="field"><label>NAME</label><input id="spName" placeholder="Security & Hardening Auditor"/></div>
    <div class="field"><label>ROLE</label>
      <select id="spRole">
        <option value="writer">writer — modifies code in isolated worktree</option>
        <option value="reader">reader — read-only analysis</option>
      </select>
    </div>
    <div class="field"><label>PREFERRED CORE</label>
      <select id="spCore">
        <option value="auto">auto (best free model)</option>
        <option value="opencode">opencode</option>
        <option value="codex">codex</option>
        <option value="claude">claude</option>
        <option value="antigravity">antigravity</option>
      </select>
    </div>
    <div class="field"><label>PERSONA</label><textarea id="spDesc" rows="3" placeholder="System persona, domain boundaries, specialized instructions…"></textarea></div>
    <div class="m-actions">
      <button class="gbtn" onclick="closeSpawnModal()">Cancel</button>
      <button class="gbtn solid" onclick="submitSpawnAgent()">Create coworker</button>
    </div>
  </div>
</div>

<script>
  // 1. Secret fragment extraction (strip #k= from address bar immediately)
  let token = '${sessionToken}';
  if (window.location.hash.startsWith('#k=')) {
    token = decodeURIComponent(window.location.hash.slice(3));
    history.replaceState(null, '', window.location.pathname);
  } else if (window.location.hash.startsWith('#token=')) {
    token = decodeURIComponent(window.location.hash.slice(7));
    history.replaceState(null, '', window.location.pathname);
  }

  let currentChannel = 'all';
  let currentDelivery = 'send';
  let currentVerifyCmd = 'npm test';
  let agentsCache = [];
  let feedItems = [];
  let unreadMap = {};
  let stopArmedTimers = {};
  let stopAllArmed = false;
  let pendingScroll = false;
  let lastStateOkTs = 0;
  let sseState = 'CONNECTING';

  const SVG = {
    send: '<svg class="ico" viewBox="0 0 24 24"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
    stop: '<svg class="ico ico-sm" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    bolt: '<svg class="ico ico-sm" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    branch: '<svg class="ico ico-sm" viewBox="0 0 24 24"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>',
    arrowRight: '<svg class="ico ico-sm" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>'
  };

  const CORE_OPTIONS = [
    { value: 'auto', label: 'auto (best free)' },
    { value: 'opencode:opencode/deepseek-v4.1-flash-free', label: 'deepseek-v4.1-free' },
    { value: 'opencode:freemodel/claude-sonnet-4-6', label: 'sonnet-4.6-free' },
    { value: 'codex', label: 'codex (OAuth)' },
    { value: 'claude', label: 'claude-code' },
    { value: 'antigravity', label: 'antigravity-ide' }
  ];

  const TEMPLATES = [
    {
      title: 'Test & refactor a module',
      goal: 'Audit module architecture, refactor brittle functions, and verify all unit tests pass',
      check: 'npm test'
    },
    {
      title: 'Parallel worktree feature',
      goal: 'Implement the feature in an isolated Git worktree, add regression tests, then run a reviewer audit',
      check: 'npm test'
    },
    {
      title: 'Security & policy audit',
      goal: 'Perform OWASP security, input boundary, and race-condition audit across all API handlers',
      check: 'npm test'
    }
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

  // 2. Live SSE stream with replay & honest POLLING fallback
  function setConnState(state, seq) {
    sseState = state;
    const pill = document.getElementById('connPill');
    let label = state;
    if (state !== 'LIVE' && lastStateOkTs > 0 && Date.now() - lastStateOkTs < 9000) {
      label = 'POLLING';
    }
    document.getElementById('sseText').innerText = label;
    pill.className = 'conn ' + label;
    if (seq !== undefined) {
      document.getElementById('seqPill').innerText = '#' + seq;
    }
  }

  let esHandle = null;
  function connectStream() {
    if (esHandle) { try { esHandle.close(); } catch {} }
    const es = new EventSource('/api/events?token=' + encodeURIComponent(token));
    esHandle = es;
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
        id: p.id || ('evt-' + frame.seq),
        from: p.fromId || p.from || 'commander',
        to: p.targetId || p.agentId || 'all',
        delivery: p.delivery || (p.priority ? 'interrupt' : 'send'),
        message: p.message || p.summary || '',
        reply: p.reply || null,
        core: p.harnessId ? (p.harnessId + ':' + (p.modelId || '')) : (p.core || null),
        ts: new Date().toLocaleTimeString()
      });
    }
    refreshState();
  }

  function bumpUnread(item) {
    const ch = currentChannel;
    const involves = (id) => item.from === id || item.to === id;
    if (!(ch === 'all' || involves(ch))) {
      [item.from, item.to].forEach((id) => {
        if (id && id !== 'commander' && id !== 'all') {
          unreadMap[id] = (unreadMap[id] || 0) + 1;
        }
      });
    }
  }

  function hasDuplicateItem(item) {
    if (item.id && feedItems.some((x) => x.id === item.id)) return true;
    const recent = feedItems.slice(-4);
    return recent.some((x) => x.from === item.from && x.to === item.to && x.message === item.message);
  }

  function pushTimelineEvent(item) {
    if (hasDuplicateItem(item)) return;
    feedItems.push(item);
    if (feedItems.length > 300) feedItems.shift();
    bumpUnread(item);
    document.getElementById('totalHandoffsBadge').innerText = String(feedItems.length);
    document.getElementById('totalHandoffsBadge').classList.toggle('hidden', false);
    renderRoster(agentsCache);
    renderThread();
  }

  // 3. State snapshot (merges new handoffs continuously so POLLING mode never misses messages)
  async function refreshState() {
    try {
      const res = await api('/api/state');
      if (!res.ok) return;
      const data = await res.json();
      lastStateOkTs = Date.now();
      if (sseState !== 'LIVE') setConnState(sseState);

      agentsCache = data.agents || [];
      renderRoster(agentsCache);
      renderHeader();
      renderWorktrees(agentsCache);
      renderAuthAndIde(data.auth || {}, data.latestIdeLog);

      if (Array.isArray(data.handoffs) && data.handoffs.length > 0) {
        let added = false;
        for (const h of data.handoffs) {
          const candidate = {
            id: h.id,
            from: h.fromAgentId,
            to: h.targetAgentId,
            delivery: h.delivery || (h.priority ? 'interrupt' : 'send'),
            message: h.summary,
            reply: null,
            core: h.core || null,
            ts: new Date(h.createdAt).toLocaleTimeString()
          };
          if (!hasDuplicateItem(candidate)) {
            feedItems.push(candidate);
            added = true;
          }
        }
        if (added) {
          if (feedItems.length > 300) feedItems = feedItems.slice(-300);
          document.getElementById('totalHandoffsBadge').innerText = String(feedItems.length);
          document.getElementById('totalHandoffsBadge').classList.toggle('hidden', false);
          renderThread();
        } else {
          renderThread();
        }
      } else if (feedItems.length === 0) {
        renderThread();
      }
    } catch {}
  }

  function statusOf(a) {
    if (a.status === 'running') {
      return a.elapsedMs > 90000 ? 'stale' : 'running';
    }
    if (a.status === 'error' || a.status === 'aborted') return 'error';
    if ((a.inboxCount || 0) > 0 || (a.pendingSteers || 0) > 0) return 'queued';
    return a.status || 'idle';
  }

  function renderRoster(agents) {
    document.getElementById('squadCount').innerText = agents.length + ' AGENTS';
    const container = document.getElementById('rosterContainer');
    container.innerHTML = agents.map((a) => {
      const st = statusOf(a);
      const elapsed = a.status === 'running' && a.elapsedMs ? Math.round(a.elapsedMs / 1000) + 's' : '';
      const unread = unreadMap[a.id] || 0;
      const selected = currentChannel === a.id;
      const roleLabel = a.id === 'lead' ? 'lead' : (a.role || 'writer');
      const lastAct = Array.isArray(a.recentActivity) && a.recentActivity.length > 0
        ? a.recentActivity[a.recentActivity.length - 1]
        : (a.name || a.preferredCore || 'idle');
      return \`
        <div class="chan \${selected ? 'active' : ''}" onclick="selectChannel('\${esc(a.id)}')">
          <span class="dot \${esc(st)}"></span>
          <div class="chan-body">
            <div class="chan-row">
              <span class="hash">@\${esc(a.id)}</span>
              <span class="role-pill">\${esc(roleLabel)}</span>
              \${unread ? '<span class="badge">' + unread + '</span>' : (elapsed ? '<span class="sub mono">' + elapsed + '</span>' : '')}
            </div>
            <div class="sub">\${esc(lastAct)}</div>
          </div>
        </div>\`;
    }).join('');
  }

  function renderHeader() {
    const head = document.getElementById('chatHead');
    const active = document.activeElement;
    if (active && head.contains(active) && active.tagName === 'SELECT') return;
    if (currentChannel === 'all') {
      const running = agentsCache.filter((a) => statusOf(a) === 'running').length;
      head.innerHTML = \`
        <div class="ch-id">
          <span class="dot \${running > 0 ? 'running' : ''}"></span>
          <div style="min-width:0">
            <div class="ch-title">#mesh-command-room</div>
            <div class="ch-sub">\${agentsCache.length} agents · \${running > 0 ? running + ' running now · ' : ''}all inter-agent handoffs & tool calls</div>
          </div>
        </div>
        <div class="ch-actions">
          <button class="gbtn \${stopAllArmed ? 'danger-armed' : ''}" id="stopAllBtn" onclick="triggerStopAll()">
            \${SVG.stop}<span id="stopAllText">\${stopAllArmed ? 'Confirm (3s)' : 'Stop all'}</span>
          </button>
          <button class="gbtn tele-toggle" onclick="toggleTelemetry()">Telemetry</button>
        </div>\`;
      return;
    }

    const a = agentsCache.find((x) => x.id === currentChannel);
    if (!a) { head.innerHTML = '<div class="ch-id"><div class="ch-title">@' + esc(currentChannel) + '</div></div>'; return; }
    const st = statusOf(a);
    const elapsed = a.status === 'running' && a.elapsedMs ? ' · ' + Math.round(a.elapsedMs / 1000) + 's' : '';
    const isWriter = (a.role || 'writer') === 'writer';
    const isArmed = Boolean(stopArmedTimers[a.id]);
    const coreOpts = CORE_OPTIONS.map((c) =>
      \`<option value="\${esc(c.value)}" \${a.preferredCore === c.value ? 'selected' : ''}>\${esc(c.label)}</option>\`
    ).join('');

    head.innerHTML = \`
      <div class="ch-id">
        <span class="dot \${esc(st)}"></span>
        <div style="min-width:0">
          <div class="ch-title">@\${esc(a.id)} <span style="color:var(--fg-3);font-weight:400">· \${esc(a.name)}</span></div>
          <div class="ch-sub">\${esc(st.toUpperCase())}\${elapsed} · \${a.toolCallCount || 0} calls · inbox \${a.inboxCount || 0} · steers \${a.pendingSteers || 0}</div>
        </div>
      </div>
      <div class="ch-actions">
        <select class="core-sel" onchange="changeAgentCore('\${esc(a.id)}', this.value)" title="Hot-swap AI core / model">
          \${coreOpts}
        </select>
        \${isWriter ? \`<button class="gbtn" onclick="mergeAgentWorktree('\${esc(a.id)}')" title="Verify (\${esc(currentVerifyCmd)}) & merge isolated worktree into main">\${SVG.branch} Merge</button>\` : ''}
        <button class="gbtn \${isArmed ? 'danger-armed' : ''}" onclick="armOrStopAgent('\${esc(a.id)}')">
          \${SVG.stop}<span>\${isArmed ? 'Confirm (3s)' : 'Stop'}</span>
        </button>
        <button class="gbtn tele-toggle" onclick="toggleTelemetry()">Telemetry</button>
      </div>\`;
  }

  function filteredFeed() {
    return currentChannel === 'all'
      ? feedItems
      : feedItems.filter((x) => x.from === currentChannel || x.to === currentChannel);
  }

  function renderThread() {
    const el = document.getElementById('threadEl');
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
    const items = filteredFeed();
    const runningAgents = agentsCache.filter(
      (a) => a.status === 'running' && (currentChannel === 'all' || a.id === currentChannel)
    );

    if (items.length === 0 && runningAgents.length === 0) {
      el.innerHTML = currentChannel === 'all' ? renderHero() : renderAgentEmpty();
      pendingScroll = false;
      updateNewPill(0);
      return;
    }

    const sepHtml = '<div class="day-sep"><span>SESSION TRANSCRIPT · HANDOFF PROTOCOL v1</span></div>';
    const msgsHtml = items.map((item) => {
      const mine = item.from === 'commander';
      const system = item.to === 'main-branch' || item.from === 'main-branch';
      return \`
        <div class="msg \${mine ? 'out' : ''} \${system ? 'system' : ''}">
          <div class="msg-meta">
            <span class="who">@\${esc(item.from)}</span>
            \${SVG.arrowRight}
            <span class="who">@\${esc(item.to)}</span>
            <span class="deliv \${esc(item.delivery || 'send')}">\${esc(item.delivery || 'send')}</span>
            \${item.core ? '<span class="core-tag">' + esc(item.core) + '</span>' : ''}
            <span>\${esc(item.ts)}</span>
          </div>
          <div class="bubble">\${esc(item.message)}\${item.reply ? '<div class="quote">' + esc(item.reply) + '</div>' : ''}</div>
        </div>\`;
    }).join('');

    const runningHtml = runningAgents.map((a) => {
      const sec = a.elapsedMs ? Math.round(a.elapsedMs / 1000) + 's' : '0s';
      const act = Array.isArray(a.recentActivity) && a.recentActivity.length > 0
        ? a.recentActivity[a.recentActivity.length - 1]
        : 'Executing agent turn…';
      return \`
        <div class="live-activity">
          <span class="dot running"></span>
          <span><b>@\${esc(a.id)}</b> (\${sec}) — \${esc(act)}</span>
        </div>\`;
    }).join('');

    el.innerHTML = sepHtml + msgsHtml + runningHtml;

    if (nearBottom || pendingScroll) {
      el.scrollTop = el.scrollHeight;
      pendingScroll = false;
    }
    updateNewPill(items.length);
  }

  function updateNewPill(count) {
    const el = document.getElementById('threadEl');
    const pill = document.getElementById('newPill');
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
    pill.style.display = (!atBottom && count > 0) ? 'inline-flex' : 'none';
  }

  function jumpToLatest() {
    const el = document.getElementById('threadEl');
    el.scrollTop = el.scrollHeight;
  }

  function renderHero() {
    const chips = TEMPLATES.map((t, i) => \`
      <button class="chip" onclick="prefillMission(\${i})">
        <span><b>\${esc(t.title)}</b> — \${esc(t.goal.slice(0, 64))}…</span>
        <span class="go">USE ↵</span>
      </button>\`).join('');
    return \`
      <div class="hero">
        <h1>Mission ready.</h1>
        <p>Dispatch a goal to the squad — <b>@lead</b> decomposes, <b>@coder</b> implements in an isolated Git worktree, <b>@reviewer</b> verifies. Or pick a template:</p>
        <div class="chips">\${chips}</div>
      </div>\`;
  }

  function renderAgentEmpty() {
    const a = agentsCache.find((x) => x.id === currentChannel);
    const name = a ? a.name : currentChannel;
    return \`
      <div class="hero">
        <h1>@\${esc(currentChannel)}</h1>
        <p>\${esc(name || '')}. No messages in this thread yet — send the first directive with the composer below.</p>
        <div class="chips">
          <button class="chip" onclick="quickChip('Give a one-paragraph status report on current progress.')"><span><b>Status report</b> — ask for a progress summary</span><span class="go">USE ↵</span></button>
          <button class="chip" onclick="quickChip('Stay on scope. Do not touch files outside the module. Prioritize passing tests.')"><span><b>Steer scope</b> — keep the agent on target</span><span class="go">USE ↵</span></button>
        </div>
      </div>\`;
  }

  function quickChip(text) {
    const input = document.getElementById('composerInput');
    input.value = text;
    input.focus();
    autoGrow(input);
  }

  function prefillMission(idx) {
    const t = TEMPLATES[idx] || TEMPLATES[0];
    const input = document.getElementById('composerInput');
    input.value = t.goal;
    currentVerifyCmd = t.check;
    const checkEl = document.getElementById('checkInput');
    if (checkEl) checkEl.value = t.check;
    autoGrow(input);
    input.focus();
  }

  function focusNewMission() {
    selectChannel('all');
    setMobileView('comms');
    const input = document.getElementById('composerInput');
    input.focus();
    autoGrow(input);
  }

  // 4. Composer
  function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
  }

  function syncVerifyCmd(val) {
    currentVerifyCmd = String(val || '').trim();
  }

  function renderComposerRow() {
    const row = document.getElementById('compRow');
    const input = document.getElementById('composerInput');
    if (currentChannel === 'all') {
      input.placeholder = 'Describe the mission for the squad — @lead will coordinate @coder and @reviewer…';
      row.innerHTML = \`
        <input class="check-in" id="checkInput" placeholder="verify: npm test" value="\${esc(currentVerifyCmd)}" oninput="syncVerifyCmd(this.value)" title="Verification command required before completion"/>
        <button class="sendbtn" id="sendBtn" onclick="submitComposer()" title="Dispatch mission">\${SVG.send}</button>\`;
      document.getElementById('compHint').innerHTML =
        '<b>Enter</b> dispatch mission · @lead → @coder (worktree) → @reviewer · auto-failover on 429';
    } else {
      input.placeholder = 'Message @' + esc(currentChannel) + ' — direct instruction, course correction, or handoff…';
      const agents = agentsCache.length ? agentsCache : [{ id: currentChannel, name: currentChannel }];
      const opts = '<option value="all">@all (broadcast)</option>' +
        agents.map((a) => \`<option value="\${esc(a.id)}" \${a.id === currentChannel ? 'selected' : ''}>@\${esc(a.id)}</option>\`).join('');
      row.innerHTML = \`
        <select class="tgt-sel" id="dockTarget" onchange="syncChannelFromTarget()" title="Target coworker">\${opts}</select>
        <div class="seg" title="Delivery mode">
          <button id="modeSend" class="\${currentDelivery === 'send' ? 'active' : ''}" onclick="setDeliveryMode('send')">SEND</button>
          <button id="modeInterrupt" class="\${currentDelivery === 'interrupt' ? 'active' : ''}" onclick="setDeliveryMode('interrupt')">INTERRUPT</button>
          <button id="modeQueue" class="\${currentDelivery === 'queue' ? 'active' : ''}" onclick="setDeliveryMode('queue')">QUEUE</button>
        </div>
        <input class="check-in" id="checkInput" placeholder="verify cmd (optional)" value="\${esc(currentVerifyCmd)}" oninput="syncVerifyCmd(this.value)" title="Verification command used when merging worktree"/>
        <label class="wait-toggle" title="Run a full agent turn and stream the reply back"><input type="checkbox" id="dockRunTurn" checked/>run turn</label>
        <button class="sendbtn" id="sendBtn" onclick="submitComposer()" title="Transmit">\${SVG.send}</button>\`;
      document.getElementById('compHint').innerHTML =
        '<b>Enter</b> transmit · <b>Shift+Enter</b> newline · SEND delivers now · INTERRUPT kills the running turn first · QUEUE waits for turn end';
    }
  }

  function syncChannelFromTarget() {
    const sel = document.getElementById('dockTarget');
    if (!sel || sel.value === 'all') return;
    if (sel.value !== currentChannel) selectChannel(sel.value);
  }

  function setDeliveryMode(mode) {
    currentDelivery = mode;
    ['send', 'interrupt', 'queue'].forEach((m) => {
      const btn = document.getElementById('mode' + m.charAt(0).toUpperCase() + m.slice(1));
      if (btn) btn.className = m === mode ? 'active' : '';
    });
  }

  async function submitComposer() {
    const input = document.getElementById('composerInput');
    const text = input.value.trim();
    if (!text) return;

    if (currentChannel === 'all') {
      const checkEl = document.getElementById('checkInput');
      if (checkEl) currentVerifyCmd = checkEl.value.trim();
      const check = currentVerifyCmd || null;
      input.value = '';
      autoGrow(input);
      await launchTeamMission(text, check);
      return;
    }

    const target = document.getElementById('dockTarget').value;
    const wait = document.getElementById('dockRunTurn').checked;
    input.value = '';
    autoGrow(input);
    await sendDockMessage(target, text, wait);
  }

  async function sendDockMessage(target, text, wait) {
    const nonce = makeNonce();
    pendingScroll = true;
    const res = await api('/api/agents/' + encodeURIComponent(target) + '/message', {
      method: 'POST',
      body: JSON.stringify({ nonce, text, delivery: currentDelivery, wait })
    });
    const out = await res.json().catch(() => ({}));
    setHint(out.status === 'duplicate'
      ? 'Duplicate nonce ignored — nothing re-sent'
      : 'Acked · ' + (out.status || out.delivered || currentDelivery));
    refreshState();
  }

  async function launchTeamMission(goal, check) {
    const nonce = makeNonce();
    pendingScroll = true;
    const res = await api('/api/team/start', {
      method: 'POST',
      body: JSON.stringify({ nonce, goal, check: check || null })
    });
    const out = await res.json().catch(() => ({}));
    setHint(out.status === 'dispatched'
      ? 'Mission dispatched to @lead — live progress streams below'
      : 'Dispatch reply: ' + JSON.stringify(out));
    refreshState();
  }

  function setHint(html) {
    const hint = document.getElementById('compHint');
    const prev = hint.dataset.base || hint.innerHTML;
    hint.dataset.base = prev;
    hint.innerHTML = '<b>' + esc(html) + '</b>';
    setTimeout(() => { if (hint.dataset.base) hint.innerHTML = hint.dataset.base; }, 4000);
  }

  // 5. Channel & controls
  function selectChannel(chanId) {
    const checkEl = document.getElementById('checkInput');
    if (checkEl) currentVerifyCmd = checkEl.value.trim();
    currentChannel = chanId;
    unreadMap[chanId] = 0;
    document.getElementById('chanAll').className = 'chan' + (chanId === 'all' ? ' active' : '');
    renderRoster(agentsCache);
    renderHeader();
    renderComposerRow();
    pendingScroll = true;
    renderThread();
    setMobileView('comms');
  }

  async function changeAgentCore(agentId, preferredCore) {
    await api('/api/agents/' + encodeURIComponent(agentId) + '/core', {
      method: 'POST',
      body: JSON.stringify({ nonce: makeNonce(), preferredCore })
    });
    setHint('@' + agentId + ' core → ' + preferredCore);
    refreshState();
  }

  async function armOrStopAgent(agentId) {
    if (!stopArmedTimers[agentId]) {
      stopArmedTimers[agentId] = setTimeout(() => {
        delete stopArmedTimers[agentId];
        renderHeader();
      }, 3000);
      renderHeader();
      return;
    }
    clearTimeout(stopArmedTimers[agentId]);
    delete stopArmedTimers[agentId];
    await api('/api/agents/' + encodeURIComponent(agentId) + '/stop', {
      method: 'POST',
      body: JSON.stringify({ nonce: makeNonce(), confirm: true })
    });
    setHint('@' + agentId + ' stopped');
    refreshState();
  }

  async function triggerStopAll() {
    if (!stopAllArmed) {
      stopAllArmed = true;
      renderHeader();
      setTimeout(() => { stopAllArmed = false; renderHeader(); }, 3000);
      return;
    }
    stopAllArmed = false;
    renderHeader();
    await api('/api/agents/stop-all', {
      method: 'POST',
      body: JSON.stringify({ nonce: makeNonce(), confirm: true })
    });
    setHint('All agents stopped');
    refreshState();
  }

  async function mergeAgentWorktree(agentId) {
    const checkEl = document.getElementById('checkInput');
    if (checkEl) currentVerifyCmd = checkEl.value.trim();
    const verifyCmd = currentVerifyCmd || null;
    const res = await api('/api/agents/' + encodeURIComponent(agentId) + '/merge', {
      method: 'POST',
      body: JSON.stringify({ nonce: makeNonce(), verifyCmd })
    });
    const out = await res.json().catch(() => ({}));
    pendingScroll = true;
    pushTimelineEvent({
      id: 'merge-' + Date.now(),
      from: agentId,
      to: 'main-branch',
      delivery: 'send',
      message: out.success
        ? 'Worktree verified & merged into main (commit ' + (out.sha || 'HEAD') + ')'
        : 'Merge aborted (' + (out.reason || 'conflict') + '): ' + JSON.stringify(out.conflicts || out.error || ''),
      ts: new Date().toLocaleTimeString()
    });
    refreshState();
  }

  function toggleTelemetry() {
    if (window.innerWidth < 1150) {
      document.getElementById('appEl').classList.toggle('mob-insp');
      return;
    }
    const el = document.getElementById('teleEl');
    el.classList.toggle('hidden');
  }

  function closeTelemetry() {
    document.getElementById('appEl').classList.remove('mob-insp');
    if (window.innerWidth >= 1150) {
      document.getElementById('teleEl').classList.add('hidden');
    } else {
      setMobileView('comms');
    }
  }

  // 6. Telemetry rail
  function renderWorktrees(agents) {
    const wtList = document.getElementById('worktreeList');
    const writers = agents.filter((a) => (a.role || 'writer') === 'writer');
    if (writers.length === 0) {
      wtList.innerHTML = '<div class="tblock">No writer agents registered.</div>';
      return;
    }
    wtList.innerHTML = writers.map((w) => \`
      <div class="wt-row">
        <div class="wt-top">
          <span class="wt-id">@\${esc(w.id)}</span>
          <span class="dot \${esc(statusOf(w))}"></span>
        </div>
        <div class="wt-branch">botautotask/agent-\${esc(w.id)}</div>
        <div class="wt-path">\${esc(w.worktreePath || '.botautotask/worktrees/' + w.id)}</div>
        <button class="wt-merge" onclick="mergeAgentWorktree('\${esc(w.id)}')">
          \${SVG.branch} Verify & merge
        </button>
      </div>\`).join('');
  }

  function renderAuthAndIde(auth, ideLog) {
    const authEl = document.getElementById('authList');
    const entries = Object.entries(auth || {});
    if (entries.length === 0) {
      authEl.innerText = 'No auth bridge data.';
    } else {
      authEl.innerHTML = entries.map(([k, v]) => {
        const ok = v.authenticated || v.signedIn;
        const badge = ok ? '● IN' : (v.installed ? '○ INSTALLED' : '○ NOT FOUND');
        return '<span class="auth-line"><span>' + esc(k) + '</span><span class="st ' + (ok ? 'ok' : 'no') + '">' + badge + '</span></span>';
      }).join('');
    }

    const ideEl = document.getElementById('ideTranscriptBox');
    if (!ideLog) {
      ideEl.innerText = 'No active Antigravity IDE transcript found.';
    } else {
      ideEl.innerText = 'Status: ' + (ideLog.status || 'IDLE') + '\\n\\n' + (ideLog.lastResponse || '');
    }
  }

  // 7. Spawn modal
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
    if (id) selectChannel(id);
    refreshState();
  }

  // 8. Mobile views
  function setMobileView(view) {
    const app = document.getElementById('appEl');
    app.classList.remove('mob-roster', 'mob-insp');
    if (view === 'roster') app.classList.add('mob-roster');
    if (view === 'insp') app.classList.add('mob-insp');
    document.getElementById('mobBtnSquad').className = view === 'roster' ? 'active' : '';
    document.getElementById('mobBtnComms').className = view === 'comms' ? 'active' : '';
    document.getElementById('mobBtnInsp').className = view === 'insp' ? 'active' : '';
  }

  // 9. Boot
  const composerInput = document.getElementById('composerInput');
  composerInput.addEventListener('input', () => autoGrow(composerInput));
  composerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitComposer();
    }
  });
  document.getElementById('threadEl').addEventListener('scroll', () => updateNewPill(filteredFeed().length));

  renderComposerRow();
  renderHeader();
  connectStream();
  refreshState();
  setInterval(() => {
    if (!document.hidden) refreshState();
  }, 2500);
  // Watchdog: reconnect whenever sseState !== 'LIVE' (including when displaying POLLING) or EventSource is CLOSED
  setInterval(() => {
    if (!esHandle || esHandle.readyState === 2 || sseState !== 'LIVE') connectStream();
  }, 5000);
</script>
</body>
</html>`;
}
