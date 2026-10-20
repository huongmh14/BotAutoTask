/**
 * BotAutoTask — Web Dashboard UI.
 * Clean 2-column chat layout (Messenger / Telegram style):
 *   - Left sidebar: chat list (group channel + AI coworkers), search, connection state
 *   - Right: conversation with left/right bubbles, typing indicator, composer
 *   - Ocean-blue primary palette (#0284C7) with light / deep-ocean dark themes
 *   - Original friendly whale mascot (pure inline SVG, no external assets)
 */

export function renderDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="vi" data-theme="ocean-light">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>WhaleBot — Tactical Coworker Mesh</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 28 28' shape-rendering='crispEdges'%3E%3Crect width='28' height='28' rx='6' fill='%230284C7'/%3E%3Crect width='28' height='10' fill='%2322D3EE' fill-opacity='0.45'/%3E%3Cpath d='M21 6h4v1h-4zM18 7h4v1h-4zM15 8h3v1h-3zM13 9h2v1h-2zM11 10h2v1h-2zM9 11h2v1H9zM8 12h1v1H8zM7 13h1v1H7zM6 14h1v1H6z' fill='%237DD3FC'/%3E%3Cpath d='M22 7h3v1h-3zM18 8h6v1h-6zM15 9h6v1h-6zM13 10h6v1h-6zM11 11h6v1h-6zM9 12h5v1H9zM8 13h4v1H8zM7 14h3v1H7zM5 15h2v1H5zM4 16h2v1H4z' fill='%231E3A5F'/%3E%3Cpath d='M25 7h1v1h-1zM24 8h2v1h-2zM22 9h2v1h-2zM19 10h3v1h-3zM17 11h3v1h-3zM14 12h4v1h-4zM12 13h4v1h-4zM10 14h4v1h-4zM16 14h2v1h-2zM7 15h2v1H7zM11 15h3v1h-3zM16 15h2v1h-2zM6 16h1v1H6zM10 16h3v1h-3zM15 16h2v1h-2zM2 17h4v1H2zM8 17h4v1H8zM14 17h2v1h-2zM1 18h3v1H1zM5 18h1v1H5zM7 18h3v1H7zM13 18h2v1h-2zM1 19h2v1H1zM5 19h1v1H5zM4 20h2v1H4z' fill='%23091929'/%3E%3Cpath d='M24 9h1v1h-1zM22 10h2v1h-2zM20 11h3v1h-3zM18 12h3v1h-3zM16 13h3v1h-3z' fill='%231E4976'/%3E%3Crect x='21' y='9' width='1' height='1' fill='%2338BDF8'/%3E%3C/svg%3E" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root, [data-theme="ocean-light"] {
    --bg-sidebar: #EFF5FA;
    --bg-card: #FFFFFF;
    --bg-main: #FFFFFF;
    --bg-header: rgba(255, 255, 255, 0.92);
    --bg-hover: rgba(2, 132, 199, 0.07);
    --bg-active: #DCEEFA;
    --bg-bubble-in: #EEF3F8;
    --bg-bubble-out: #0284C7;
    --bg-pill: #E3F0FA;
    --text-primary: #12293B;
    --text-secondary: #51708A;
    --text-muted: #8FA9BD;
    --text-out: #FFFFFF;
    --border: #E2ECF4;
    --border-strong: #C6DAEA;
    --accent: #0284C7;
    --accent-strong: #0369A1;
    --accent-soft: rgba(2, 132, 199, 0.12);
    --ok: #16A34A;
    --warn: #D97706;
    --err: #DC2626;
    --shadow-sm: 0 1px 3px rgba(16, 42, 60, 0.07);
    --shadow-md: 0 16px 40px rgba(16, 42, 60, 0.18);
    --font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace;
  }

  [data-theme="ocean-deep"] {
    --bg-sidebar: #0A1B2B;
    --bg-card: #12293E;
    --bg-main: #0D2236;
    --bg-header: rgba(13, 34, 54, 0.92);
    --bg-hover: rgba(56, 189, 248, 0.09);
    --bg-active: rgba(56, 189, 248, 0.16);
    --bg-bubble-in: #173650;
    --bg-bubble-out: #0284C7;
    --bg-pill: #16334D;
    --text-primary: #E8F4FD;
    --text-secondary: #93B7D2;
    --text-muted: #5E82A0;
    --text-out: #FFFFFF;
    --border: #1B3A57;
    --border-strong: #28506F;
    --accent: #4DB8EC;
    --accent-strong: #7CCBF2;
    --accent-soft: rgba(77, 184, 236, 0.16);
    --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
    --shadow-md: 0 16px 40px rgba(0, 0, 0, 0.5);
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

  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }

  /* ===== 2-column chat layout ===== */
  .app-shell {
    display: grid;
    grid-template-columns: 300px minmax(0, 1fr);
    height: 100dvh;
    width: 100vw;
  }
  .app-shell.sidebar-collapsed {
    grid-template-columns: 0px minmax(0, 1fr);
  }
  .app-shell.sidebar-collapsed .sidebar {
    overflow: hidden;
    border-right: none;
  }

  /* ===== LEFT SIDEBAR ===== */
  .sidebar {
    background: var(--bg-sidebar);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 0;
    user-select: none;
  }

  .brand-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 14px 10px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .brand-logo {
    width: 40px;
    height: 40px;
    border-radius: 13px;
    background: linear-gradient(180deg, #22D3EE 0%, #0284C7 55%, #1E3A8A 100%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 4px 12px var(--accent-soft);
    overflow: hidden;
  }
  .brand-logo svg {
    width: 34px;
    height: 34px;
    shape-rendering: crispEdges;
    image-rendering: pixelated;
  }
  .brand-name {
    font-size: 15.5px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }
  .brand-sub {
    font-size: 11px;
    color: var(--text-secondary);
  }
  .brand-actions {
    display: flex;
    gap: 2px;
  }

  .icon-btn {
    width: 32px;
    height: 32px;
    border-radius: 9px;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .icon-btn:hover {
    background: var(--bg-hover);
    color: var(--accent);
  }
  .icon-btn svg {
    width: 17px;
    height: 17px;
  }

  .search-wrap {
    padding: 2px 12px 10px;
  }
  .search-box {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 7px 12px;
  }
  .search-box svg {
    width: 14px;
    height: 14px;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .search-box input {
    border: none;
    outline: none;
    background: transparent;
    width: 100%;
    font-size: 13px;
    color: var(--text-primary);
  }
  .search-box input::placeholder {
    color: var(--text-muted);
  }

  .chat-list-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 0 8px 10px;
  }
  .list-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 8px 4px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-secondary);
  }
  .list-title .count {
    font-weight: 600;
    text-transform: none;
    letter-spacing: 0;
  }

  .chat-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px;
    border-radius: 12px;
    border: none;
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition: background 0.13s;
  }
  .chat-item:hover {
    background: var(--bg-hover);
  }
  .chat-item.active {
    background: var(--bg-active);
  }

  .avatar {
    position: relative;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: #FFFFFF;
  }
  .avatar svg {
    width: 30px;
    height: 30px;
    shape-rendering: crispEdges;
    image-rendering: pixelated;
  }
  .avatar.sm {
    width: 34px;
    height: 34px;
  }
  .avatar.sm svg {
    width: 24px;
    height: 24px;
    shape-rendering: crispEdges;
    image-rendering: pixelated;
  }

  .status-dot {
    position: absolute;
    right: 0;
    bottom: 1px;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    border: 2px solid var(--bg-sidebar);
    background: var(--ok);
  }
  .chat-item.active .status-dot {
    border-color: var(--bg-active);
  }
  .status-dot.working {
    background: var(--warn);
    animation: pulse 1.4s infinite ease-in-out;
  }
  .status-dot.queued { background: var(--accent); }
  .status-dot.error { background: var(--err); }

  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.22); }
  }

  .chat-item-main {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .chat-item-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }
  .chat-item-name {
    font-size: 13.5px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .role-tag {
    font-size: 10px;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--bg-pill);
    color: var(--accent);
    letter-spacing: 0.02em;
    flex-shrink: 0;
  }
  .chat-item-preview {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sidebar-footer {
    border-top: 1px solid var(--border);
    padding: 8px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .footer-icons {
    display: flex;
    gap: 2px;
  }

  .conn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--text-secondary);
  }
  .conn-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--err);
  }
  .conn.LIVE .conn-dot { background: var(--ok); }
  .conn.POLLING .conn-dot { background: var(--warn); }

  /* ===== RIGHT MAIN CHAT ===== */
  .chat-main {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    min-width: 0;
    background: var(--bg-main);
  }

  .chat-header {
    height: 62px;
    padding: 0 18px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-header);
    backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-shrink: 0;
  }
  .chat-header-left {
    display: flex;
    align-items: center;
    gap: 10px;
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
    font-size: 15px;
    font-weight: 800;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .header-sub {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .pill-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid var(--border-strong);
    background: var(--bg-card);
    color: var(--text-primary);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: border-color 0.14s, color 0.14s;
    white-space: nowrap;
  }
  .pill-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .pill-btn svg {
    width: 14px;
    height: 14px;
  }

  .chat-stream {
    flex: 1;
    overflow-y: auto;
    padding: 22px 26px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .day-sep {
    align-self: center;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-secondary);
    background: var(--bg-pill);
    padding: 3px 12px;
    border-radius: 999px;
  }

  /* ===== Welcome / empty state ===== */
  .welcome {
    margin: auto;
    max-width: 480px;
    text-align: center;
    padding: 20px 10px;
  }
  .hero-art {
    width: 136px;
    height: 136px;
    margin: 0 auto 18px;
    border-radius: 50%;
    background: linear-gradient(180deg, #22D3EE 0%, #0284C7 55%, #1E3A8A 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 0 10px var(--accent-soft), 0 12px 28px rgba(2, 132, 199, 0.25);
    overflow: hidden;
  }
  .hero-art svg {
    width: 136px;
    height: 136px;
    shape-rendering: crispEdges;
    image-rendering: pixelated;
  }
  .welcome h2 {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-bottom: 8px;
  }
  .welcome p {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.65;
    margin-bottom: 20px;
  }
  .quick-grid {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }
  .quick-chip {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 9px 14px;
    border-radius: 999px;
    background: var(--bg-card);
    border: 1px solid var(--border-strong);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.14s, color 0.14s;
  }
  .quick-chip:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .quick-chip svg {
    width: 15px;
    height: 15px;
    color: var(--accent);
  }

  /* ===== Messages ===== */
  .msg-row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    max-width: 76%;
  }
  .msg-row.out {
    align-self: flex-end;
    flex-direction: row-reverse;
  }
  .msg-row.in {
    align-self: flex-start;
  }

  .msg-stack {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .msg-row.out .msg-stack {
    align-items: flex-end;
  }

  .msg-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 4px;
    font-size: 12px;
    flex-wrap: wrap;
  }
  .msg-author {
    font-weight: 700;
  }
  .route-tag {
    font-size: 10.5px;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--bg-pill);
    color: var(--accent);
  }
  .msg-core {
    font-size: 11px;
    color: var(--text-muted);
  }
  .msg-time {
    font-size: 11px;
    color: var(--text-muted);
  }

  .msg-bubble {
    padding: 10px 14px;
    border-radius: 16px;
    font-size: 14px;
    line-height: 1.55;
    word-break: break-word;
    white-space: pre-wrap;
  }
  .msg-row.in .msg-bubble {
    background: var(--bg-bubble-in);
    border-bottom-left-radius: 5px;
  }
  .msg-row.out .msg-bubble {
    background: var(--bg-bubble-out);
    color: var(--text-out);
    border-bottom-right-radius: 5px;
    box-shadow: 0 2px 8px var(--accent-soft);
  }
  .msg-bubble.priority {
    border: 2px solid var(--warn);
  }

  /* Typing indicator */
  .typing-row {
    display: flex;
    align-items: center;
    gap: 8px;
    align-self: flex-start;
    max-width: 76%;
  }
  .typing-bubble {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    background: var(--bg-bubble-in);
    border-radius: 16px;
    border-bottom-left-radius: 5px;
    padding: 10px 14px;
    font-size: 12.5px;
    color: var(--text-secondary);
  }
  .typing-dots {
    display: inline-flex;
    gap: 3px;
    flex-shrink: 0;
  }
  .typing-dots i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    animation: bounce 1.2s infinite ease-in-out;
  }
  .typing-dots i:nth-child(2) { animation-delay: 0.15s; }
  .typing-dots i:nth-child(3) { animation-delay: 0.3s; }
  @keyframes bounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.55; }
    30% { transform: translateY(-4px); opacity: 1; }
  }

  /* ===== Composer ===== */
  .composer {
    padding: 8px 18px 14px;
    border-top: 1px solid var(--border);
    background: var(--bg-header);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .composer-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 12px;
    color: var(--text-secondary);
  }
  .ctrl-label {
    font-weight: 600;
  }
  .select {
    padding: 4px 10px;
    border-radius: 8px;
    border: 1px solid var(--border-strong);
    background: var(--bg-card);
    color: var(--text-primary);
    font-size: 12px;
    font-weight: 500;
    outline: none;
    cursor: pointer;
  }
  .composer-capsule {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-card);
    border: 1.5px solid var(--border-strong);
    border-radius: 999px;
    padding: 5px 6px 5px 16px;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .composer-capsule:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 4px var(--accent-soft);
  }
  .composer-input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 14px;
    color: var(--text-primary);
    padding: 5px 0;
  }
  .composer-input::placeholder {
    color: var(--text-muted);
  }
  .send-btn {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: none;
    background: linear-gradient(135deg, #38BDF8, #0369A1);
    color: #FFFFFF;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    box-shadow: 0 3px 10px var(--accent-soft);
    transition: transform 0.12s;
  }
  .send-btn:hover {
    transform: scale(1.05);
  }
  .send-btn.stop-btn {
    background: var(--err);
  }
  .send-btn svg {
    width: 17px;
    height: 17px;
  }

  /* ===== Modals ===== */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(9, 27, 43, 0.45);
    backdrop-filter: blur(4px);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 16px;
  }
  .modal-backdrop.open {
    display: flex;
  }
  .modal {
    background: var(--bg-card);
    border: 1px solid var(--border-strong);
    border-radius: 16px;
    width: 100%;
    max-width: 560px;
    max-height: 82vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-md);
    overflow: hidden;
  }
  .modal-head {
    padding: 14px 18px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 800;
    font-size: 15px;
  }
  .modal-body {
    padding: 16px 18px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .modal-card {
    background: var(--bg-main);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 12px 14px;
  }
  .modal-card h4 {
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
    gap: 10px;
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
    background: var(--bg-card);
    color: var(--text-primary);
    font-size: 13px;
    outline: none;
  }
  .form-input:focus {
    border-color: var(--accent);
  }
  .primary-btn {
    padding: 9px 16px;
    border-radius: 10px;
    border: none;
    background: linear-gradient(135deg, #38BDF8, #0369A1);
    color: #FFFFFF;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
  }

  @media (max-width: 760px) {
    .app-shell {
      grid-template-columns: 1fr;
    }
    .sidebar {
      position: fixed;
      inset: 0 auto 0 0;
      width: 290px;
      z-index: 60;
      transform: translateX(-100%);
      transition: transform 0.2s ease;
    }
    .sidebar.mobile-open {
      transform: translateX(0);
    }
  }
</style>
</head>
<body>
  <div class="app-shell" id="appLayout">
    <!-- LEFT SIDEBAR: CHAT LIST -->
    <aside class="sidebar" id="sidebar">
      <div class="brand-bar">
        <div class="brand">
          <div class="brand-logo" title="WhaleBot">
            <svg viewBox="0 0 28 28" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 0h2v9H5zM11 0h3v11h-3zM19 0h2v8h-2z" fill="rgba(255,255,255,0.16)"/>
              <path d="M21 6h4v1h-4zM18 7h4v1h-4zM15 8h3v1h-3zM13 9h2v1h-2zM11 10h2v1h-2zM9 11h2v1H9zM8 12h1v1H8zM7 13h1v1H7zM6 14h1v1H6z" fill="#7DD3FC"/>
              <path d="M22 7h3v1h-3zM18 8h6v1h-6zM15 9h6v1h-6zM13 10h6v1h-6zM11 11h6v1h-6zM9 12h5v1H9zM8 13h4v1H8zM7 14h3v1H7zM5 15h2v1H5zM4 16h2v1H4z" fill="#1E3A5F"/>
              <path d="M25 7h1v1h-1zM24 8h2v1h-2zM22 9h2v1h-2zM19 10h3v1h-3zM17 11h3v1h-3zM14 12h4v1h-4zM12 13h4v1h-4zM10 14h4v1h-4zM16 14h2v1h-2zM7 15h2v1H7zM11 15h3v1h-3zM16 15h2v1h-2zM6 16h1v1H6zM10 16h3v1h-3zM15 16h2v1h-2zM2 17h4v1H2zM8 17h4v1H8zM14 17h2v1h-2zM1 18h3v1H1zM5 18h1v1H5zM7 18h3v1H7zM13 18h2v1h-2zM1 19h2v1H1zM5 19h1v1H5zM4 20h2v1H4z" fill="#091929"/>
              <path d="M24 9h1v1h-1zM22 10h2v1h-2zM20 11h3v1h-3zM18 12h3v1h-3zM16 13h3v1h-3z" fill="#1E4976"/>
              <rect x="21" y="9" width="1" height="1" fill="#38BDF8"/>
            </svg>
          </div>
          <div class="brand-text">
            <div class="brand-name">WhaleBot</div>
            <div class="brand-sub">Multi-Agent Chat</div>
          </div>
        </div>

        <div class="brand-actions">
          <button class="icon-btn" onclick="toggleOceanTheme()" title="Đổi giao diện sáng / tối">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>
          <button class="icon-btn" onclick="openModal('spawnModal')" title="Thêm đồng sự mới">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>

      <div class="search-wrap">
        <div class="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.2" y2="16.2"/></svg>
          <input id="searchInput" type="text" placeholder="Tìm đồng sự..." oninput="renderRoster()" />
        </div>
      </div>

      <div class="chat-list-scroll">
        <div class="list-title"><span>Kênh nhóm</span></div>
        <div id="groupRoster"></div>

        <div class="list-title"><span>Đồng sự</span><span class="count" id="podCountLabel">3 thành viên</span></div>
        <div id="coworkerRoster"></div>
      </div>

      <div class="sidebar-footer">
        <span class="conn" id="connPill"><span class="conn-dot"></span><span id="sseText">…</span></span>
        <div class="footer-icons">
          <button class="icon-btn" onclick="openModal('runtimeModal')" title="Cài đặt & lệnh kiểm thử">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          <button class="icon-btn" onclick="openModal('connModal')" title="Trạng thái AI Cores">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
          </button>
        </div>
      </div>
    </aside>

    <!-- RIGHT MAIN: CONVERSATION -->
    <main class="chat-main">
      <header class="chat-header">
        <div class="chat-header-left">
          <button class="icon-btn" onclick="toggleSidebar()" title="Đóng/mở danh sách chat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="14" y2="17"/></svg>
          </button>
          <span class="avatar sm" id="headerAvatar" style="background:linear-gradient(135deg,#38BDF8,#0369A1);"></span>
          <div class="header-info">
            <div class="header-title-row">
              <span class="header-title" id="headerTitle">Nhóm WhaleBot</span>
              <span class="role-tag" id="headerRoleTag">Nhóm</span>
            </div>
            <div class="header-sub" id="headerSubtitle">Kênh phối hợp chung · #mesh-command-room</div>
          </div>
        </div>

        <div class="header-actions">
          <button class="pill-btn" onclick="mergeAgentWorktree(currentChannel === 'all' ? 'coder' : currentChannel)" title="Kiểm thử & gộp nhánh Git Worktree của đồng sự">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>
            <span>Gộp nhánh</span>
          </button>
          <button class="icon-btn" onclick="clearCurrentView()" title="Xóa lịch sử hiển thị">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      </header>

      <section class="chat-stream" id="chatStream"></section>

      <footer class="composer">
        <div class="composer-controls">
          <span class="ctrl-label">AI Core:</span>
          <select class="select" id="coreSelect" onchange="onCoreSelectChange(this.value)">
            <option value="auto">Tự động (Free model tốt nhất)</option>
            <option value="opencode">OpenCode Zen (Free Models)</option>
            <option value="codex">Codex CLI (ChatGPT OAuth)</option>
            <option value="claude">Claude Code CLI</option>
            <option value="antigravity">Antigravity IDE</option>
            <option value="neko-core">Custom Core</option>
          </select>
          <span class="ctrl-label">Gửi:</span>
          <select class="select" id="deliverySelect">
            <option value="send">Gửi ngay</option>
            <option value="interrupt">Ngắt & điều hướng (Steer)</option>
            <option value="queue">Vào hàng đợi</option>
          </select>
        </div>

        <div class="composer-capsule">
          <input
            id="msgInput"
            class="composer-input"
            type="text"
            placeholder="Nhập tin nhắn cho cả nhóm..."
            onkeydown="if(event.key==='Enter' && !event.shiftKey){event.preventDefault();sendComposerMessage();}"
          />
          <button class="send-btn" id="sendOrStopBtn" onclick="onSendOrStopClick()" title="Gửi tin nhắn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
          </button>
        </div>
      </footer>
    </main>
  </div>

  <!-- MODAL: SETTINGS & RUNTIME -->
  <div class="modal-backdrop" id="runtimeModal" onclick="if(event.target===this)closeTelemetry()">
    <div class="modal">
      <div class="modal-head">
        <span>Cài đặt & trạng thái</span>
        <button class="icon-btn" onclick="closeTelemetry()">✕</button>
      </div>
      <div class="modal-body">
        <div class="modal-card">
          <h4>Lệnh kiểm thử trước khi gộp nhánh (Verify Command)</h4>
          <div class="form-row" style="margin-bottom:0;">
            <input
              id="checkInput"
              class="form-input"
              type="text"
              style="font-family:var(--font-mono);font-size:12px;"
              value='python -m unittest discover -s tests -p "test_*.py" -v; python scripts/query_engine.py --test; python scripts/evaluate.py --check'
              oninput="currentVerifyCmd = this.value"
            />
          </div>
        </div>
        <div class="modal-card">
          <h4>Trạng thái đồng sự</h4>
          <div id="runtimeAgentsSummary" style="font-size:13px;color:var(--text-secondary);">Đang tải...</div>
        </div>
        <div class="modal-card">
          <h4>Log IDE gần nhất</h4>
          <div id="ideLogBox" style="font-family:var(--font-mono);font-size:12px;color:var(--text-secondary);white-space:pre-wrap;">Chưa có dữ liệu</div>
        </div>
      </div>
    </div>
  </div>

  <!-- MODAL: AI CORES -->
  <div class="modal-backdrop" id="connModal" onclick="if(event.target===this)closeTelemetry()">
    <div class="modal">
      <div class="modal-head">
        <span>Trạng thái AI Cores</span>
        <button class="icon-btn" onclick="closeTelemetry()">✕</button>
      </div>
      <div class="modal-body">
        <div class="modal-card">
          <h4>Các core trên máy này (Zero-API-Key)</h4>
          <div id="authList">Đang kiểm tra...</div>
        </div>
      </div>
    </div>
  </div>

  <!-- MODAL: NEW COWORKER -->
  <div class="modal-backdrop" id="spawnModal" onclick="if(event.target===this)closeTelemetry()">
    <div class="modal">
      <div class="modal-head">
        <span>Thêm đồng sự mới</span>
        <button class="icon-btn" onclick="closeTelemetry()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <label>Tên đăng nhập (@handle)</label>
          <input id="spawnId" class="form-input" placeholder="Ví dụ: qa-bot" />
        </div>
        <div class="form-row">
          <label>Tên hiển thị</label>
          <input id="spawnName" class="form-input" placeholder="Ví dụ: Bot Kiểm Thử" />
        </div>
        <div class="form-row">
          <label>Vai trò</label>
          <select id="spawnRole" class="form-input">
            <option value="writer">Writer — viết code (Git Worktree riêng)</option>
            <option value="reader">Reader — phân tích & review</option>
          </select>
        </div>
        <div class="form-row">
          <label>Mô tả công việc</label>
          <input id="spawnDesc" class="form-input" placeholder="Ví dụ: Kiểm tra bảo mật và viết kiểm thử tự động..." />
        </div>
        <button class="primary-btn" onclick="spawnNewCoworker()">Tạo đồng sự</button>
      </div>
    </div>
  </div>

<script>
  // ===== Pixel-Art Humpback Whale Mascot (28x28 crisp pixel grid) =====
  function whaleSvg(opts) {
    opts = opts || {};
    const top = opts.top || '#7DD3FC';
    const mid = opts.mid || '#1E3A5F';
    const dark = opts.dark || '#091929';
    const belly = opts.belly || '#1E4976';
    const eye = opts.eye || '#38BDF8';
    let scene = '';
    if (opts.scene) {
      scene =
        '<path d="M4 0h2v12H4zM9 0h3v15H9zM16 0h2v11h-2zM22 0h2v9h-2z" fill="rgba(255,255,255,0.14)"/>' +
        '<path d="M18 22h10v6H18zM13 24h5v4h-5zM9 26h4v2H9zM21 20h7v2h-7z" fill="rgba(9,25,41,0.45)"/>' +
        '<path d="M20 21h8v1h-8zM15 23h6v1h-6z" fill="rgba(56,189,248,0.22)"/>' +
        '<path d="M23 3h1v1h-1zM25 4h1v1h-1zM19 4h1v1h-1z" fill="rgba(255,255,255,0.65)"/>';
    }
    return '<svg viewBox="0 0 28 28" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      scene +
      '<path d="M21 6h4v1h-4zM18 7h4v1h-4zM15 8h3v1h-3zM13 9h2v1h-2zM11 10h2v1h-2zM9 11h2v1H9zM8 12h1v1H8zM7 13h1v1H7zM6 14h1v1H6z" fill="' + top + '"/>' +
      '<path d="M22 7h3v1h-3zM18 8h6v1h-6zM15 9h6v1h-6zM13 10h6v1h-6zM11 11h6v1h-6zM9 12h5v1H9zM8 13h4v1H8zM7 14h3v1H7zM5 15h2v1H5zM4 16h2v1H4z" fill="' + mid + '"/>' +
      '<path d="M25 7h1v1h-1zM24 8h2v1h-2zM22 9h2v1h-2zM19 10h3v1h-3zM17 11h3v1h-3zM14 12h4v1h-4zM12 13h4v1h-4zM10 14h4v1h-4zM16 14h2v1h-2zM7 15h2v1H7zM11 15h3v1h-3zM16 15h2v1h-2zM6 16h1v1H6zM10 16h3v1h-3zM15 16h2v1h-2zM2 17h4v1H2zM8 17h4v1H8zM14 17h2v1h-2zM1 18h3v1H1zM5 18h1v1H5zM7 18h3v1H7zM13 18h2v1h-2zM1 19h2v1H1zM5 19h1v1H5zM4 20h2v1H4z" fill="' + dark + '"/>' +
      '<path d="M24 9h1v1h-1zM22 10h2v1h-2zM20 11h3v1h-3zM18 12h3v1h-3zM16 13h3v1h-3z" fill="' + belly + '"/>' +
      '<rect x="21" y="9" width="1" height="1" fill="' + eye + '"/>' +
      '</svg>';
  }

  // Pixel whale for colored coworker avatars & full underwater pixel scene for welcome hero
  const WHALE_MARK = whaleSvg({ top: '#E0F2FE', mid: '#FFFFFF', dark: '#0C4A6E', belly: '#7DD3FC', eye: '#0284C7' });
  const WHALE_HERO = whaleSvg({ top: '#7DD3FC', mid: '#1E3A5F', dark: '#091929', belly: '#1E4976', eye: '#38BDF8', scene: true });

  const ICONS = {
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>'
  };

  const PERSONAS = {
    all: {
      title: 'Nhóm WhaleBot',
      tag: 'Nhóm',
      grad: 'linear-gradient(180deg, #22D3EE 0%, #0284C7 55%, #1E3A8A 100%)',
      sub: 'Kênh phối hợp chung · #mesh-command-room'
    },
    lead: {
      title: '@lead · Trưởng nhóm',
      tag: 'Lead',
      grad: 'linear-gradient(135deg, #0EA5E9, #075985)',
      sub: 'Điều phối & phân công công việc'
    },
    coder: {
      title: '@coder · Lập trình viên',
      tag: 'Writer',
      grad: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
      sub: 'Viết code & kiểm thử trong Git Worktree riêng'
    },
    reviewer: {
      title: '@reviewer · Kiểm duyệt',
      tag: 'QA',
      grad: 'linear-gradient(135deg, #6366F1, #4338CA)',
      sub: 'Review code & đảm bảo chất lượng'
    }
  };

  function getPersona(id) {
    if (PERSONAS[id]) return PERSONAS[id];
    return {
      title: '@' + id,
      tag: 'Đồng sự',
      grad: 'linear-gradient(135deg, #38BDF8, #0284C7)',
      sub: 'Chuyên gia đồng hành'
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
    const next = html.getAttribute('data-theme') === 'ocean-deep' ? 'ocean-light' : 'ocean-deep';
    html.setAttribute('data-theme', next);
    try { localStorage.setItem('botautotask-theme', next); } catch {}
  }
  try {
    const savedTheme = localStorage.getItem('botautotask-theme');
    if (savedTheme === 'ocean-deep' || savedTheme === 'ocean-light') {
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  } catch {}

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
    if (countEl) countEl.textContent = agentsState.length + ' thành viên';

    const runningCount = agentsState.filter((a) => a.status === 'running').length;
    const lastGroupMsg = feedItems[feedItems.length - 1];
    const groupPreview = runningCount > 0
      ? (runningCount + ' đồng sự đang xử lý...')
      : (lastGroupMsg ? ('@' + lastGroupMsg.from + ': ' + lastGroupMsg.text.slice(0, 40)) : 'Kênh chung của nhóm');

    const groupPersona = getPersona('all');
    groupEl.innerHTML = \`
      <button class="chat-item \${currentChannel === 'all' ? 'active' : ''}" onclick="selectChannel('all')">
        <span class="avatar" style="background:\${groupPersona.grad}">
          \${WHALE_MARK}
          <i class="status-dot \${runningCount > 0 ? 'working' : 'online'}"></i>
        </span>
        <span class="chat-item-main">
          <span class="chat-item-top">
            <span class="chat-item-name">\${escapeHtml(groupPersona.title)}</span>
            <span class="role-tag">\${groupPersona.tag}</span>
          </span>
          <span class="chat-item-preview">\${escapeHtml(groupPreview)}</span>
        </span>
      </button>
    \`;

    const filtered = agentsState.filter((a) => {
      if (!q) return true;
      const p = getPersona(a.id);
      return (
        a.id.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        (a.name || '').toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q)
      );
    });

    coworkerEl.innerHTML = filtered.map((a) => {
      const p = getPersona(a.id);
      const isRunning = a.status === 'running';
      const isQueued = (a.inboxCount || 0) > 0 || (a.pendingSteers || 0) > 0;
      const dotCls = isRunning ? 'working' : (a.status === 'error' ? 'error' : (isQueued ? 'queued' : 'online'));
      const preview = isRunning ? 'Đang xử lý nhiệm vụ...' : (a.description || p.sub);

      return \`
        <button class="chat-item \${currentChannel === a.id ? 'active' : ''}" onclick="selectChannel('\${escapeHtml(a.id)}')">
          <span class="avatar" style="background:\${p.grad}">
            \${WHALE_MARK}
            <i class="status-dot \${dotCls}"></i>
          </span>
          <span class="chat-item-main">
            <span class="chat-item-top">
              <span class="chat-item-name">\${escapeHtml(p.title)}</span>
              <span class="role-tag">\${escapeHtml(p.tag)}</span>
            </span>
            <span class="chat-item-preview">\${escapeHtml(preview)}</span>
          </span>
        </button>
      \`;
    }).join('');
  }

  function renderHeader() {
    const avatar = document.getElementById('headerAvatar');
    const title = document.getElementById('headerTitle');
    const tag = document.getElementById('headerRoleTag');
    const sub = document.getElementById('headerSubtitle');
    const input = document.getElementById('msgInput');
    const sendBtn = document.getElementById('sendOrStopBtn');
    const coreSelect = document.getElementById('coreSelect');

    const p = getPersona(currentChannel);
    if (avatar) {
      avatar.style.background = p.grad;
      avatar.innerHTML = WHALE_MARK;
    }
    if (title) title.textContent = p.title;
    if (tag) tag.textContent = p.tag;

    if (currentChannel === 'all') {
      if (sub) sub.textContent = p.sub;
      if (input) input.placeholder = 'Nhập tin nhắn cho cả nhóm...';
    } else {
      const a = agentsState.find((x) => x.id === currentChannel);
      if (sub) {
        sub.textContent = a && a.status === 'running' ? 'Đang xử lý...' : p.sub;
      }
      if (input) input.placeholder = 'Nhập tin nhắn cho ' + p.title + '...';
      if (a && coreSelect && document.activeElement !== coreSelect) {
        coreSelect.value = a.preferredCore || 'auto';
      }
    }

    const activeRunning = currentChannel === 'all'
      ? agentsState.some((a) => a.status === 'running')
      : agentsState.some((a) => a.id === currentChannel && a.status === 'running');

    if (sendBtn) {
      if (activeRunning) {
        sendBtn.className = 'send-btn stop-btn';
        sendBtn.innerHTML = ICONS.stop;
        sendBtn.title = 'Dừng';
      } else {
        sendBtn.className = 'send-btn';
        sendBtn.innerHTML = ICONS.up;
        sendBtn.title = 'Gửi tin nhắn';
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
        <div class="welcome">
          <div class="hero-art">\${WHALE_HERO}</div>
          <h2>Chào mừng đến WhaleBot</h2>
          <p>Không gian chat để bạn cùng các trợ lý AI phân tích, lập kế hoạch và hoàn thành công việc — mọi thay đổi code đều được kiểm thử trong Git Worktree trước khi gộp.</p>
          <div class="quick-grid">
            <button class="quick-chip" onclick="prefillPrompt('Hãy phân tích kiến trúc dự án hiện tại và đề xuất các việc cần làm tiếp theo.')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>
              <span>Phân tích dự án</span>
            </button>
            <button class="quick-chip" onclick="prefillPrompt('Lập kế hoạch chi tiết từng bước để triển khai tính năng tiếp theo và kiểm thử tự động.')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              <span>Lập kế hoạch</span>
            </button>
            <button class="quick-chip" onclick="prefillPrompt('Chạy toàn bộ bộ kiểm thử, rà soát lỗi và xuất báo cáo chất lượng dự án.')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
              <span>Kiểm thử & báo cáo</span>
            </button>
          </div>
        </div>
      \`;
      return;
    }

    let html = '<div class="day-sep">Hôm nay</div>';
    for (const m of msgs) {
      const isOut = m.from === 'commander';
      const senderPersona = getPersona(m.from);
      const senderLabel = isOut ? 'Bạn' : senderPersona.title;
      const routeTag = (!isOut && m.to && m.to !== 'commander' && m.to !== 'all')
        ? \`<span class="route-tag">@\${escapeHtml(m.to)}</span>\`
        : (isOut && currentChannel === 'all' && m.to && m.to !== 'all'
          ? \`<span class="route-tag">@\${escapeHtml(m.to)}</span>\`
          : '');
      const coreTag = m.core ? \`<span class="msg-core">\${escapeHtml(m.core)}</span>\` : '';

      html += \`
        <div class="msg-row \${isOut ? 'out' : 'in'}">
          \${!isOut ? \`
            <span class="avatar sm" style="background:\${senderPersona.grad}">
              \${WHALE_MARK}
            </span>
          \` : ''}
          <div class="msg-stack">
            <div class="msg-meta">
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
      const p = getPersona(a.id);
      const lastAct = (a.recentActivity || []).slice(-1)[0] || 'Đang xử lý...';
      html += \`
        <div class="typing-row">
          <span class="avatar sm" style="background:\${p.grad}">
            \${WHALE_MARK}
          </span>
          <div class="typing-bubble">
            <span class="typing-dots"><i></i><i></i><i></i></span>
            <span><strong>\${escapeHtml(p.title)}</strong> · \${escapeHtml(lastAct.slice(0, 80))}</span>
          </div>
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
        const p = getPersona(a.id);
        const act = (a.recentActivity || []).slice(-1)[0] || 'Đang lắng nghe...';
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
            \${v.authenticated ? 'Sẵn sàng' : (v.installed ? 'Chưa đăng nhập' : 'Chưa cài đặt')}
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
    document.querySelectorAll('.modal-backdrop').forEach((el) => el.classList.remove('open'));
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
