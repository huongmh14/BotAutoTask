/**
 * BotAutoTask — "52Hz Whale Pod" Original Messenger / Telegram UI.
 * Inspired by the 52-Hertz Whale (the unique acoustic frequency in the deep ocean)
 * combined with the effortless everyday usability of Telegram & Messenger:
 *   - Bespoke SVG Whale & 52Hz Sonar visual identity (Arctic Ocean Light + Deep Trench Dark themes)
 *   - Live 52.0 Hz acoustic waveform indicator that pulses when agents transmit/work
 *   - Telegram-style pinned mission bar, left/right chat bubbles, @route sonar pills,
 *     and floating acoustic composer.
 */

export function renderDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="vi" data-theme="ocean-light">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>52Hz — BotAutoTask — Tactical Coworker Mesh</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root, [data-theme="ocean-light"] {
    --bg-sidebar: #EBF3F9;
    --bg-sidebar-card: #FFFFFF;
    --bg-main: #F5F9FC;
    --bg-header: rgba(245, 249, 252, 0.88);
    --bg-bubble-in: #FFFFFF;
    --bg-bubble-out: linear-gradient(135deg, #0369A1 0%, #0D9488 100%);
    --bg-hover: rgba(14, 116, 144, 0.08);
    --bg-pill: #E0EEF7;
    --text-primary: #0C2536;
    --text-secondary: #47677D;
    --text-muted: #7B97AB;
    --text-out: #FFFFFF;
    --border: #D5E5F0;
    --border-strong: #B8D2E3;
    --accent: #0284C7;
    --accent-teal: #0D9488;
    --accent-glow: rgba(2, 132, 199, 0.16);
    --ok: #10B981;
    --warn: #F59E0B;
    --err: #EF4444;
    --shadow-sm: 0 2px 8px rgba(12, 37, 54, 0.05);
    --shadow-md: 0 12px 32px rgba(12, 37, 54, 0.12);
    --font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace;
  }

  [data-theme="deep-trench"] {
    --bg-sidebar: #07131E;
    --bg-sidebar-card: #0D2133;
    --bg-main: #0A1929;
    --bg-header: rgba(10, 25, 41, 0.88);
    --bg-bubble-in: #10263C;
    --bg-bubble-out: linear-gradient(135deg, #0284C7 0%, #0D9488 100%);
    --bg-hover: rgba(56, 189, 248, 0.1);
    --bg-pill: #132F4C;
    --text-primary: #E6F4FE;
    --text-secondary: #8AB4D0;
    --text-muted: #567D99;
    --text-out: #FFFFFF;
    --border: #17344F;
    --border-strong: #234E73;
    --accent: #38BDF8;
    --accent-teal: #2DD4BF;
    --accent-glow: rgba(56, 189, 248, 0.2);
    --shadow-sm: 0 2px 10px rgba(0, 0, 0, 0.28);
    --shadow-md: 0 16px 40px rgba(0, 0, 0, 0.55);
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html, body {
    height: 100%;
    background: var(--bg-main);
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }

  button, input, select, textarea {
    font: inherit;
    color: inherit;
  }

  /* 2-Column Ocean Messenger Layout */
  .whale-app {
    display: grid;
    grid-template-columns: 300px minmax(0, 1fr);
    height: 100dvh;
    width: 100vw;
    position: relative;
  }
  .whale-app.sidebar-collapsed {
    grid-template-columns: 0px minmax(0, 1fr);
  }
  .whale-app.sidebar-collapsed .pod-sidebar {
    overflow: hidden;
    border-right: none;
  }

  /* ================= LEFT SIDEBAR: THE 52Hz POD ================= */
  .pod-sidebar {
    background: var(--bg-sidebar);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    height: 100%;
    user-select: none;
    min-width: 0;
    position: relative;
  }

  .pod-brand-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 16px 12px;
  }

  .whale-brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .whale-crest {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: linear-gradient(135deg, #0284C7 0%, #0D9488 100%);
    color: #FFFFFF;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px var(--accent-glow);
    flex-shrink: 0;
  }
  .whale-crest svg {
    width: 22px;
    height: 22px;
  }

  .brand-text-wrap {
    display: flex;
    flex-direction: column;
  }
  .brand-name {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: -0.02em;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .hz-tag {
    font-family: var(--font-mono);
    font-size: 10.5px;
    font-weight: 600;
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--accent-glow);
    color: var(--accent);
    border: 1px solid var(--border-strong);
  }
  .brand-sub {
    font-size: 11px;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .top-icon-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .icon-btn {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, transform 0.12s;
  }
  .icon-btn:hover {
    background: var(--bg-hover);
    color: var(--accent);
  }
  .icon-btn svg {
    width: 17px;
    height: 17px;
  }

  /* 52Hz Live Sonar Frequency Strip */
  .sonar-strip {
    margin: 0 14px 10px;
    padding: 8px 12px;
    border-radius: 12px;
    background: var(--bg-sidebar-card);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    box-shadow: var(--shadow-sm);
  }
  .sonar-freq-label {
    display: flex;
    align-items: center;
    gap: 7px;
    font-family: var(--font-mono);
    font-size: 11.5px;
    font-weight: 600;
    color: var(--accent);
  }
  .sonar-wave-bars {
    display: inline-flex;
    align-items: center;
    gap: 2.5px;
    height: 14px;
  }
  .sonar-wave-bars i {
    width: 2.5px;
    border-radius: 2px;
    background: var(--accent);
    display: block;
    height: 5px;
    transition: height 0.2s;
  }
  .sonar-wave-bars.active i:nth-child(1) { animation: wave52 0.9s infinite ease-in-out 0.0s; }
  .sonar-wave-bars.active i:nth-child(2) { animation: wave52 0.9s infinite ease-in-out 0.15s; }
  .sonar-wave-bars.active i:nth-child(3) { animation: wave52 0.9s infinite ease-in-out 0.3s; }
  .sonar-wave-bars.active i:nth-child(4) { animation: wave52 0.9s infinite ease-in-out 0.45s; }
  @keyframes wave52 {
    0%, 100% { height: 4px; opacity: 0.55; }
    50% { height: 14px; opacity: 1; }
  }

  /* Search Input */
  .pod-search-wrap {
    padding: 0 14px 10px;
  }
  .pod-search {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-sidebar-card);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 7px 13px;
    box-shadow: var(--shadow-sm);
  }
  .pod-search svg {
    width: 14px;
    height: 14px;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .pod-search input {
    border: none;
    outline: none;
    background: transparent;
    width: 100%;
    font-size: 13px;
    color: var(--text-primary);
  }
  .pod-search input::placeholder {
    color: var(--text-muted);
  }

  /* Pod Roster Scroll */
  .pod-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 0 10px 12px;
  }

  .pod-sec-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 8px 5px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-secondary);
  }

  .pod-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-bottom: 12px;
  }

  .pod-item {
    display: flex;
    align-items: center;
    gap: 11px;
    width: 100%;
    padding: 10px 12px;
    border-radius: 15px;
    border: 1px solid transparent;
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s, border-color 0.15s, transform 0.12s;
  }
  .pod-item:hover {
    background: var(--bg-hover);
  }
  .pod-item.active {
    background: var(--bg-sidebar-card);
    border-color: var(--border-strong);
    box-shadow: var(--shadow-sm);
  }

  /* Whale Avatar per Coworker */
  .whale-avatar {
    width: 42px;
    height: 42px;
    border-radius: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #FFFFFF;
    flex-shrink: 0;
    position: relative;
    box-shadow: 0 3px 10px rgba(2, 132, 199, 0.18);
  }
  .whale-avatar.sm {
    width: 36px;
    height: 36px;
    border-radius: 12px;
  }
  .whale-avatar svg {
    width: 22px;
    height: 22px;
  }
  .whale-avatar.sm svg {
    width: 19px;
    height: 19px;
  }

  .beacon-dot {
    position: absolute;
    right: -2px;
    bottom: -2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid var(--bg-sidebar);
    background: var(--ok);
  }
  .pod-item.active .beacon-dot {
    border-color: var(--bg-sidebar-card);
  }
  .beacon-dot.working {
    background: var(--warn);
    animation: sonarPulse 1.3s infinite ease-in-out;
  }
  .beacon-dot.queued { background: var(--accent); }
  .beacon-dot.error { background: var(--err); }

  @keyframes sonarPulse {
    0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.5); }
    50% { transform: scale(1.18); box-shadow: 0 0 0 5px rgba(245, 158, 11, 0); }
  }

  .pod-meta {
    min-width: 0;
    flex: 1;
  }
  .pod-row-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }
  .pod-name {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pod-freq-tag {
    font-family: var(--font-mono);
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 999px;
    background: var(--bg-pill);
    color: var(--accent);
    font-weight: 600;
    flex-shrink: 0;
  }
  .pod-preview {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
  }

  /* Bottom Ocean Control Dock */
  .pod-footer {
    border-top: 1px solid var(--border);
    padding: 10px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .dock-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 10px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--bg-sidebar-card);
    color: var(--text-primary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.14s, background 0.14s;
  }
  .dock-btn:hover {
    border-color: var(--accent);
  }
  .dock-btn svg {
    width: 14px;
    height: 14px;
    color: var(--accent);
  }

  /* Connection state pill */
  .conn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-mono);
    font-size: 10.5px;
    font-weight: 600;
    color: var(--text-secondary);
  }
  .conn-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--err);
  }
  .conn.LIVE .conn-dot { background: var(--ok); }
  .conn.POLLING .conn-dot { background: var(--warn); }

  /* ================= RIGHT MAIN CHAT: 52Hz SONAR STREAM ================= */
  .ocean-main {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    background:
      radial-gradient(circle at 85% 12%, var(--accent-glow), transparent 38%),
      var(--bg-main);
    min-width: 0;
  }

  .ocean-header {
    height: 64px;
    padding: 0 22px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-header);
    backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }

  .ocean-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .header-info {
    min-width: 0;
  }
  .header-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .header-title {
    font-size: 15.5px;
    font-weight: 800;
    color: var(--text-primary);
  }
  .header-sub {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ocean-header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .action-pill-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid var(--border-strong);
    background: var(--bg-sidebar-card);
    color: var(--text-primary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.14s;
  }
  .action-pill-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .action-pill-btn svg {
    width: 14px;
    height: 14px;
  }

  /* Telegram-style Pinned Mission / Branch Bar */
  .pinned-sonar-bar {
    padding: 7px 22px;
    background: var(--bg-pill);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
    color: var(--text-secondary);
  }
  .pinned-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pinned-bar-indicator {
    width: 3px;
    height: 18px;
    border-radius: 2px;
    background: var(--accent);
    flex-shrink: 0;
  }

  /* Chat Stream */
  .chat-stream {
    flex: 1;
    overflow-y: auto;
    padding: 24px 28px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  /* 52Hz Whale Empty State */
  .whale-welcome {
    margin: auto;
    max-width: 510px;
    text-align: center;
    padding: 28px 18px;
  }
  .whale-hero-art {
    width: 108px;
    height: 108px;
    margin: 0 auto 16px;
    border-radius: 50%;
    background: var(--bg-pill);
    border: 1px solid var(--border-strong);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
    position: relative;
    box-shadow: 0 0 0 10px var(--accent-glow);
  }
  .whale-hero-art svg {
    width: 58px;
    height: 58px;
  }
  .whale-welcome h2 {
    font-size: 23px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    margin-bottom: 8px;
  }
  .whale-welcome p {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.6;
    margin-bottom: 22px;
  }

  .sonar-quick-grid {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 9px;
  }
  .sonar-chip {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 9px 15px;
    border-radius: 999px;
    background: var(--bg-sidebar-card);
    border: 1px solid var(--border-strong);
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    cursor: pointer;
    box-shadow: var(--shadow-sm);
    transition: transform 0.14s, border-color 0.14s, color 0.14s;
  }
  .sonar-chip:hover {
    transform: translateY(-2px);
    border-color: var(--accent);
    color: var(--accent);
  }
  .sonar-chip svg {
    width: 15px;
    height: 15px;
    color: var(--accent);
  }

  /* Day Separator */
  .day-sep {
    align-self: center;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-secondary);
    background: var(--bg-pill);
    border: 1px solid var(--border);
    padding: 3px 13px;
    border-radius: 999px;
    margin: 4px 0;
  }

  /* Telegram / Messenger Chat Bubbles */
  .msg-row {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    max-width: 78%;
  }
  .msg-row.outgoing {
    align-self: flex-end;
    flex-direction: row-reverse;
  }
  .msg-row.incoming {
    align-self: flex-start;
  }

  .msg-stack {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .msg-row.outgoing .msg-stack {
    align-items: flex-end;
  }

  .msg-meta-line {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 4px;
    font-size: 12px;
  }
  .msg-author {
    font-weight: 700;
    color: var(--text-primary);
  }
  .msg-route-tag {
    font-family: var(--font-mono);
    font-size: 10.5px;
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--bg-pill);
    color: var(--accent);
    font-weight: 600;
  }
  .msg-time {
    font-size: 11px;
    color: var(--text-muted);
  }

  .msg-bubble {
    padding: 11px 16px;
    border-radius: 18px;
    font-size: 14px;
    line-height: 1.56;
    word-break: break-word;
    white-space: pre-wrap;
    box-shadow: var(--shadow-sm);
  }
  .msg-row.incoming .msg-bubble {
    background: var(--bg-bubble-in);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-bottom-left-radius: 5px;
  }
  .msg-row.outgoing .msg-bubble {
    background: var(--bg-bubble-out);
    color: var(--text-out);
    border-bottom-right-radius: 5px;
  }
  .msg-bubble.priority {
    border: 2px solid var(--warn);
  }

  /* Sonar Ripple Typing Bubble */
  .sonar-typing {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 10px 15px;
    background: var(--bg-bubble-in);
    border: 1px solid var(--border-strong);
    border-radius: 18px;
    font-size: 12.5px;
    color: var(--text-secondary);
    align-self: flex-start;
    box-shadow: var(--shadow-sm);
  }
  .sonar-rings {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0 0 var(--accent-glow);
    animation: sonarPulse 1.2s infinite;
  }

  /* ================= BOTTOM COMPOSER BAR ================= */
  .composer-dock {
    padding: 10px 22px 16px;
    background: var(--bg-header);
    border-top: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .composer-controls-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 12px;
    color: var(--text-secondary);
  }
  .ctrl-label {
    font-weight: 600;
    color: var(--text-secondary);
  }
  .ocean-select {
    padding: 4px 10px;
    border-radius: 8px;
    border: 1px solid var(--border-strong);
    background: var(--bg-sidebar-card);
    color: var(--text-primary);
    font-size: 12px;
    font-weight: 500;
    outline: none;
    cursor: pointer;
  }

  .composer-capsule {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--bg-sidebar-card);
    border: 1.5px solid var(--border-strong);
    border-radius: 999px;
    padding: 6px 8px 6px 12px;
    box-shadow: var(--shadow-sm);
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .composer-capsule:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 4px var(--accent-glow);
  }

  .composer-input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 14px;
    color: var(--text-primary);
    padding: 4px 0;
  }
  .composer-input::placeholder {
    color: var(--text-muted);
  }

  .sonar-send-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: linear-gradient(135deg, #0284C7 0%, #0D9488 100%);
    color: #FFFFFF;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    box-shadow: 0 3px 10px var(--accent-glow);
    transition: transform 0.12s, opacity 0.12s;
  }
  .sonar-send-btn:hover {
    transform: scale(1.05);
  }
  .sonar-send-btn.stop-btn {
    background: var(--err);
  }
  .sonar-send-btn svg {
    width: 17px;
    height: 17px;
  }

  /* ================= MODALS ================= */
  .tele-drawer-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(7, 19, 30, 0.45);
    backdrop-filter: blur(4px);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 16px;
  }
  .tele-drawer-backdrop.open {
    display: flex;
  }

  .tele-modal {
    background: var(--bg-sidebar-card);
    border: 1px solid var(--border-strong);
    border-radius: 20px;
    width: 100%;
    max-width: 560px;
    max-height: 82vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-md);
    overflow: hidden;
  }
  .tele-head {
    padding: 15px 18px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 800;
    font-size: 15px;
  }
  .tele-body {
    padding: 16px 18px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .tele-card {
    background: var(--bg-main);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 12px 14px;
  }
  .tele-card h4 {
    font-size: 11.5px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--accent);
    margin-bottom: 8px;
  }
  .auth-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 0;
    border-bottom: 1px solid var(--border);
    font-size: 13px;
  }
  .auth-row:last-child { border-bottom: none; }
  .form-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 10px;
  }
  .form-row label {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-secondary);
  }
  .form-input {
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid var(--border-strong);
    background: var(--bg-sidebar-card);
    color: var(--text-primary);
    font-size: 13px;
  }
  .primary-btn {
    padding: 9px 16px;
    border-radius: 10px;
    border: none;
    background: linear-gradient(135deg, #0284C7 0%, #0D9488 100%);
    color: #FFFFFF;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
  }

  @media (max-width: 760px) {
    .whale-app {
      grid-template-columns: 1fr;
    }
    .pod-sidebar {
      position: fixed;
      inset: 0 auto 0 0;
      width: 290px;
      z-index: 60;
      transform: translateX(-100%);
      transition: transform 0.2s ease;
    }
    .pod-sidebar.mobile-open {
      transform: translateX(0);
    }
  }
</style>
</head>
<body>
  <div class="whale-app" id="appLayout">
    <!-- LEFT SIDEBAR: 52Hz WHALE POD -->
    <aside class="pod-sidebar" id="sidebar">
      <div class="pod-brand-bar">
        <div class="whale-brand">
          <div class="whale-crest" title="Cá Voi 52Hz — Tần số độc bản">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 16c2.5-3.5 6.5-5.5 11-5.5 4.2 0 7.2 2 8.5 4.5-2.2 1.5-5.5 2.5-9.5 2.5-4.2 0-7.5-1-10-1.5Z"/>
              <path d="M12 10.5C12 7.5 14.5 5 18 4c-.5 2.2-.2 4 1.5 5.5"/>
              <circle cx="16.5" cy="13.5" r="1" fill="currentColor"/>
            </svg>
          </div>
          <div class="brand-text-wrap">
            <div class="brand-name">
              <span>Whale 52Hz</span>
              <span class="hz-tag">52.0 Hz</span>
            </div>
            <div class="brand-sub">Deep Ocean Multi-Agent Pod</div>
          </div>
        </div>

        <div class="top-icon-group">
          <button class="icon-btn" onclick="toggleOceanTheme()" title="Đổi giao diện Sáng / Đại dương sâu (Dark)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>
          <button class="icon-btn" onclick="openModal('spawnModal')" title="Triệu hồi cá voi đồng hành mới">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>

      <!-- 52Hz Live Acoustic Frequency Strip -->
      <div class="sonar-strip">
        <div class="sonar-freq-label">
          <div class="sonar-wave-bars active" id="sonarBars"><i></i><i></i><i></i><i></i></div>
          <span id="freqStatusText">SONAR 52.0 Hz</span>
        </div>
        <span class="conn LIVE" id="connPill"><span class="conn-dot"></span><span id="sseText">LIVE</span></span>
      </div>

      <!-- Search -->
      <div class="pod-search-wrap">
        <div class="pod-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.2" y2="16.2"/></svg>
          <input id="searchInput" type="text" placeholder="Dò tìm cá voi đồng hành..." oninput="renderRoster()" />
        </div>
      </div>

      <div class="pod-scroll">
        <div class="pod-sec-title">
          <span>Kênh Đàn Cá Voi (Pod Group)</span>
          <span>52 Hz</span>
        </div>
        <div class="pod-list" id="groupRoster"></div>

        <div class="pod-sec-title">
          <span>Cá Voi Đồng Hành (1-1 Sonar)</span>
          <span id="podCountLabel">3 thành viên</span>
        </div>
        <div class="pod-list" id="coworkerRoster"></div>
      </div>

      <div class="pod-footer">
        <button class="dock-btn" onclick="openModal('runtimeModal')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>
          <span>Radar Runtime</span>
        </button>
        <button class="dock-btn" onclick="openModal('connModal')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
          <span>Tần số Core</span>
        </button>
      </div>
    </aside>

    <!-- RIGHT MAIN CHAT: 52Hz SONAR STREAM -->
    <main class="ocean-main">
      <header class="ocean-header">
        <div class="ocean-header-left">
          <button class="icon-btn" onclick="toggleSidebar()" title="Đóng/mở danh sách đàn cá voi">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="14" y2="17"/></svg>
          </button>
          <div class="whale-avatar sm" id="headerAvatar" style="background:linear-gradient(135deg,#0284C7,#0D9488);"></div>
          <div class="header-info">
            <div class="header-title-row">
              <span class="header-title" id="headerTitle">Đàn Cá Voi 52Hz</span>
              <span class="hz-tag" id="headerFreqBadge">52.0 Hz · Pod</span>
            </div>
            <div class="header-sub" id="headerSubtitle">Kênh phối hợp chung (#mesh-command-room)</div>
          </div>
        </div>

        <div class="ocean-header-actions">
          <button class="action-pill-btn" onclick="mergeAgentWorktree(currentChannel === 'all' ? 'coder' : currentChannel)" title="Kiểm thử & Gộp nhánh Git Worktree">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>
            <span>Gộp nhánh (Merge)</span>
          </button>
          <button class="icon-btn" onclick="clearCurrentView()" title="Xóa lịch sử hiển thị">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      </header>

      <!-- Telegram-style Pinned Active Sonar Bar -->
      <div class="pinned-sonar-bar">
        <div class="pinned-left">
          <span class="pinned-bar-indicator"></span>
          <span><strong>Hải trình 52Hz:</strong> Mọi thay đổi code của <code>@coder</code> được cô lập trong Git Worktree và tự động kiểm thử trước khi gộp.</span>
        </div>
        <button class="icon-btn" style="width:24px;height:24px;" onclick="openModal('runtimeModal')" title="Cấu hình lệnh kiểm thử">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </div>

      <!-- Chat Stream -->
      <section class="chat-stream" id="chatStream"></section>

      <!-- Bottom Composer -->
      <footer class="composer-dock">
        <div class="composer-controls-row">
          <span class="ctrl-label">Nguồn sóng AI:</span>
          <select class="ocean-select" id="coreSelect" onchange="onCoreSelectChange(this.value)">
            <option value="auto">Tự động dò tần số tốt nhất (Zero-Key Free Model)</option>
            <option value="opencode">OpenCode Zen — Free Models (deepseek / big-pickle / mimo)</option>
            <option value="codex">Codex CLI — ChatGPT OAuth (gpt-5.4)</option>
            <option value="claude">Claude Code CLI — Local Session</option>
            <option value="antigravity">Antigravity IDE — Local Session</option>
            <option value="neko-core">Local Custom Core</option>
          </select>
          <span class="ctrl-label" style="margin-left:6px;">Kiểu phát:</span>
          <select class="ocean-select" id="deliverySelect">
            <option value="send">Sóng trực tiếp (Send)</option>
            <option value="interrupt">Sóng khẩn cấp 52Hz (Interrupt Steer)</option>
            <option value="queue">Đưa vào hàng đợi (Queue)</option>
          </select>
        </div>

        <div class="composer-capsule">
          <button class="icon-btn" onclick="openModal('runtimeModal')" title="Cấu hình lệnh kiểm thử & Radar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <input
            id="msgInput"
            class="composer-input"
            type="text"
            placeholder="Phát tín hiệu 52Hz tới Đàn Cá Voi..."
            onkeydown="if(event.key==='Enter' && !event.shiftKey){event.preventDefault();sendComposerMessage();}"
          />
          <button class="sonar-send-btn" id="sendOrStopBtn" onclick="onSendOrStopClick()" title="Phát tín hiệu 52Hz">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
          </button>
        </div>
      </footer>
    </main>
  </div>

  <!-- MODAL 1: RADAR RUNTIME -->
  <div class="tele-drawer-backdrop" id="runtimeModal" onclick="if(event.target===this)closeTelemetry()">
    <div class="tele-modal">
      <div class="tele-head">
        <span>Radar 52Hz — Trạng thái Đàn Cá Voi & Kiểm thử</span>
        <button class="icon-btn" onclick="closeTelemetry()">✕</button>
      </div>
      <div class="tele-body">
        <div class="tele-card">
          <h4>Lệnh kiểm thử tự động trước khi Merge (Verify Command)</h4>
          <div class="form-row" style="margin-bottom:0;">
            <input
              id="checkInput"
              class="form-input"
              type="text"
              value='python -m unittest discover -s tests -p "test_*.py" -v; python scripts/query_engine.py --test; python scripts/evaluate.py --check'
              oninput="currentVerifyCmd = this.value"
            />
          </div>
        </div>
        <div class="tele-card">
          <h4>Trạng thái các thành viên trong đàn</h4>
          <div id="runtimeAgentsSummary" style="font-size:13px;color:var(--text-secondary);">Đang tải...</div>
        </div>
        <div class="tele-card">
          <h4>Tín hiệu IDE / Antigravity gần nhất</h4>
          <div id="ideLogBox" style="font-family:var(--font-mono);font-size:12px;color:var(--text-secondary);white-space:pre-wrap;">Chưa có dữ liệu</div>
        </div>
      </div>
    </div>
  </div>

  <!-- MODAL 2: TẦN SỐ KẾT NỐI -->
  <div class="tele-drawer-backdrop" id="connModal" onclick="if(event.target===this)closeTelemetry()">
    <div class="tele-modal">
      <div class="tele-head">
        <span>Tần số Kết nối AI Cores (Zero-API-Key)</span>
        <button class="icon-btn" onclick="closeTelemetry()">✕</button>
      </div>
      <div class="tele-body">
        <div class="tele-card">
          <h4>Các trạm phát sóng локаl trên máy</h4>
          <div id="authList">Đang kiểm tra...</div>
        </div>
      </div>
    </div>
  </div>

  <!-- MODAL 3: TRIỆU HỒI CÁ VOI MỚI -->
  <div class="tele-drawer-backdrop" id="spawnModal" onclick="if(event.target===this)closeTelemetry()">
    <div class="tele-modal">
      <div class="tele-head">
        <span>Triệu hồi Cá Voi Đồng Hành mới vào đàn 52Hz</span>
        <button class="icon-btn" onclick="closeTelemetry()">✕</button>
      </div>
      <div class="tele-body">
        <div class="form-row">
          <label>Mã định danh (@handle)</label>
          <input id="spawnId" class="form-input" placeholder="Ví dụ: sonar-sec" />
        </div>
        <div class="form-row">
          <label>Biệt danh cá voi</label>
          <input id="spawnName" class="form-input" placeholder="Ví dụ: Cá Voi Bảo Mật" />
        </div>
        <div class="form-row">
          <label>Vai trò trong đàn</label>
          <select id="spawnRole" class="form-input">
            <option value="writer">Thợ Lặn Code (Writer — Git Worktree độc lập)</option>
            <option value="reader">Hoa Tiêu / Sonar QA (Reader — Phân tích & Kiểm định)</option>
          </select>
        </div>
        <div class="form-row">
          <label>Nhiệm vụ chuyên môn</label>
          <input id="spawnDesc" class="form-input" placeholder="Kiểm định bảo mật và viết kiểm thử tự động..." />
        </div>
        <button class="primary-btn" onclick="spawnNewCoworker()">Triệu hồi vào đàn 52Hz</button>
      </div>
    </div>
  </div>

<script>
  const WHALE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 16c2.5-3.5 6.5-5.5 11-5.5 4.2 0 7.2 2 8.5 4.5-2.2 1.5-5.5 2.5-9.5 2.5-4.2 0-7.5-1-10-1.5Z"/><path d="M12 10.5C12 7.5 14.5 5 18 4c-.5 2.2-.2 4 1.5 5.5"/><circle cx="16.5" cy="13.5" r="1" fill="currentColor"/></svg>';

  const ICONS = {
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>'
  };

  const WHALE_PERSONAS = {
    all: {
      title: 'Đàn Cá Voi 52Hz',
      badge: '52.0 Hz · Pod',
      grad: 'linear-gradient(135deg, #0369A1 0%, #0D9488 100%)',
      sub: 'Kênh phối hợp cả đàn (#mesh-command-room)'
    },
    lead: {
      title: 'Hoa Tiêu 52Hz (@lead)',
      badge: '52.1 Hz · Lead',
      grad: 'linear-gradient(135deg, #0D9488 0%, #0284C7 100%)',
      sub: 'Cá voi dẫn đàn · Phân rã kiến trúc & điều phối'
    },
    coder: {
      title: 'Thợ Lặn Sâu (@coder)',
      badge: '52.4 Hz · Writer',
      grad: 'linear-gradient(135deg, #2563EB 0%, #0284C7 100%)',
      sub: 'Cá voi thực thi · Viết code & test trong Git Worktree'
    },
    reviewer: {
      title: 'Sonar Giám Định (@reviewer)',
      badge: '52.8 Hz · QA',
      grad: 'linear-gradient(135deg, #4F46E5 0%, #0E7490 100%)',
      sub: 'Cá voi kiểm định · Soát diff & bảo vệ chất lượng'
    }
  };

  function getWhalePersona(id) {
    if (WHALE_PERSONAS[id]) return WHALE_PERSONAS[id];
    return {
      title: 'Cá Voi @' + id,
      badge: '52 Hz · Specialist',
      grad: 'linear-gradient(135deg, #0284C7 0%, #4F46E5 100%)',
      sub: 'Chuyên gia đồng hành trong đàn 52Hz'
    };
  }

  let authToken = '';
  if (location.hash.startsWith('#k=')) {
    authToken = location.hash.slice(3);
  }

  let agentsState = [];
  let feedItems = [];
  let currentChannel = 'all';
  let currentVerifyCmd = 'python -m unittest discover -s tests -p "test_*.py" -v; python scripts/query_engine.py --test; python scripts/evaluate.py --check';
  let sseSource = null;
  let sseState = 'CONNECTING';
  let lastStateOkTs = 0;

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatTime(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  function toggleOceanTheme() {
    const html = document.documentElement;
    const next = html.getAttribute('data-theme') === 'deep-trench' ? 'ocean-light' : 'deep-trench';
    html.setAttribute('data-theme', next);
  }

  async function apiFetch(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    return fetch(path, { ...options, headers });
  }

  function setConnState(state) {
    sseState = state;
    const pill = document.getElementById('connPill');
    const txt = document.getElementById('sseText');
    if (!pill || !txt) return;
    let label = state;
    if (state !== 'LIVE' && Date.now() - lastStateOkTs < 9000) {
      label = 'POLLING';
    }
    pill.className = 'conn ' + label;
    txt.textContent = label;
  }

  function hasDuplicateItem(candidate) {
    return feedItems.some((item) => {
      if (candidate.id && item.id === candidate.id) return true;
      return (
        item.from === candidate.from &&
        item.to === candidate.to &&
        item.text === candidate.text &&
        Math.abs(new Date(item.ts || 0).getTime() - new Date(candidate.ts || 0).getTime()) < 2500
      );
    });
  }

  function connectSse() {
    if (sseSource) {
      try { sseSource.close(); } catch {}
    }
    const url = '/api/events' + (authToken ? '?k=' + encodeURIComponent(authToken) : '');
    sseSource = new EventSource(url);
    sseSource.onopen = () => setConnState('LIVE');
    sseSource.onerror = () => setConnState('DISCONNECTED');
    sseSource.addEventListener('frame', (e) => {
      try {
        const frame = JSON.parse(e.data);
        const p = frame.payload || {};
        if (frame.family === 'agent_message' || frame.family === 'team_step' || frame.family === 'agent_steered') {
          const item = {
            id: p.id || ('evt-' + frame.seq),
            ts: new Date().toISOString(),
            from: p.fromId || p.from || 'commander',
            to: p.targetId || p.agentId || 'all',
            delivery: p.delivery || 'send',
            priority: Boolean(p.priority),
            core: p.harnessId ? (p.harnessId + (p.modelId ? ':' + p.modelId : '')) : null,
            text: p.message || p.summary || ''
          };
          if (!hasDuplicateItem(item)) {
            feedItems.push(item);
            renderStream();
            renderRoster();
          }
        }
        refreshState();
      } catch {}
    });
  }

  async function refreshState() {
    try {
      const res = await apiFetch('/api/state');
      if (!res.ok) return;
      const data = await res.json();
      lastStateOkTs = Date.now();
      if (sseState !== 'LIVE') setConnState(sseState);

      agentsState = Array.isArray(data.agents) ? data.agents : [];

      if (Array.isArray(data.handoffs)) {
        let added = false;
        for (const h of data.handoffs) {
          const item = {
            id: h.id,
            ts: h.createdAt,
            from: h.fromAgentId,
            to: h.targetAgentId,
            delivery: h.delivery || 'send',
            priority: Boolean(h.priority),
            core: h.core || null,
            text: h.summary || ''
          };
          if (!hasDuplicateItem(item)) {
            feedItems.push(item);
            added = true;
          }
        }
        if (added) renderStream();
      }

      const anyRunning = agentsState.some((a) => a.status === 'running');
      const freqTxt = document.getElementById('freqStatusText');
      if (freqTxt) {
        freqTxt.textContent = anyRunning ? '52.0 Hz · ĐANG PHÁT SÓNG' : 'SONAR 52.0 Hz · ỔN ĐỊNH';
      }

      renderRoster();
      renderHeader();
      renderRuntimeModal(data);
    } catch {}
  }

  function renderRoster() {
    const q = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
    const groupEl = document.getElementById('groupRoster');
    const coworkerEl = document.getElementById('coworkerRoster');
    const countEl = document.getElementById('podCountLabel');
    if (!groupEl || !coworkerEl) return;
    if (countEl) countEl.textContent = agentsState.length + ' cá voi';

    const runningCount = agentsState.filter((a) => a.status === 'running').length;
    const lastGroupMsg = feedItems[feedItems.length - 1];
    const groupPreview = runningCount > 0
      ? ('🌊 ' + runningCount + ' cá voi đang phát sóng 52Hz...')
      : (lastGroupMsg ? ('@' + lastGroupMsg.from + ': ' + lastGroupMsg.text.slice(0, 38)) : 'Phòng phối hợp chung @lead · @coder · @reviewer');

    const podPersona = getWhalePersona('all');
    groupEl.innerHTML = \`
      <button class="pod-item \${currentChannel === 'all' ? 'active' : ''}" onclick="selectChannel('all')">
        <div class="whale-avatar" style="background:\${podPersona.grad}">
          \${WHALE_SVG}
          <span class="beacon-dot \${runningCount > 0 ? 'working' : 'online'}"></span>
        </div>
        <div class="pod-meta">
          <div class="pod-row-top">
            <span class="pod-name">\${escapeHtml(podPersona.title)}</span>
            <span class="pod-freq-tag">52.0 Hz</span>
          </div>
          <div class="pod-preview">\${escapeHtml(groupPreview)}</div>
        </div>
      </button>
    \`;

    const filtered = agentsState.filter((a) => {
      if (!q) return true;
      const p = getWhalePersona(a.id);
      return (
        a.id.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        (a.name || '').toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q)
      );
    });

    coworkerEl.innerHTML = filtered.map((a) => {
      const p = getWhalePersona(a.id);
      const isRunning = a.status === 'running';
      const isQueued = (a.inboxCount || 0) > 0 || (a.pendingSteers || 0) > 0;
      const dotCls = isRunning ? 'working' : (a.status === 'error' ? 'error' : (isQueued ? 'queued' : 'online'));
      const subText = isRunning
        ? '🌊 Đang lặn sâu xử lý nhiệm vụ...'
        : (p.sub || a.description || ('@' + a.id));

      return \`
        <button class="pod-item \${currentChannel === a.id ? 'active' : ''}" onclick="selectChannel('\${escapeHtml(a.id)}')">
          <div class="whale-avatar" style="background:\${p.grad}">
            \${WHALE_SVG}
            <span class="beacon-dot \${dotCls}"></span>
          </div>
          <div class="pod-meta">
            <div class="pod-row-top">
              <span class="pod-name">\${escapeHtml(p.title)}</span>
              <span class="pod-freq-tag">\${escapeHtml(p.badge)}</span>
            </div>
            <div class="pod-preview">\${escapeHtml(subText)}</div>
          </div>
        </button>
      \`;
    }).join('');
  }

  function renderHeader() {
    const avatar = document.getElementById('headerAvatar');
    const title = document.getElementById('headerTitle');
    const badge = document.getElementById('headerFreqBadge');
    const sub = document.getElementById('headerSubtitle');
    const input = document.getElementById('msgInput');
    const sendBtn = document.getElementById('sendOrStopBtn');
    const coreSelect = document.getElementById('coreSelect');

    const p = getWhalePersona(currentChannel);
    if (avatar) {
      avatar.style.background = p.grad;
      avatar.innerHTML = WHALE_SVG;
    }
    if (title) title.textContent = p.title;
    if (badge) badge.textContent = p.badge;

    if (currentChannel === 'all') {
      if (sub) sub.textContent = 'Kênh phối hợp toàn đàn (@lead · @coder · @reviewer) · #mesh-command-room';
      if (input) input.placeholder = 'Phát tín hiệu 52Hz giao nhiệm vụ cho cả đàn cá voi...';
    } else {
      const a = agentsState.find((x) => x.id === currentChannel);
      if (sub) {
        sub.textContent = a && a.status === 'running'
          ? '🌊 Đang phát tín hiệu phản hồi trên tần số 52Hz...'
          : p.sub;
      }
      if (input) input.placeholder = 'Phát tín hiệu 52Hz tới ' + p.title + '...';
      if (a && coreSelect && document.activeElement !== coreSelect) {
        coreSelect.value = a.preferredCore || 'auto';
      }
    }

    const activeRunning = currentChannel === 'all'
      ? agentsState.some((a) => a.status === 'running')
      : agentsState.some((a) => a.id === currentChannel && a.status === 'running');

    if (sendBtn) {
      if (activeRunning) {
        sendBtn.className = 'sonar-send-btn stop-btn';
        sendBtn.innerHTML = ICONS.stop;
        sendBtn.title = 'Ngắt sóng (Stop)';
      } else {
        sendBtn.className = 'sonar-send-btn';
        sendBtn.innerHTML = ICONS.up;
        sendBtn.title = 'Phát tín hiệu 52Hz';
      }
    }
  }

  function getVisibleMessages() {
    if (currentChannel === 'all') return feedItems;
    return feedItems.filter((m) => m.from === currentChannel || m.to === currentChannel);
  }

  function renderStream() {
    const stream = document.getElementById('chatStream');
    if (!stream) return;
    const msgs = getVisibleMessages();

    const runningAgents = currentChannel === 'all'
      ? agentsState.filter((a) => a.status === 'running')
      : agentsState.filter((a) => a.id === currentChannel && a.status === 'running');

    if (msgs.length === 0 && runningAgents.length === 0) {
      stream.innerHTML = \`
        <div class="whale-welcome">
          <div class="whale-hero-art">\${WHALE_SVG}</div>
          <h2>Tần số 52Hz đang lắng nghe đại dương</h2>
          <p>Bạn không cô độc giữa biển code. Hãy phát tín hiệu sonar cho một cá voi đồng hành, hoặc gọi cả đàn 52Hz cùng lặn sâu hoàn thiện dự án của bạn.</p>
          <div class="sonar-quick-grid">
            <button class="sonar-chip" onclick="prefillPrompt('Hãy dò sóng kiến trúc dự án hiện tại và đề xuất các hạng mục cần hoàn thiện tiếp theo.')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>
              <span>Dò sóng kiến trúc</span>
            </button>
            <button class="sonar-chip" onclick="prefillPrompt('Lập hải trình chi tiết từng bước để triển khai tính năng tiếp theo và kiểm thử tự động.')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              <span>Lập hải trình 52Hz</span>
            </button>
            <button class="sonar-chip" onclick="prefillPrompt('Chạy toàn bộ bộ kiểm thử, rà soát lỗi và xuất báo cáo chất lượng dự án.')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              <span>Kiểm định Sonar QA</span>
            </button>
          </div>
        </div>
      \`;
      return;
    }

    let html = '<div class="day-sep">Tần số 52.0 Hz · Hôm nay</div>';
    for (const m of msgs) {
      const isOut = m.from === 'commander';
      const senderPersona = getWhalePersona(m.from);
      const senderLabel = isOut ? 'Bạn (52Hz Captain)' : senderPersona.title;
      const routeTag = (!isOut && m.to && m.to !== 'commander' && m.to !== 'all')
        ? \`<span class="msg-route-tag">〰 @\${escapeHtml(m.to)}</span>\`
        : (isOut && currentChannel === 'all' && m.to && m.to !== 'all'
          ? \`<span class="msg-route-tag">〰 @\${escapeHtml(m.to)}</span>\`
          : '');
      const coreTag = m.core ? \`<span class="msg-time">· \${escapeHtml(m.core)}</span>\` : '';

      html += \`
        <div class="msg-row \${isOut ? 'outgoing' : 'incoming'}">
          \${!isOut ? \`
            <div class="whale-avatar sm" style="background:\${senderPersona.grad}">
              \${WHALE_SVG}
            </div>
          \` : ''}
          <div class="msg-stack">
            <div class="msg-meta-line">
              <span class="msg-author">\${escapeHtml(senderLabel)}</span>
              \${routeTag}
              \${coreTag}
              <span class="msg-time">\${formatTime(m.ts)}</span>
            </div>
            <div class="msg-bubble \${m.priority ? 'priority' : ''}">\${escapeHtml(m.text)}</div>
          </div>
        </div>
      \`;
    }

    for (const a of runningAgents) {
      const p = getWhalePersona(a.id);
      const lastAct = (a.recentActivity || []).slice(-1)[0] || 'Đang phát sóng 52Hz...';
      html += \`
        <div class="sonar-typing">
          <span class="sonar-rings"></span>
          <span><strong>\${escapeHtml(p.title)}</strong>: \${escapeHtml(lastAct.slice(0, 95))}</span>
        </div>
      \`;
    }

    stream.innerHTML = html;
    stream.scrollTop = stream.scrollHeight;
  }

  function renderRuntimeModal(data) {
    const sumEl = document.getElementById('runtimeAgentsSummary');
    if (sumEl) {
      sumEl.innerHTML = agentsState.map((a) => {
        const p = getWhalePersona(a.id);
        const act = (a.recentActivity || []).slice(-1)[0] || 'Đang lắng nghe trên tần số 52Hz';
        return \`<div class="auth-row">
          <span><strong>\${escapeHtml(p.title)}</strong></span>
          <span>\${escapeHtml(a.status.toUpperCase())} · \${escapeHtml(act.slice(0, 48))}</span>
        </div>\`;
      }).join('');
    }

    const authEl = document.getElementById('authList');
    if (authEl && data.auth) {
      authEl.innerHTML = Object.entries(data.auth).map(([k, v]) => \`
        <div class="auth-row">
          <span><strong>\${escapeHtml(k)}</strong> (\${escapeHtml(v.authMode || 'cli')})</span>
          <span style="color:\${v.authenticated ? 'var(--ok)' : 'var(--text-muted)'};font-weight:700;">
            \${v.authenticated ? 'SÓNG 52Hz SẴN SÀNG' : (v.installed ? 'CHƯA ĐĂNG NHẬP' : 'CHƯA CÀI ĐẶT')}
          </span>
        </div>
      \`).join('');
    }

    const ideEl = document.getElementById('ideLogBox');
    if (ideEl && data.latestIdeLog) {
      ideEl.textContent = \`Session: \${data.latestIdeLog.conversationId || 'N/A'} [\${data.latestIdeLog.status || 'IDLE'}]\\n\${data.latestIdeLog.lastResponse || ''}\`;
    }
  }

  function selectChannel(ch) {
    currentChannel = ch;
    document.getElementById('sidebar')?.classList.remove('mobile-open');
    renderRoster();
    renderHeader();
    renderStream();
  }

  function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const layout = document.getElementById('appLayout');
    if (window.innerWidth <= 760) {
      sb?.classList.toggle('mobile-open');
    } else {
      layout?.classList.toggle('sidebar-collapsed');
    }
  }

  function prefillPrompt(text) {
    const input = document.getElementById('msgInput');
    if (!input) return;
    input.value = text;
    input.focus();
  }

  function clearCurrentView() {
    feedItems = [];
    renderStream();
  }

  function openModal(id) {
    closeTelemetry();
    document.getElementById(id)?.classList.add('open');
  }

  function closeTelemetry() {
    document.querySelectorAll('.tele-drawer-backdrop').forEach((el) => el.classList.remove('open'));
  }

  async function onCoreSelectChange(val) {
    const targets = currentChannel === 'all' ? agentsState.map((a) => a.id) : [currentChannel];
    for (const id of targets) {
      await apiFetch('/api/agents/' + encodeURIComponent(id) + '/core', {
        method: 'POST',
        body: JSON.stringify({ nonce: 'core-' + Date.now() + '-' + id, preferredCore: val })
      });
    }
    refreshState();
  }

  async function sendComposerMessage() {
    const input = document.getElementById('msgInput');
    const text = (input?.value || '').trim();
    if (!text) return;
    input.value = '';

    const delivery = document.getElementById('deliverySelect')?.value || 'send';
    const checkInput = document.getElementById('checkInput');
    if (checkInput && checkInput.value.trim()) {
      currentVerifyCmd = checkInput.value.trim();
    }

    if (currentChannel === 'all') {
      await apiFetch('/api/team/start', {
        method: 'POST',
        body: JSON.stringify({
          nonce: 'team-' + Date.now(),
          goal: text,
          check: currentVerifyCmd
        })
      });
    } else {
      await apiFetch('/api/agents/' + encodeURIComponent(currentChannel) + '/message', {
        method: 'POST',
        body: JSON.stringify({
          nonce: 'msg-' + Date.now(),
          text,
          delivery,
          priority: delivery === 'interrupt',
          wait: false
        })
      });
    }
    refreshState();
  }

  async function onSendOrStopClick() {
    const activeRunning = currentChannel === 'all'
      ? agentsState.some((a) => a.status === 'running')
      : agentsState.some((a) => a.id === currentChannel && a.status === 'running');

    if (activeRunning) {
      if (currentChannel === 'all') {
        await apiFetch('/api/agents/stop-all', {
          method: 'POST',
          body: JSON.stringify({ confirm: true })
        });
      } else {
        await apiFetch('/api/agents/' + encodeURIComponent(currentChannel) + '/stop', {
          method: 'POST',
          body: JSON.stringify({ confirm: true })
        });
      }
      refreshState();
      return;
    }
    await sendComposerMessage();
  }

  async function mergeAgentWorktree(agentId) {
    const checkEl = document.getElementById('checkInput');
    const verifyCmd = (checkEl && checkEl.value.trim()) ? checkEl.value.trim() : currentVerifyCmd;
    await apiFetch('/api/agents/' + encodeURIComponent(agentId || 'coder') + '/merge', {
      method: 'POST',
      body: JSON.stringify({
        nonce: 'merge-' + Date.now(),
        verifyCmd
      })
    });
    refreshState();
  }

  async function spawnNewCoworker() {
    const id = (document.getElementById('spawnId')?.value || '').trim();
    const name = (document.getElementById('spawnName')?.value || '').trim();
    const role = document.getElementById('spawnRole')?.value || 'writer';
    const description = (document.getElementById('spawnDesc')?.value || '').trim();
    if (!id) return;
    await apiFetch('/api/agents', {
      method: 'POST',
      body: JSON.stringify({
        nonce: 'spawn-' + Date.now(),
        id,
        name: name || id,
        role,
        preferredCore: 'auto',
        description
      })
    });
    closeTelemetry();
    selectChannel(id);
    refreshState();
  }

  connectSse();
  refreshState();
  setInterval(refreshState, 3000);
  setInterval(() => {
    if (sseState !== 'LIVE') connectSse();
  }, 5000);
</script>
</body>
</html>`;
}
