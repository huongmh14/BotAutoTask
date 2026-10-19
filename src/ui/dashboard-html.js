/**
 * BotAutoTask — Tactical Multi-Agent Coworker Command Center UI (UI/UX Pro Max Edition).
 * Designed with OLED Dark Mode + Bento Grid Architecture, Fira Code + Plus Jakarta Sans typography,
 * 100% vector SVG iconography (zero emoji icons), interactive Coworker Topology Pipeline,
 * 3-Mode Delivery Dock (Send / Interrupt / Queue), 2-Step Confirm Stop, Isolated Git Worktree Merger,
 * and Closed-Loop Completion Contract Telemetry.
 * Zero external runtime dependencies — pure embedded HTML5/CSS3/ES2022.
 */

export function renderDashboardHtml(sessionToken = '', { mode = 'local', cloudUrl = '' } = {}) {
  return `<!doctype html>
<html lang="vi" class="dark">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>BotAutoTask — Tactical Coworker Mesh</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
  :root {
    color-scheme: dark;
    /* OLED Dark Mode + Bento Surface Hierarchy */
    --bg-void: #05070b;
    --bg-canvas: #080b11;
    --bg-surface: #0c1018;
    --bg-elevated: #111722;
    --bg-card: #141c2b;
    --bg-hover: #1a2436;
    --bg-glass: rgba(17, 23, 34, 0.82);

    /* Hairline Borders & Inner Highlights */
    --border-subtle: rgba(255, 255, 255, 0.06);
    --border-dim: #1e293b;
    --border-bright: #334155;
    --border-focus: #38bdf8;
    --shadow-card: 0 4px 20px -2px rgba(0, 0, 0, 0.55), inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
    --shadow-float: 0 12px 32px -4px rgba(0, 0, 0, 0.7), inset 0 1px 0 0 rgba(255, 255, 255, 0.07);

    /* Typography Hierarchy */
    --fg-primary: #f8fafc;
    --fg-secondary: #94a3b8;
    --fg-muted: #64748b;

    /* Semantic Accents (UI/UX Pro Max Developer Console Palette) */
    --emerald: #22c55e;
    --emerald-dim: rgba(34, 197, 94, 0.14);
    --emerald-border: rgba(34, 197, 94, 0.35);

    --cyan: #38bdf8;
    --cyan-dim: rgba(56, 189, 248, 0.14);
    --cyan-border: rgba(56, 189, 248, 0.35);

    --amber: #f59e0b;
    --amber-dim: rgba(245, 158, 11, 0.14);
    --amber-border: rgba(245, 158, 11, 0.38);

    --violet: #a855f7;
    --violet-dim: rgba(168, 85, 247, 0.14);
    --violet-border: rgba(168, 85, 247, 0.35);

    --rose: #f43f5e;
    --rose-dim: rgba(244, 63, 94, 0.14);
    --rose-border: rgba(244, 63, 94, 0.38);

    --font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --font-mono: 'Fira Code', 'JetBrains Mono', 'Cascadia Code', ui-monospace, Consolas, monospace;
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 14px;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    height: 100%;
    background: var(--bg-void);
    color: var(--fg-primary);
    font-family: var(--font-sans);
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
    user-select: none;
  }

  /* Custom Scrollbars */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 999px; }
  ::-webkit-scrollbar-thumb:hover { background: #334155; }

  /* SVG Icon Base */
  .ico {
    width: 15px;
    height: 15px;
    stroke: currentColor;
    stroke-width: 1.75;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: none;
    flex-shrink: 0;
  }
  .ico-sm { width: 13px; height: 13px; }
  .ico-lg { width: 18px; height: 18px; }

  /* ─── TOP COMMAND HEADER ─── */
  .topbar {
    height: 56px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border-dim);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    gap: 16px;
    flex-shrink: 0;
    z-index: 20;
  }
  .brand-cluster {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .brand-mark {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    background: linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(168, 85, 247, 0.2));
    border: 1px solid rgba(56, 189, 248, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--cyan);
    box-shadow: 0 0 20px rgba(56, 189, 248, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.15);
  }
  .brand-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .brand-title {
    font-weight: 700;
    font-size: 0.96rem;
    letter-spacing: -0.02em;
    color: var(--fg-primary);
  }
  .mode-badge {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 999px;
    background: var(--cyan-dim);
    color: var(--cyan);
    border: 1px solid var(--cyan-border);
    letter-spacing: 0.04em;
  }
  .brand-sub {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--fg-muted);
    margin-top: 1px;
  }

  .telemetry-strip {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 5px 11px;
    border-radius: 999px;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
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
  .pill.LIVE {
    border-color: var(--emerald-border);
    color: var(--emerald);
    background: var(--emerald-dim);
  }
  .pill.LIVE .dot {
    background: var(--emerald);
    box-shadow: 0 0 8px var(--emerald);
    animation: pulseDot 2s infinite;
  }
  .pill.STALE {
    border-color: var(--amber-border);
    color: var(--amber);
    background: var(--amber-dim);
  }
  .pill.STALE .dot { background: var(--amber); }
  .pill.DISCONNECTED {
    border-color: var(--rose-border);
    color: var(--rose);
    background: var(--rose-dim);
  }
  .pill.DISCONNECTED .dot { background: var(--rose); }

  @keyframes pulseDot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.55; transform: scale(0.92); }
  }

  /* ─── BUTTONS & FORM CONTROLS ─── */
  button {
    font-family: var(--font-sans);
    font-size: 0.8rem;
    font-weight: 600;
    padding: 7px 13px;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 180ms cubic-bezier(0.16, 1, 0.3, 1);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    background: var(--emerald);
    color: #03140a;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
  }
  button:hover { filter: brightness(1.08); transform: translateY(-0.5px); }
  button:active { transform: translateY(0.5px); }
  button:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }

  button.btn-primary-cyan {
    background: var(--cyan);
    color: #031521;
  }
  button.btn-ghost {
    background: var(--bg-elevated);
    color: var(--fg-primary);
    border-color: var(--border-dim);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }
  button.btn-ghost:hover {
    background: var(--bg-hover);
    border-color: var(--border-bright);
  }
  button.btn-amber {
    background: var(--amber-dim);
    color: var(--amber);
    border-color: var(--amber-border);
    box-shadow: none;
  }
  button.btn-amber:hover { background: rgba(245, 158, 11, 0.22); }
  button.btn-danger {
    background: var(--rose-dim);
    color: var(--rose);
    border-color: var(--rose-border);
    box-shadow: none;
  }
  button.btn-danger:hover { background: rgba(244, 63, 94, 0.22); }
  button.btn-danger.armed {
    background: var(--rose);
    color: #fff;
    border-color: var(--rose);
    box-shadow: 0 0 16px rgba(244, 63, 94, 0.45);
  }
  button.btn-emerald {
    background: var(--emerald-dim);
    color: var(--emerald);
    border-color: var(--emerald-border);
    box-shadow: none;
  }
  button.btn-emerald:hover { background: rgba(34, 197, 94, 0.22); }

  input, select, textarea {
    background: var(--bg-void);
    color: var(--fg-primary);
    border: 1px solid var(--border-dim);
    border-radius: var(--radius-sm);
    padding: 8px 12px;
    font-family: var(--font-sans);
    font-size: 0.83rem;
    outline: none;
    transition: border-color 160ms ease, box-shadow 160ms ease;
  }
  input::placeholder, textarea::placeholder { color: var(--fg-muted); }
  input:focus, select:focus, textarea:focus {
    border-color: var(--border-focus);
    box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.14);
  }
  select {
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 9px center;
    padding-right: 28px;
    cursor: pointer;
  }

  /* Custom Switch Toggle */
  .toggle-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--fg-secondary);
  }
  .toggle-label input {
    appearance: none;
    width: 30px;
    height: 17px;
    background: var(--bg-void);
    border: 1px solid var(--border-bright);
    border-radius: 999px;
    position: relative;
    padding: 0;
    cursor: pointer;
    transition: all 160ms ease;
  }
  .toggle-label input::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: var(--fg-muted);
    transition: all 160ms ease;
  }
  .toggle-label input:checked {
    background: var(--emerald-dim);
    border-color: var(--emerald);
  }
  .toggle-label input:checked::after {
    left: 15px;
    background: var(--emerald);
    box-shadow: 0 0 6px var(--emerald);
  }

  /* ─── 3-COLUMN TACTICAL WORKSPACE ─── */
  .workspace {
    display: grid;
    grid-template-columns: 305px 1fr 345px;
    height: calc(100vh - 56px);
    overflow: hidden;
  }

  /* ─── LEFT COLUMN: ROOMS & COWORKER SQUAD ROSTER ─── */
  .sidebar {
    background: var(--bg-surface);
    border-right: 1px solid var(--border-dim);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .section-hdr {
    padding: 14px 16px 8px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--fg-muted);
    text-transform: uppercase;
  }
  .channel-list {
    padding: 0 12px 10px;
    border-bottom: 1px solid var(--border-dim);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .channel-item {
    padding: 8px 11px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--fg-secondary);
    border: 1px solid transparent;
    transition: all 150ms ease;
  }
  .channel-item:hover {
    background: var(--bg-elevated);
    color: var(--fg-primary);
  }
  .channel-item.active {
    background: var(--cyan-dim);
    color: var(--cyan);
    border-color: var(--cyan-border);
  }
  .channel-name {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }

  .roster-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .coworker-card {
    background: var(--bg-elevated);
    border: 1px solid var(--border-dim);
    border-radius: var(--radius-md);
    padding: 12px;
    cursor: pointer;
    transition: all 180ms cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: var(--shadow-card);
    position: relative;
  }
  .coworker-card:hover {
    border-color: var(--border-bright);
    background: var(--bg-card);
  }
  .coworker-card.selected {
    border-color: var(--cyan);
    background: var(--bg-card);
    box-shadow: inset 3px 0 0 var(--cyan), var(--shadow-card);
  }
  .coworker-card.running {
    border-color: var(--emerald-border);
  }

  .cw-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }
  .cw-identity {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }
  .cw-avatar {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 1px solid var(--border-bright);
    background: var(--bg-void);
    color: var(--cyan);
    position: relative;
  }
  .cw-avatar.writer {
    color: var(--violet);
    border-color: var(--violet-border);
    background: var(--violet-dim);
  }
  .cw-avatar.reader {
    color: var(--cyan);
    border-color: var(--cyan-border);
    background: var(--cyan-dim);
  }
  .cw-title-group {
    min-width: 0;
  }
  .cw-handle-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .cw-handle {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 0.82rem;
    color: var(--fg-primary);
  }
  .role-tag {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .role-tag.writer { background: var(--violet-dim); color: #d8b4fe; border: 1px solid var(--violet-border); }
  .role-tag.reader { background: var(--cyan-dim); color: var(--cyan); border: 1px solid var(--cyan-border); }

  .cw-fullname {
    font-size: 0.74rem;
    color: var(--fg-secondary);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cw-status {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    padding: 2px 7px;
    border-radius: 999px;
    background: var(--bg-void);
    color: var(--fg-muted);
    border: 1px solid var(--border-dim);
    flex-shrink: 0;
  }
  .cw-status.running { color: var(--emerald); background: var(--emerald-dim); border-color: var(--emerald-border); }
  .cw-status.stale { color: var(--amber); background: var(--amber-dim); border-color: var(--amber-border); }
  .cw-status.aborted, .cw-status.error { color: var(--rose); background: var(--rose-dim); border-color: var(--rose-border); }

  .cw-desc {
    font-size: 0.75rem;
    color: var(--fg-muted);
    line-height: 1.4;
    margin-bottom: 9px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .cw-metrics {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    padding: 6px 8px;
    border-radius: var(--radius-sm);
    background: var(--bg-void);
    border: 1px solid var(--border-subtle);
    font-family: var(--font-mono);
    font-size: 0.67rem;
    font-variant-numeric: tabular-nums;
    color: var(--fg-secondary);
    margin-bottom: 9px;
  }
  .cw-metric-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .cw-controls {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .cw-controls select {
    flex: 1;
    padding: 5px 24px 5px 8px;
    font-size: 0.7rem;
    font-family: var(--font-mono);
    background-color: var(--bg-void);
    border-color: var(--border-dim);
  }
  .cw-controls button {
    padding: 5px 8px;
    font-size: 0.72rem;
    height: 28px;
  }

  /* ─── CENTER COLUMN: MISSION LAUNCHER, BENTO HERO & TIMELINE ─── */
  .center-stage {
    display: flex;
    flex-direction: column;
    background:
      radial-gradient(circle at 50% 0%, rgba(56, 189, 248, 0.06), transparent 55%),
      var(--bg-canvas);
    overflow: hidden;
    position: relative;
  }

  /* Top Mission Launcher Bar */
  .mission-bar {
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border-dim);
    padding: 12px 20px;
  }
  .mission-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .mission-input-wrap {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }
  .mission-input-wrap .ico {
    position: absolute;
    left: 12px;
    color: var(--cyan);
    pointer-events: none;
  }
  .mission-input-wrap input {
    width: 100%;
    padding-left: 36px;
    background: var(--bg-void);
    border-color: var(--border-bright);
    font-size: 0.84rem;
  }
  .verify-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
    width: 185px;
  }
  .verify-input-wrap .ico {
    position: absolute;
    left: 10px;
    color: var(--fg-muted);
    pointer-events: none;
  }
  .verify-input-wrap input {
    width: 100%;
    padding-left: 30px;
    font-family: var(--font-mono);
    font-size: 0.76rem;
    color: var(--emerald);
  }

  /* Sub-header Strip */
  .stream-header {
    padding: 8px 20px;
    background: rgba(12, 16, 24, 0.75);
    border-bottom: 1px solid var(--border-dim);
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.78rem;
    color: var(--fg-secondary);
  }
  .stream-breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Stream & Bento Canvas */
  .stream-canvas {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    user-select: text;
  }

  /* BENTO GRID HERO (When Feed is Empty or Overview Selected) */
  .bento-hero {
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 920px;
    width: 100%;
    margin: 0 auto;
    user-select: none;
  }
  .bento-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-dim);
    border-radius: var(--radius-lg);
    padding: 18px;
    box-shadow: var(--shadow-card);
  }
  .bento-hdr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }
  .bento-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-secondary);
  }

  /* Interactive Coworker Topology Pipeline */
  .topology-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    align-items: stretch;
  }
  .topo-node {
    background: var(--bg-elevated);
    border: 1px solid var(--border-dim);
    border-radius: var(--radius-md);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    cursor: pointer;
    transition: all 160ms ease;
    position: relative;
  }
  .topo-node:hover {
    border-color: var(--cyan-border);
    background: var(--bg-card);
    transform: translateY(-1px);
  }
  .topo-step {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--fg-muted);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .topo-name {
    font-weight: 700;
    font-size: 0.84rem;
    color: var(--fg-primary);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .topo-role {
    font-size: 0.72rem;
    color: var(--fg-secondary);
    line-height: 1.35;
  }

  /* Quick Mission Templates Bento Row */
  .templates-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  .tpl-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-dim);
    border-radius: var(--radius-md);
    padding: 14px;
    cursor: pointer;
    transition: all 180ms cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: var(--shadow-card);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 10px;
  }
  .tpl-card:hover {
    border-color: var(--emerald-border);
    background: var(--bg-elevated);
    transform: translateY(-2px);
  }
  .tpl-icon-wrap {
    width: 30px;
    height: 30px;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--emerald-dim);
    color: var(--emerald);
    border: 1px solid var(--emerald-border);
  }
  .tpl-title {
    font-weight: 700;
    font-size: 0.84rem;
    color: var(--fg-primary);
    margin-top: 6px;
  }
  .tpl-desc {
    font-size: 0.75rem;
    color: var(--fg-secondary);
    line-height: 1.4;
  }
  .tpl-action {
    font-family: var(--font-mono);
    font-size: 0.69rem;
    color: var(--emerald);
    display: flex;
    align-items: center;
    gap: 5px;
    font-weight: 600;
  }

  /* Live Feed Message Cards */
  .msg-node {
    background: var(--bg-surface);
    border: 1px solid var(--border-dim);
    border-radius: var(--radius-md);
    padding: 13px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: var(--shadow-card);
    animation: fadeIn 160ms ease-out;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .msg-node.interrupt {
    border-left: 3px solid var(--amber);
    background: linear-gradient(90deg, rgba(245, 158, 11, 0.06), var(--bg-surface) 35%);
  }
  .msg-node.handoff {
    border-left: 3px solid var(--cyan);
  }
  .msg-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-family: var(--font-mono);
    font-size: 0.73rem;
  }
  .route-flow {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .actor-chip {
    padding: 2px 8px;
    border-radius: 5px;
    background: var(--bg-elevated);
    color: var(--fg-primary);
    border: 1px solid var(--border-bright);
    font-weight: 600;
  }
  .actor-chip.commander {
    color: var(--amber);
    border-color: var(--amber-border);
    background: var(--amber-dim);
  }
  .delivery-tag {
    padding: 2px 7px;
    border-radius: 5px;
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .delivery-tag.interrupt { background: var(--amber-dim); color: var(--amber); border: 1px solid var(--amber-border); }
  .delivery-tag.queue { background: var(--violet-dim); color: #d8b4fe; border: 1px solid var(--violet-border); }
  .delivery-tag.send { background: var(--cyan-dim); color: var(--cyan); border: 1px solid var(--cyan-border); }

  .msg-body {
    font-size: 0.86rem;
    line-height: 1.55;
    color: var(--fg-primary);
    white-space: pre-wrap;
    word-break: break-word;
  }
  .msg-reply {
    margin-top: 4px;
    padding: 9px 12px;
    border-radius: var(--radius-sm);
    background: var(--bg-void);
    border: 1px solid var(--border-dim);
    font-family: var(--font-mono);
    font-size: 0.77rem;
    color: var(--fg-secondary);
    white-space: pre-wrap;
  }

  /* ─── BOTTOM 3-MODE COMPOSER DOCK ─── */
  .steer-dock {
    background: var(--bg-surface);
    border-top: 1px solid var(--border-dim);
    padding: 12px 20px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.35);
  }
  .dock-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  .dock-target-cluster {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .dock-label {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--fg-muted);
    letter-spacing: 0.05em;
  }
  .mode-segmented {
    display: inline-flex;
    background: var(--bg-void);
    border: 1px solid var(--border-dim);
    border-radius: 8px;
    padding: 3px;
    gap: 3px;
  }
  .mode-btn {
    background: transparent;
    color: var(--fg-secondary);
    border: 1px solid transparent;
    padding: 5px 10px;
    border-radius: 6px;
    font-family: var(--font-mono);
    font-size: 0.71rem;
    font-weight: 600;
    box-shadow: none;
  }
  .mode-btn:hover { color: var(--fg-primary); transform: none; }
  .mode-btn.active.send {
    background: var(--cyan-dim);
    color: var(--cyan);
    border-color: var(--cyan-border);
  }
  .mode-btn.active.interrupt {
    background: var(--amber-dim);
    color: var(--amber);
    border-color: var(--amber-border);
  }
  .mode-btn.active.queue {
    background: var(--violet-dim);
    color: #d8b4fe;
    border-color: var(--violet-border);
  }

  .dock-input-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .dock-input-row input {
    flex: 1;
    padding: 10px 14px;
    font-size: 0.86rem;
    background: var(--bg-void);
    border-color: var(--border-bright);
  }

  /* ─── RIGHT COLUMN: TELEMETRY, WORKTREES & POLICY INSPECTOR ─── */
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
    padding: 11px 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--fg-muted);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 150ms ease;
  }
  .insp-tab:hover { color: var(--fg-secondary); }
  .insp-tab.active {
    color: var(--cyan);
    border-bottom-color: var(--cyan);
    background: var(--bg-surface);
  }
  .insp-body {
    flex: 1;
    overflow-y: auto;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .info-box {
    background: var(--bg-elevated);
    border: 1px solid var(--border-dim);
    border-radius: var(--radius-md);
    padding: 12px;
    box-shadow: var(--shadow-card);
  }
  .info-box-title {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: var(--fg-secondary);
    margin-bottom: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .wt-card {
    background: var(--bg-void);
    border: 1px solid var(--border-dim);
    border-radius: var(--radius-sm);
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .mono-block {
    font-family: var(--font-mono);
    font-size: 0.73rem;
    line-height: 1.5;
    color: var(--fg-secondary);
    background: var(--bg-void);
    padding: 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-dim);
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 220px;
    overflow-y: auto;
    user-select: text;
  }
  .contract-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 7px;
    font-size: 0.76rem;
    color: var(--fg-secondary);
  }
  .contract-list li {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
  .contract-list li .ico {
    color: var(--emerald);
    margin-top: 2px;
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(5, 7, 11, 0.82);
    backdrop-filter: blur(6px);
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
    border-radius: var(--radius-lg);
    width: 100%;
    max-width: 460px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: var(--shadow-float);
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
    padding: 11px;
    box-shadow: none;
  }
  .mobile-nav button.active { color: var(--cyan); background: var(--cyan-dim); }

  @media (max-width: 1024px) {
    .topology-grid { grid-template-columns: repeat(2, 1fr); }
    .templates-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 900px) {
    .workspace { grid-template-columns: 1fr; height: calc(100vh - 100px); }
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
  <header class="topbar">
    <div class="brand-cluster">
      <div class="brand-mark" aria-hidden="true">
        <svg class="ico ico-lg" viewBox="0 0 24 24">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <div>
        <div class="brand-title-row">
          <span class="brand-title">BotAutoTask Mesh</span>
          <span class="mode-badge">${mode.toUpperCase()}</span>
        </div>
        <div class="brand-sub">Multi-Agent Coworker Orchestrator · Isolated Worktrees · Closed-Loop Contract</div>
      </div>
    </div>

    <div class="telemetry-strip">
      <div id="ssePill" class="pill DISCONNECTED">
        <span class="dot"></span>
        <span id="sseText">CONNECTING</span>
      </div>
      <div id="seqPill" class="pill">SEQ #1000</div>
      <button class="btn-ghost" onclick="openSpawnModal()">
        <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
        <span>Spawn Specialist</span>
      </button>
      <button id="stopAllBtn" class="btn-danger" onclick="triggerStopAll()">
        <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
        <span id="stopAllText">Stop All</span>
      </button>
    </div>
  </header>

  <!-- 3-COLUMN TACTICAL WORKSPACE -->
  <div id="workspaceEl" class="workspace">

    <!-- LEFT: COWORKER ROSTER & CHANNELS -->
    <aside class="sidebar">
      <div class="section-hdr">
        <span>CHANNELS & THREADS</span>
      </div>
      <div class="channel-list">
        <div id="chanAll" class="channel-item active" onclick="selectChannel('all')">
          <span class="channel-name">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18"/></svg>
            <span>#mesh-command-room</span>
          </span>
          <span class="cw-status" id="totalHandoffsBadge">0</span>
        </div>
      </div>

      <div class="section-hdr">
        <span>COWORKER SQUAD</span>
        <span id="squadCount">3 AGENTS</span>
      </div>
      <div id="rosterContainer" class="roster-scroll"></div>
    </aside>

    <!-- CENTER: MISSION BAR, BENTO HERO / STREAM TIMELINE & STEER DOCK -->
    <main class="center-stage">
      <!-- Team Mission Launcher -->
      <div class="mission-bar">
        <div class="mission-row">
          <div class="mission-input-wrap">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
            <input id="teamGoalInput" placeholder="Launch Autonomous Squad Mission (e.g. Refactor auth module & add unit tests)..." onkeydown="if(event.key==='Enter')launchTeamMission()"/>
          </div>
          <div class="verify-input-wrap" title="Closed-Loop Verification Gate Command">
            <svg class="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
            <input id="teamCheckInput" placeholder="Verify cmd (npm test)" value="npm test"/>
          </div>
          <button onclick="launchTeamMission()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span>Dispatch Squad</span>
          </button>
        </div>
      </div>

      <div class="stream-header">
        <div class="stream-breadcrumb">
          <svg class="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          <span id="activeStreamTitle">Viewing: <b>#mesh-command-room</b> (All Inter-Agent Handoffs & Tool Calls)</span>
        </div>
        <span id="nonceReceiptBadge" style="font-family:var(--font-mono);font-size:0.71rem;color:var(--fg-muted)">Ready</span>
      </div>

      <!-- Live Feed / Bento Topology Canvas -->
      <div id="streamCanvas" class="stream-canvas"></div>

      <!-- 3-Mode Delivery Dock -->
      <div class="steer-dock">
        <div class="dock-controls">
          <div class="dock-target-cluster">
            <span class="dock-label">TARGET</span>
            <select id="dockTarget" style="font-family:var(--font-mono);font-size:0.76rem;padding:5px 28px 5px 10px"></select>
            <label class="toggle-label">
              <input type="checkbox" id="dockRunTurn" checked/>
              <span>Execute Turn Immediately</span>
            </label>
          </div>

          <div class="mode-segmented" role="group" aria-label="Message Delivery Mode">
            <button id="modeSend" class="mode-btn active send" onclick="setDeliveryMode('send')">
              <svg class="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              <span>SEND (TURN)</span>
            </button>
            <button id="modeInterrupt" class="mode-btn interrupt" onclick="setDeliveryMode('interrupt')">
              <svg class="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              <span>INTERRUPT (STEER)</span>
            </button>
            <button id="modeQueue" class="mode-btn queue" onclick="setDeliveryMode('queue')">
              <svg class="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>QUEUE (NEXT)</span>
            </button>
          </div>
        </div>

        <div class="dock-input-row">
          <input id="dockMessage" placeholder="Transmit direct instruction, mid-run course correction, or coworker handoff..." onkeydown="if(event.key==='Enter')submitDockMessage()"/>
          <button id="dockSendBtn" class="btn-primary-cyan" onclick="submitDockMessage()">
            <span>Transmit</span>
            <svg class="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>
          </button>
        </div>
      </div>
    </main>

    <!-- RIGHT: TELEMETRY, WORKTREES & POLICY INSPECTOR -->
    <aside class="inspector">
      <div class="insp-tabs">
        <div id="tabWt" class="insp-tab active" onclick="switchInspectorTab('wt')">
          <svg class="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
          <span>WORKTREES</span>
        </div>
        <div id="tabVerify" class="insp-tab" onclick="switchInspectorTab('verify')">
          <svg class="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>CONTRACT</span>
        </div>
        <div id="tabSys" class="insp-tab" onclick="switchInspectorTab('sys')">
          <svg class="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>0-KEY & IDE</span>
        </div>
      </div>

      <!-- Tab 1: Git Worktrees & Sandbox -->
      <div id="paneWt" class="insp-body">
        <div class="info-box">
          <div class="info-box-title">
            <span>ISOLATED WRITER WORKTREES</span>
            <button class="btn-ghost" style="padding:3px 7px;font-size:0.68rem" onclick="refreshState()" title="Refresh Worktrees">
              <svg class="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            </button>
          </div>
          <div style="font-size:0.74rem;color:var(--fg-muted);margin-bottom:10px;line-height:1.45">
            Each writer coworker operates inside an isolated Git branch (<code>.botautotask/worktrees/&lt;id&gt;</code>) to guarantee zero file collisions.
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
          <div id="approvalList" style="font-size:0.75rem;color:var(--fg-muted);line-height:1.45">
            No destructive commands awaiting operator approval. Monotonic hard-refuse policy is active.
          </div>
        </div>

        <div class="info-box">
          <div class="info-box-title">
            <span>CLOSED-LOOP COMPLETION CONTRACT</span>
          </div>
          <ul class="contract-list">
            <li>
              <svg class="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              <span>Append-only verification criteria (max 16)</span>
            </li>
            <li>
              <svg class="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              <span>Bound to <code>mutation_epoch</code> (Git diff SHA)</span>
            </li>
            <li>
              <svg class="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              <span>2 identical gap signatures trigger Auto-Swap Core</span>
            </li>
            <li>
              <svg class="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              <span>Unverified goals halt at <code>outcome_unverified</code></span>
            </li>
          </ul>
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
  <nav class="mobile-nav">
    <button id="mobBtnSquad" onclick="setMobileView('roster')">
      <svg class="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
      <span>Squad</span>
    </button>
    <button id="mobBtnComms" class="active" onclick="setMobileView('comms')">
      <svg class="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      <span>Mesh</span>
    </button>
    <button id="mobBtnInsp" onclick="setMobileView('insp')">
      <svg class="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
      <span>Inspector</span>
    </button>
  </nav>

  <!-- SPAWN SPECIALIST MODAL -->
  <div id="spawnModal" class="modal-backdrop">
    <div class="modal-card">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:8px;font-weight:700;font-size:0.96rem">
          <svg class="ico" style="color:var(--cyan)" viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
          <span>Spawn New Coworker Specialist</span>
        </div>
      </div>
      <input id="spId" placeholder="Short Handle ID (e.g. sec-audit, db-architect)"/>
      <input id="spName" placeholder="Specialist Title (e.g. Security & Hardening Auditor)"/>
      <select id="spRole">
        <option value="writer">Role: Writer (Isolated Git Worktree Branch)</option>
        <option value="reader">Role: Reader / Reviewer (Shared Read-Only)</option>
      </select>
      <select id="spCore">
        <option value="auto">Core: Auto (Best Free / Signed-in Model)</option>
        <option value="opencode:opencode/deepseek-v4.1-flash-free">OpenCode: deepseek-v4.1-flash-free</option>
        <option value="codex">Codex (ChatGPT OAuth 0-Key)</option>
        <option value="claude">Claude Code</option>
        <option value="antigravity">Antigravity IDE</option>
      </select>
      <textarea id="spDesc" rows="3" placeholder="System persona, domain boundaries, and specialized instructions..."></textarea>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px">
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

  let currentChannel = 'all';
  let currentDelivery = 'send';
  let agentsCache = [];
  let feedItems = [];
  let stopArmedTimers = {};
  let stopAllArmed = false;

  const SVG = {
    bolt: '<svg class="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    stop: '<svg class="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    writer: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    reader: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    lead: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    check: '<svg class="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
    branch: '<svg class="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>',
    arrowRight: '<svg class="ico ico-sm" viewBox="0 0 24 24" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>'
  };

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

  function prefillMission(goalText, verifyText) {
    const goalEl = document.getElementById('teamGoalInput');
    const checkEl = document.getElementById('teamCheckInput');
    goalEl.value = goalText;
    if (verifyText) checkEl.value = verifyText;
    goalEl.focus();
  }

  function renderTimeline() {
    const canvas = document.getElementById('streamCanvas');
    const filtered = currentChannel === 'all'
      ? feedItems
      : feedItems.filter((x) => x.from === currentChannel || x.to === currentChannel);

    if (filtered.length === 0) {
      const leadStatus = (agentsCache.find((a) => a.id === 'lead')?.status || 'idle').toUpperCase();
      const coderStatus = (agentsCache.find((a) => a.id === 'coder')?.status || 'idle').toUpperCase();
      const revStatus = (agentsCache.find((a) => a.id === 'reviewer')?.status || 'idle').toUpperCase();

      canvas.innerHTML = \`
        <div class="bento-hero">
          <div class="bento-card">
            <div class="bento-hdr">
              <div class="bento-title">
                \${SVG.branch}
                <span>ACTIVE COWORKER TOPOLOGY & EXECUTION PIPELINE</span>
              </div>
              <span class="cw-status running">MESH READY</span>
            </div>
            <div class="topology-grid">
              <div class="topo-node" onclick="document.getElementById('teamGoalInput').focus()">
                <div class="topo-step"><span>STAGE 01</span>\${SVG.arrowRight}</div>
                <div class="topo-name" style="color:var(--amber)">Commander</div>
                <div class="topo-role">Dispatches high-level goals or mid-run priority steers.</div>
              </div>
              <div class="topo-node" onclick="selectChannel('lead')">
                <div class="topo-step"><span>STAGE 02</span><span class="cw-status">\${esc(leadStatus)}</span></div>
                <div class="topo-name" style="color:var(--cyan)">@lead</div>
                <div class="topo-role">Decomposes specs, routes handoffs, and coordinates squad turns.</div>
              </div>
              <div class="topo-node" onclick="selectChannel('coder')">
                <div class="topo-step"><span>STAGE 03</span><span class="cw-status">\${esc(coderStatus)}</span></div>
                <div class="topo-name" style="color:#d8b4fe">@coder</div>
                <div class="topo-role">Writes patches in isolated Git worktree branch <code>agent-coder</code>.</div>
              </div>
              <div class="topo-node" onclick="selectChannel('reviewer')">
                <div class="topo-step"><span>STAGE 04</span><span class="cw-status">\${esc(revStatus)}</span></div>
                <div class="topo-name" style="color:var(--emerald)">@reviewer</div>
                <div class="topo-role">Audits diffs & enforces Closed-Loop Completion Contract.</div>
              </div>
            </div>
          </div>

          <div class="templates-grid">
            <div class="tpl-card" onclick="prefillMission('Audit module architecture, refactor brittle functions, and verify all unit tests pass', 'npm test')">
              <div>
                <div class="tpl-icon-wrap">\${SVG.writer}</div>
                <div class="tpl-title">Test & Refactor Module</div>
                <div class="tpl-desc">Dispatch @lead and @coder in an isolated worktree with automated test-gate verification.</div>
              </div>
              <div class="tpl-action"><span>Load Mission Template</span>\${SVG.arrowRight}</div>
            </div>

            <div class="tpl-card" onclick="prefillMission('Implement feature slice in isolated Git worktree, add regression tests, and run @reviewer audit', 'npm test')">
              <div>
                <div class="tpl-icon-wrap" style="background:var(--cyan-dim);color:var(--cyan);border-color:var(--cyan-border)">\${SVG.branch}</div>
                <div class="tpl-title">Parallel Worktree Feature</div>
                <div class="tpl-desc">Develop a new capability on a dedicated branch without touching your working tree until verified.</div>
              </div>
              <div class="tpl-action" style="color:var(--cyan)"><span>Load Mission Template</span>\${SVG.arrowRight}</div>
            </div>

            <div class="tpl-card" onclick="prefillMission('Perform OWASP security, input boundary, and race-condition audit across all API handlers', 'npm test')">
              <div>
                <div class="tpl-icon-wrap" style="background:var(--violet-dim);color:#d8b4fe;border-color:var(--violet-border)">\${SVG.reader}</div>
                <div class="tpl-title">Security & Policy Audit</div>
                <div class="tpl-desc">Run read-only deep inspection with @reviewer and report high-confidence vulnerabilities.</div>
              </div>
              <div class="tpl-action" style="color:#d8b4fe"><span>Load Mission Template</span>\${SVG.arrowRight}</div>
            </div>
          </div>
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
              \${SVG.arrowRight}
              <span class="actor-chip">@\${esc(item.to)}</span>
              <span class="delivery-tag \${esc(item.delivery)}">\${esc(item.delivery)}</span>
              \${item.core ? \`<span class="cw-status">\${esc(item.core)}</span>\` : ''}
            </div>
            <span style="color:var(--fg-muted)">\${esc(item.ts)}</span>
          </div>
          <div class="msg-body">\${esc(item.message)}</div>
          \${item.reply ? \`<div class="msg-reply">\${esc(item.reply)}</div>\` : ''}
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
      const elapsedSec = a.elapsedMs ? ' ' + Math.round(a.elapsedMs / 1000) + 's' : '';
      const isSelected = currentChannel === a.id;
      const isArmed = Boolean(stopArmedTimers[a.id]);
      const role = a.role || 'writer';
      const avatarSvg = a.id === 'lead' ? SVG.lead : (role === 'reader' ? SVG.reader : SVG.writer);

      const coreOpts = CORE_OPTIONS.map((c) =>
        \`<option value="\${esc(c.value)}" \${a.preferredCore === c.value ? 'selected' : ''}>\${esc(c.label)}</option>\`
      ).join('');

      return \`
        <div class="coworker-card \${isSelected ? 'selected' : ''} \${a.status === 'running' ? 'running' : ''}" onclick="selectChannel('\${esc(a.id)}')">
          <div class="cw-header">
            <div class="cw-identity">
              <div class="cw-avatar \${esc(role)}">\${avatarSvg}</div>
              <div class="cw-title-group">
                <div class="cw-handle-row">
                  <span class="cw-handle">@\${esc(a.id)}</span>
                  <span class="role-tag \${esc(role)}">\${esc(role)}</span>
                </div>
                <div class="cw-fullname">\${esc(a.name)}</div>
              </div>
            </div>
            <span class="cw-status \${dispStatus}">\${dispStatus.toUpperCase()}\${elapsedSec}</span>
          </div>
          <div class="cw-desc">\${esc(a.description)}</div>
          <div class="cw-metrics">
            <div class="cw-metric-item"><span>CALLS</span><b style="color:var(--fg-primary)">\${a.toolCallCount || 0}</b></div>
            <div class="cw-metric-item"><span>INBOX</span><b style="color:var(--fg-primary)">\${a.inboxCount || 0}</b></div>
            <div class="cw-metric-item"><span>STEERS</span><b style="color:var(--amber)">\${a.pendingSteers || 0}</b></div>
          </div>
          <div class="cw-controls" onclick="event.stopPropagation()">
            <select onchange="changeAgentCore('\${esc(a.id)}', this.value)" title="Switch AI Core/Model for @\${esc(a.id)}">
              \${coreOpts}
            </select>
            <button class="btn-amber" onclick="quickFocusSteer('\${esc(a.id)}')" title="Interrupt / Steer @\${esc(a.id)}">\${SVG.bolt}</button>
            <button id="stopBtn-\${esc(a.id)}" class="btn-danger \${isArmed ? 'armed' : ''}" onclick="armOrStopAgent('\${esc(a.id)}')" title="2-Step Stop Agent">
              \${isArmed ? 'Confirm?' : SVG.stop}
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
      <div class="wt-card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <b style="font-family:var(--font-mono);font-size:0.76rem;color:var(--cyan)">@\${esc(w.id)}</b>
          <span class="cw-status">botautotask/agent-\${esc(w.id)}</span>
        </div>
        <div style="font-family:var(--font-mono);font-size:0.68rem;color:var(--fg-muted)">
          \${esc(w.worktreePath || '.botautotask/worktrees/' + w.id)}
        </div>
        <button class="btn-emerald" style="width:100%;padding:6px;margin-top:2px" onclick="mergeAgentWorktree('\${esc(w.id)}')">
          \${SVG.check}
          <span>Verify & Merge into Main</span>
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
        const badge = ok ? '[SIGNED IN]    ' : (v.installed ? '[INSTALLED]    ' : '[NOT FOUND]    ');
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

  // 4. User Actions
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
    const txt = document.getElementById('stopAllText');
    if (!stopAllArmed) {
      stopAllArmed = true;
      btn.classList.add('armed');
      txt.innerText = 'Confirm Stop All (3s)';
      setTimeout(() => {
        stopAllArmed = false;
        btn.classList.remove('armed');
        txt.innerText = 'Stop All';
      }, 3000);
      return;
    }
    stopAllArmed = false;
    btn.classList.remove('armed');
    txt.innerText = 'Stop All';
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
        ? '[VERIFIED & MERGED] Worktree merged cleanly into main (commit: ' + (out.sha || 'HEAD') + ')'
        : '[MERGE ABORTED] (' + (out.reason || 'conflict') + '): ' + JSON.stringify(out.conflicts || out.error || ''),
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
