/**
 * BotAutoTask — Everyday Messenger / Telegram / Neko-Bot Style Multi-Agent Chat UI.
 * Clean 2-column chat layout:
 *   - Left sidebar: Brand header, search pill ("Tìm đồng nghiệp"), "Nhóm local" group rooms,
 *     1-on-1 coworker DM list with cute bot avatars, and bottom drawers ("Trạng thái runtime",
 *     "Kết nối", "Không gian cá nhân").
 *   - Right main chat: Coworker/Group header, "Mình bắt đầu từ đâu?" empty state with 3 quick
 *     action pills, Messenger/Telegram left/right chat bubbles, "Tài khoản" core selector row,
 *     and rounded pill composer ("+ Nhắn cho ... ↑").
 */

export function renderDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>BotAutoTask — Tactical Coworker Mesh (Neko Bot Messenger)</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --bg-sidebar: #F0EEE9;
    --bg-main: #FAF9F5;
    --bg-card: #FFFFFF;
    --bg-bubble-in: #F1EFEA;
    --bg-bubble-out: #232220;
    --bg-hover: #E6E3DC;
    --text-primary: #1F1E1C;
    --text-secondary: #6E6B65;
    --text-muted: #9A968E;
    --text-out: #FFFFFF;
    --border: #E4E1DA;
    --border-strong: #D5D1C8;
    --accent: #B85D43;
    --ok: #2E7D5B;
    --warn: #D97706;
    --err: #DC2626;
    --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.04);
    --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.08);
    --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace;
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

  /* 2-Column Everyday Messenger Layout */
  .app-layout {
    display: grid;
    grid-template-columns: 276px minmax(0, 1fr);
    height: 100dvh;
    width: 100vw;
    position: relative;
  }

  .app-layout.sidebar-collapsed {
    grid-template-columns: 0px minmax(0, 1fr);
  }
  .app-layout.sidebar-collapsed .sidebar {
    overflow: hidden;
    border-right: none;
  }

  /* ================= LEFT SIDEBAR ================= */
  .sidebar {
    background: var(--bg-sidebar);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    height: 100%;
    user-select: none;
    min-width: 0;
  }

  .sb-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 10px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 700;
    font-size: 16px;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .brand-logo {
    width: 30px;
    height: 24px;
    border-radius: 999px;
    background: #1F1E1C;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    box-shadow: inset 0 -2px 0 rgba(255,255,255,0.18);
  }
  .brand-logo span {
    width: 3px;
    height: 8px;
    border-radius: 2px;
    background: #FFFFFF;
  }

  .sb-top-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .icon-btn {
    width: 30px;
    height: 30px;
    border-radius: 8px;
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
    color: var(--text-primary);
  }
  .icon-btn svg {
    width: 16px;
    height: 16px;
  }

  /* Search pill */
  .sb-search-wrap {
    padding: 4px 14px 12px;
  }
  .sb-search {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 7px 12px;
    box-shadow: var(--shadow-sm);
  }
  .sb-search svg {
    width: 14px;
    height: 14px;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .sb-search input {
    border: none;
    outline: none;
    background: transparent;
    width: 100%;
    font-size: 13px;
    color: var(--text-primary);
  }
  .sb-search input::placeholder {
    color: var(--text-muted);
  }

  /* Scrollable middle roster */
  .sb-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 0 10px 12px;
  }

  .sb-section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 8px 4px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .sb-section-note {
    padding: 0 8px 8px;
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.4;
  }

  /* Roster item (Group & Coworker rows) */
  .roster-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 10px;
  }

  .roster-item {
    display: flex;
    align-items: center;
    gap: 11px;
    width: 100%;
    padding: 9px 11px;
    border-radius: 14px;
    border: 1px solid transparent;
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition: background 0.14s, box-shadow 0.14s;
  }
  .roster-item:hover {
    background: rgba(255, 255, 255, 0.55);
  }
  .roster-item.active {
    background: var(--bg-card);
    border-color: var(--border);
    box-shadow: var(--shadow-sm);
  }

  /* Cute Neko-Bot circular avatar */
  .bot-avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    position: relative;
  }
  .bot-avatar.sm {
    width: 32px;
    height: 32px;
  }
  .bot-avatar-face {
    width: 62%;
    height: 52%;
    border-radius: 999px;
    background: #1F1E1C;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }
  .bot-avatar-face i {
    width: 2.5px;
    height: 7px;
    border-radius: 2px;
    background: #FFFFFF;
    display: block;
  }

  .status-dot {
    position: absolute;
    right: -1px;
    bottom: -1px;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    border: 2px solid var(--bg-sidebar);
    background: #9CA3AF;
  }
  .roster-item.active .status-dot {
    border-color: var(--bg-card);
  }
  .status-dot.online, .status-dot.idle { background: var(--ok); }
  .status-dot.working {
    background: var(--warn);
    animation: pulseDot 1.3s infinite ease-in-out;
  }
  .status-dot.queued { background: #3B82F6; }
  .status-dot.error { background: var(--err); }

  @keyframes pulseDot {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.22); opacity: 0.75; }
  }

  .roster-meta {
    min-width: 0;
    flex: 1;
  }
  .roster-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }
  .roster-name {
    font-size: 13.5px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .roster-badge {
    font-size: 10.5px;
    padding: 1px 6px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.06);
    color: var(--text-secondary);
    font-weight: 500;
    flex-shrink: 0;
  }
  .roster-sub {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 1px;
  }

  /* Sidebar Footer Items (matching screenshot: Trạng thái runtime, Kết nối, Không gian cá nhân) */
  .sb-footer {
    border-top: 1px solid var(--border);
    padding: 8px 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .sb-foot-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    border-radius: 10px;
    border: none;
    background: transparent;
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: background 0.14s;
  }
  .sb-foot-btn:hover {
    background: var(--bg-hover);
  }
  .sb-foot-btn svg {
    width: 16px;
    height: 16px;
    color: var(--text-secondary);
    flex-shrink: 0;
  }
  .sb-foot-sub {
    display: block;
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 400;
  }

  .ws-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #E2DDD5;
    color: var(--text-primary);
    font-size: 11px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  /* Connection dot indicator for tests & status */
  .conn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: var(--text-secondary);
    margin-left: auto;
  }
  .conn-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--err);
  }
  .conn.LIVE .conn-dot { background: var(--ok); }
  .conn.POLLING .conn-dot { background: var(--warn); }

  /* ================= MAIN CHAT COLUMN ================= */
  .chat-main {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    background: var(--bg-main);
    min-width: 0;
  }

  /* Top Chat Header */
  .chat-header {
    height: 60px;
    padding: 0 20px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-main);
    flex-shrink: 0;
  }

  .chat-header-left {
    display: flex;
    align-items: center;
    gap: 11px;
    min-width: 0;
  }

  .chat-title-wrap {
    min-width: 0;
  }
  .chat-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.25;
  }
  .chat-subtitle {
    font-size: 12px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chat-header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .header-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--ok);
    margin: 0 2px;
  }

  /* Messages Stream Area */
  .chat-stream {
    flex: 1;
    overflow-y: auto;
    padding: 24px 28px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  /* Empty State ("Mình bắt đầu từ đâu?") */
  .empty-welcome {
    margin: auto;
    max-width: 460px;
    text-align: center;
    padding: 32px 16px;
  }
  .empty-cat-icon {
    width: 44px;
    height: 44px;
    margin: 0 auto 14px;
    color: var(--text-secondary);
  }
  .empty-welcome h2 {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    margin-bottom: 8px;
  }
  .empty-welcome p {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.55;
    margin-bottom: 20px;
  }
  .quick-pills {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .quick-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 999px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    cursor: pointer;
    box-shadow: var(--shadow-sm);
    transition: transform 0.12s, border-color 0.12s;
  }
  .quick-pill:hover {
    border-color: var(--border-strong);
    transform: translateY(-1px);
  }
  .quick-pill svg {
    width: 14px;
    height: 14px;
    color: var(--text-secondary);
  }

  /* Day separator */
  .day-sep {
    align-self: center;
    font-size: 11.5px;
    color: var(--text-muted);
    background: rgba(0, 0, 0, 0.04);
    padding: 3px 12px;
    border-radius: 999px;
    margin: 6px 0;
  }

  /* Messenger / Telegram Bubbles */
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

  .msg-col {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }
  .msg-row.outgoing .msg-col {
    align-items: flex-end;
  }

  .msg-sender-line {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 4px;
    font-size: 12px;
  }
  .msg-sender-name {
    font-weight: 600;
    color: var(--text-primary);
  }
  .msg-sender-meta {
    color: var(--text-muted);
    font-size: 11px;
  }
  .msg-route-pill {
    font-size: 11px;
    padding: 1px 7px;
    border-radius: 999px;
    background: #E8E4DC;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .msg-bubble {
    padding: 11px 15px;
    border-radius: 18px;
    font-size: 14px;
    line-height: 1.55;
    word-break: break-word;
    white-space: pre-wrap;
    box-shadow: var(--shadow-sm);
  }
  .msg-row.incoming .msg-bubble {
    background: var(--bg-card);
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
    border: 1.5px solid var(--warn);
  }
  .msg-bubble code {
    font-family: var(--font-mono);
    font-size: 12.5px;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.06);
  }
  .msg-row.outgoing .msg-bubble code {
    background: rgba(255, 255, 255, 0.16);
  }

  /* Typing indicator bubble */
  .typing-bubble {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 14px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 18px;
    font-size: 12.5px;
    color: var(--text-secondary);
    align-self: flex-start;
  }
  .typing-dots {
    display: inline-flex;
    gap: 3px;
  }
  .typing-dots i {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--text-secondary);
    animation: bounceDot 1.2s infinite ease-in-out;
  }
  .typing-dots i:nth-child(2) { animation-delay: 0.15s; }
  .typing-dots i:nth-child(3) { animation-delay: 0.3s; }
  @keyframes bounceDot {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.45; }
    40% { transform: translateY(-4px); opacity: 1; }
  }

  /* ================= BOTTOM COMPOSER ================= */
  .composer-area {
    padding: 8px 20px 16px;
    background: var(--bg-main);
    border-top: 1px solid rgba(0, 0, 0, 0.04);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* "Tài khoản" selector bar (matching screenshot) */
  .account-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12.5px;
    color: var(--text-secondary);
  }
  .account-label {
    white-space: nowrap;
    color: var(--text-secondary);
    font-weight: 500;
  }
  .account-select {
    flex: 1;
    padding: 5px 12px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-card);
    color: var(--text-primary);
    font-size: 12.5px;
    outline: none;
    cursor: pointer;
  }
  .delivery-select {
    padding: 5px 10px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-card);
    color: var(--text-secondary);
    font-size: 12px;
    outline: none;
    cursor: pointer;
  }

  /* Pill input bar ("+ Nhắn cho Meiiie... ↑") */
  .composer-pill {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--bg-card);
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    padding: 6px 8px 6px 10px;
    box-shadow: var(--shadow-sm);
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .composer-pill:focus-within {
    border-color: #9E988E;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
  }

  .plus-btn {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
  }
  .plus-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  .plus-btn svg {
    width: 18px;
    height: 18px;
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

  .send-circle-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--bg-sidebar);
    color: var(--text-primary);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
  }
  .send-circle-btn:hover {
    background: var(--text-primary);
    color: #FFFFFF;
    border-color: var(--text-primary);
  }
  .send-circle-btn.stop-btn {
    background: #FEE2E2;
    color: var(--err);
    border-color: #FCA5A5;
  }
  .send-circle-btn svg {
    width: 16px;
    height: 16px;
  }

  /* ================= DRAWER / MODAL OVERLAY (Runtime & Connections) ================= */
  .tele-drawer-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.25);
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
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 18px;
    width: 100%;
    max-width: 560px;
    max-height: 82vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-md);
    overflow: hidden;
  }

  .tele-head {
    padding: 14px 18px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 700;
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
    border-radius: 12px;
    padding: 12px 14px;
  }
  .tele-card h4 {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }

  .auth-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
    font-size: 13px;
  }
  .auth-row:last-child {
    border-bottom: none;
  }

  .form-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 10px;
  }
  .form-row label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
  }
  .form-input {
    padding: 8px 11px;
    border-radius: 8px;
    border: 1px solid var(--border-strong);
    background: var(--bg-card);
    font-size: 13px;
  }

  .primary-btn {
    padding: 8px 14px;
    border-radius: 10px;
    border: none;
    background: var(--text-primary);
    color: #FFFFFF;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
  }

  @media (max-width: 760px) {
    .app-layout {
      grid-template-columns: 1fr;
    }
    .sidebar {
      position: fixed;
      inset: 0 auto 0 0;
      width: 276px;
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
  <div class="app-layout" id="appLayout">
    <!-- LEFT SIDEBAR (Neko Bot / Messenger / Telegram Style) -->
    <aside class="sidebar" id="sidebar">
      <div class="sb-header">
        <div class="brand">
          <div class="brand-logo"><span></span><span></span></div>
          <span>Neko Bot</span>
        </div>
        <div class="sb-top-actions">
          <button class="icon-btn" onclick="toggleSidebar()" title="Thu gọn thanh bên">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/></svg>
          </button>
          <button class="icon-btn" onclick="openModal('spawnModal')" title="Thêm đồng nghiệp mới">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>

      <div class="sb-search-wrap">
        <div class="sb-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.2" y2="16.2"/></svg>
          <input id="searchInput" type="text" placeholder="Tìm đồng nghiệp" oninput="renderRoster()" />
        </div>
      </div>

      <div class="sb-scroll">
        <div class="sb-section-head">
          <span>Nhóm local</span>
          <button class="icon-btn" style="width:22px;height:22px;" onclick="selectChannel('all')" title="Mở phòng họp nhóm (#mesh-command-room)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
        <div class="sb-section-note">Tạo nhóm để nhiều bot cùng trả lời tại đây.</div>
        <div class="roster-list" id="groupRoster"></div>

        <div class="sb-section-head">
          <span>Đồng nghiệp AI</span>
        </div>
        <div class="roster-list" id="coworkerRoster"></div>
      </div>

      <div class="sb-footer">
        <button class="sb-foot-btn" onclick="openModal('runtimeModal')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="14" x2="13" y2="14"/></svg>
          <span>Trạng thái runtime</span>
          <span class="conn LIVE" id="connPill"><span class="conn-dot"></span><span id="sseText">LIVE</span></span>
        </button>
        <button class="sb-foot-btn" onclick="openModal('connModal')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
          <span>Kết nối</span>
        </button>
        <button class="sb-foot-btn" onclick="openModal('runtimeModal')">
          <span class="ws-avatar">P</span>
          <span style="min-width:0;flex:1;">
            <span style="display:block;font-weight:600;font-size:12.5px;">Không gian cá nhân</span>
            <span class="sb-foot-sub" id="wsPathLabel">Lịch sử lưu trên máy</span>
          </span>
        </button>
      </div>
    </aside>

    <!-- RIGHT MAIN CHAT AREA -->
    <main class="chat-main">
      <!-- Chat Header -->
      <header class="chat-header">
        <div class="chat-header-left">
          <button class="icon-btn" onclick="toggleSidebar()" title="Mở danh sách đồng nghiệp" style="margin-right:2px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="14" y2="17"/></svg>
          </button>
          <div class="bot-avatar sm" id="headerAvatar" style="background:#B85D43;">
            <div class="bot-avatar-face"><i></i><i></i></div>
          </div>
          <div class="chat-title-wrap">
            <div class="chat-title" id="headerTitle">Lead</div>
            <div class="chat-subtitle" id="headerSubtitle">Hội thoại ban đầu · #mesh-command-room</div>
          </div>
        </div>

        <div class="chat-header-actions">
          <button class="icon-btn" onclick="openModal('runtimeModal')" title="Chỉnh lệnh kiểm thử & cấu hình">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
          <span class="header-dot" id="headerDot"></span>
          <button class="icon-btn" onclick="mergeAgentWorktree(currentChannel === 'all' ? 'coder' : currentChannel)" title="Gộp nhánh Git Worktree (Merge)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </button>
          <button class="icon-btn" onclick="clearCurrentView()" title="Làm mới khung hội thoại">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v4h6V4"/></svg>
          </button>
        </div>
      </header>

      <!-- Message Stream / Empty Welcome State -->
      <section class="chat-stream" id="chatStream"></section>

      <!-- Bottom Composer Bar (matching screenshot) -->
      <footer class="composer-area">
        <div class="account-row">
          <span class="account-label">Tài khoản</span>
          <select class="account-select" id="coreSelect" onchange="onCoreSelectChange(this.value)">
            <option value="auto">Không chọn tài khoản (Tự động chọn Free Model tốt nhất)</option>
            <option value="opencode">OpenCode Zen — Free Models (deepseek / big-pickle / mimo)</option>
            <option value="codex">Codex CLI — ChatGPT OAuth (gpt-5.4)</option>
            <option value="claude">Claude Code CLI — Local Session</option>
            <option value="antigravity">Antigravity IDE — Local Session</option>
            <option value="neko-core">Neko Core — Local Daemon</option>
          </select>
          <select class="delivery-select" id="deliverySelect" title="Chế độ gửi tin nhắn">
            <option value="send">Gửi trực tiếp</option>
            <option value="interrupt">Chèn ưu tiên (Steer)</option>
            <option value="queue">Xếp hàng (Queue)</option>
          </select>
        </div>

        <div class="composer-pill">
          <button class="plus-btn" onclick="openModal('runtimeModal')" title="Tùy chọn nâng cao & lệnh kiểm thử">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <input
            id="msgInput"
            class="composer-input"
            type="text"
            placeholder="Nhắn cho Lead..."
            onkeydown="if(event.key==='Enter' && !event.shiftKey){event.preventDefault();sendComposerMessage();}"
          />
          <button class="send-circle-btn" id="sendOrStopBtn" onclick="onSendOrStopClick()" title="Gửi tin nhắn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
          </button>
        </div>
      </footer>
    </main>
  </div>

  <!-- MODAL 1: TRẠNG THÁI RUNTIME & KIỂM THỬ -->
  <div class="tele-drawer-backdrop" id="runtimeModal" onclick="if(event.target===this)closeTelemetry()">
    <div class="tele-modal">
      <div class="tele-head">
        <span>Trạng thái Runtime & Kiểm thử Worktree</span>
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
          <h4>Đồng nghiệp đang hoạt động</h4>
          <div id="runtimeAgentsSummary" style="font-size:13px;color:var(--text-secondary);">Đang tải...</div>
        </div>
        <div class="tele-card">
          <h4>Nhật ký IDE / Antigravity gần nhất</h4>
          <div id="ideLogBox" style="font-family:var(--font-mono);font-size:12px;color:var(--text-secondary);white-space:pre-wrap;">Chưa có dữ liệu</div>
        </div>
      </div>
    </div>
  </div>

  <!-- MODAL 2: KẾT NỐI ZERO-API-KEY -->
  <div class="tele-drawer-backdrop" id="connModal" onclick="if(event.target===this)closeTelemetry()">
    <div class="tele-modal">
      <div class="tele-head">
        <span>Kết nối tài khoản & AI Cores</span>
        <button class="icon-btn" onclick="closeTelemetry()">✕</button>
      </div>
      <div class="tele-body">
        <div class="tele-card">
          <h4>Trạng thái đăng nhập Zero-API-Key</h4>
          <div id="authList">Đang kiểm tra...</div>
        </div>
      </div>
    </div>
  </div>

  <!-- MODAL 3: THÊM ĐỒNG NGHIỆP MỚI -->
  <div class="tele-drawer-backdrop" id="spawnModal" onclick="if(event.target===this)closeTelemetry()">
    <div class="tele-modal">
      <div class="tele-head">
        <span>Thêm đồng nghiệp AI mới</span>
        <button class="icon-btn" onclick="closeTelemetry()">✕</button>
      </div>
      <div class="tele-body">
        <div class="form-row">
          <label>Mã định danh (@handle)</label>
          <input id="spawnId" class="form-input" placeholder="Ví dụ: qa-bot" />
        </div>
        <div class="form-row">
          <label>Tên hiển thị</label>
          <input id="spawnName" class="form-input" placeholder="Ví dụ: QA Engineer" />
        </div>
        <div class="form-row">
          <label>Vai trò</label>
          <select id="spawnRole" class="form-input">
            <option value="writer">Writer (Code trong nhánh Git Worktree riêng)</option>
            <option value="reader">Reader (Phân tích, Lên kế hoạch, Review)</option>
          </select>
        </div>
        <div class="form-row">
          <label>Mô tả nhiệm vụ</label>
          <input id="spawnDesc" class="form-input" placeholder="Chuyên viết unit test và kiểm tra bảo mật..." />
        </div>
        <button class="primary-btn" onclick="spawnNewCoworker()">Tạo đồng nghiệp</button>
      </div>
    </div>
  </div>

<script>
  const ICONS = {
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    cat: '<svg class="empty-cat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 5c-1.5 0-2.8.4-4 1L5 3v5c-.6 1.2-1 2.5-1 4 0 5 3.6 8 8 8s8-3 8-8c0-1.5-.4-2.8-1-4V3l-3 3c-1.2-.6-2.5-1-4-1z"/><line x1="9" y1="12" x2="9.01" y2="12" stroke-width="2.4" stroke-linecap="round"/><line x1="15" y1="12" x2="15.01" y2="12" stroke-width="2.4" stroke-linecap="round"/><path d="M10 15.5c.7.5 1.3.7 2 .7s1.3-.2 2-.7"/></svg>'
  };

  const AVATAR_COLORS = {
    all: '#6B5B4D',
    lead: '#B85D43',
    coder: '#3D6B58',
    reviewer: '#4A628A'
  };

  function getAvatarColor(id) {
    if (AVATAR_COLORS[id]) return AVATAR_COLORS[id];
    let hash = 0;
    const s = String(id || 'bot');
    for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
    const palette = ['#B85D43', '#3D6B58', '#4A628A', '#8C5A3C', '#5B6E49', '#7A527A'];
    return palette[Math.abs(hash) % palette.length];
  }

  let authToken = '';
  if (location.hash.startsWith('#k=')) {
    authToken = location.hash.slice(3);
  }

  let agentsState = [];
  let feedItems = [];
  let currentChannel = 'lead'; // Default to 1-on-1 coworker like screenshot ("Meiiie"), or 'all' for group room
  let currentVerifyCmd = 'python -m unittest discover -s tests -p "test_*.py" -v; python scripts/query_engine.py --test; python scripts/evaluate.py --check';
  let sseSource = null;
  let sseState = 'CONNECTING';
  let lastStateOkTs = 0;
  let initialSwitchDone = false;

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
        if (added) {
          if (!initialSwitchDone && feedItems.length > 0) {
            currentChannel = 'all';
            initialSwitchDone = true;
          }
          renderStream();
        }
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
    if (!groupEl || !coworkerEl) return;

    // 1. Group Room ("Phòng điều phối nhóm #mesh-command-room")
    const runningCount = agentsState.filter((a) => a.status === 'running').length;
    const lastGroupMsg = feedItems[feedItems.length - 1];
    const groupSub = runningCount > 0
      ? (runningCount + ' đồng nghiệp đang xử lý...')
      : (lastGroupMsg ? ('@' + lastGroupMsg.from + ': ' + lastGroupMsg.text.slice(0, 36)) : '@lead, @coder, @reviewer');

    groupEl.innerHTML = \`
      <button class="roster-item \${currentChannel === 'all' ? 'active' : ''}" onclick="selectChannel('all')">
        <div class="bot-avatar" style="background:\${getAvatarColor('all')}">
          <div class="bot-avatar-face"><i></i><i></i></div>
          <span class="status-dot \${runningCount > 0 ? 'working' : 'online'}"></span>
        </div>
        <div class="roster-meta">
          <div class="roster-title-row">
            <span class="roster-name">Nhóm Đồng Nghiệp</span>
            <span class="roster-badge">\${agentsState.length} bot</span>
          </div>
          <div class="roster-sub">\${escapeHtml(groupSub)}</div>
        </div>
      </button>
    \`;

    // 2. Individual Coworkers (like Meiiie / Davin in the screenshot)
    const filtered = agentsState.filter((a) => {
      if (!q) return true;
      return (
        a.id.toLowerCase().includes(q) ||
        (a.name || '').toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q)
      );
    });

    coworkerEl.innerHTML = filtered.map((a) => {
      const isRunning = a.status === 'running';
      const isQueued = (a.inboxCount || 0) > 0 || (a.pendingSteers || 0) > 0;
      const dotCls = isRunning ? 'working' : (a.status === 'error' ? 'error' : (isQueued ? 'queued' : 'online'));
      const displayName = a.id.charAt(0).toUpperCase() + a.id.slice(1);
      const subText = isRunning
        ? 'Đang phản hồi...'
        : ('@' + a.id + (a.preferredCore && a.preferredCore !== 'auto' ? ' · ' + a.preferredCore : ''));

      return \`
        <button class="roster-item \${currentChannel === a.id ? 'active' : ''}" onclick="selectChannel('\${escapeHtml(a.id)}')">
          <div class="bot-avatar" style="background:\${getAvatarColor(a.id)}">
            <div class="bot-avatar-face"><i></i><i></i></div>
            <span class="status-dot \${dotCls}"></span>
          </div>
          <div class="roster-meta">
            <div class="roster-title-row">
              <span class="roster-name">\${escapeHtml(displayName)}</span>
              <span class="roster-badge">\${escapeHtml(a.role || 'bot')}</span>
            </div>
            <div class="roster-sub">\${escapeHtml(subText)}</div>
          </div>
        </button>
      \`;
    }).join('');
  }

  function renderHeader() {
    const avatar = document.getElementById('headerAvatar');
    const title = document.getElementById('headerTitle');
    const sub = document.getElementById('headerSubtitle');
    const input = document.getElementById('msgInput');
    const sendBtn = document.getElementById('sendOrStopBtn');
    const coreSelect = document.getElementById('coreSelect');

    if (currentChannel === 'all') {
      avatar.style.background = getAvatarColor('all');
      title.textContent = 'Nhóm Đồng Nghiệp';
      sub.textContent = 'Phòng phối hợp tự động (@lead · @coder · @reviewer) · #mesh-command-room';
      if (input) input.placeholder = 'Giao việc cho cả nhóm đồng nghiệp...';
    } else {
      const a = agentsState.find((x) => x.id === currentChannel);
      const displayName = currentChannel.charAt(0).toUpperCase() + currentChannel.slice(1);
      avatar.style.background = getAvatarColor(currentChannel);
      title.textContent = displayName;
      sub.textContent = a
        ? (a.status === 'running' ? 'Đang thực thi nhiệm vụ...' : (a.name || 'Hội thoại ban đầu'))
        : 'Hội thoại ban đầu';
      if (input) input.placeholder = 'Nhắn cho ' + displayName + '...';
      if (a && coreSelect && document.activeElement !== coreSelect) {
        coreSelect.value = a.preferredCore || 'auto';
      }
    }

    const activeRunning = currentChannel === 'all'
      ? agentsState.some((a) => a.status === 'running')
      : agentsState.some((a) => a.id === currentChannel && a.status === 'running');

    if (sendBtn) {
      if (activeRunning) {
        sendBtn.className = 'send-circle-btn stop-btn';
        sendBtn.innerHTML = ICONS.stop;
        sendBtn.title = 'Dừng thực thi (Stop)';
      } else {
        sendBtn.className = 'send-circle-btn';
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
        <div class="empty-welcome">
          \${ICONS.cat}
          <h2>Mình bắt đầu từ đâu?</h2>
          <p>Một câu hỏi nhỏ, một ý tưởng mới,<br/>hay một việc bạn muốn cùng làm.</p>
          <div class="quick-pills">
            <button class="quick-pill" onclick="prefillPrompt('Hãy khảo sát kiến trúc dự án và làm rõ các điểm cần cải thiện tiếp theo.')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>
              <span>Làm rõ ý tưởng</span>
            </button>
            <button class="quick-pill" onclick="prefillPrompt('Lên kế hoạch triển khai chi tiết từng bước cho tính năng tiếp theo của dự án.')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              <span>Lên kế hoạch</span>
            </button>
            <button class="quick-pill" onclick="prefillPrompt('Chạy kiểm thử toàn bộ dự án và chuẩn bị báo cáo đánh giá chất lượng.')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span>Chuẩn bị báo cáo</span>
            </button>
          </div>
        </div>
      \`;
      return;
    }

    let html = '<div class="day-sep">Hôm nay</div>';
    for (const m of msgs) {
      const isOut = m.from === 'commander';
      const senderLabel = isOut ? 'Bạn' : (m.from.charAt(0).toUpperCase() + m.from.slice(1));
      const routeBadge = (!isOut && m.to && m.to !== 'commander' && m.to !== 'all')
        ? \`<span class="msg-route-pill">→ @\${escapeHtml(m.to)}</span>\`
        : (isOut && currentChannel === 'all' && m.to && m.to !== 'all'
          ? \`<span class="msg-route-pill">→ @\${escapeHtml(m.to)}</span>\`
          : '');
      const coreBadge = m.core ? \`<span class="msg-sender-meta">· \${escapeHtml(m.core)}</span>\` : '';

      html += \`
        <div class="msg-row \${isOut ? 'outgoing' : 'incoming'}">
          \${!isOut ? \`
            <div class="bot-avatar sm" style="background:\${getAvatarColor(m.from)}">
              <div class="bot-avatar-face"><i></i><i></i></div>
            </div>
          \` : ''}
          <div class="msg-col">
            <div class="msg-sender-line">
              <span class="msg-sender-name">\${escapeHtml(senderLabel)}</span>
              \${routeBadge}
              \${coreBadge}
              <span class="msg-sender-meta">\${formatTime(m.ts)}</span>
            </div>
            <div class="msg-bubble \${m.priority ? 'priority' : ''}">\${escapeHtml(m.text)}</div>
          </div>
        </div>
      \`;
    }

    for (const a of runningAgents) {
      const dName = a.id.charAt(0).toUpperCase() + a.id.slice(1);
      const lastAct = (a.recentActivity || []).slice(-1)[0] || 'Đang suy nghĩ...';
      html += \`
        <div class="typing-bubble">
          <div class="typing-dots"><i></i><i></i><i></i></div>
          <span><strong>\${escapeHtml(dName)}</strong>: \${escapeHtml(lastAct.slice(0, 90))}</span>
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
        const act = (a.recentActivity || []).slice(-1)[0] || 'Sẵn sàng';
        return \`<div class="auth-row">
          <span><strong>@\${escapeHtml(a.id)}</strong> (\${escapeHtml(a.role)})</span>
          <span>\${escapeHtml(a.status.toUpperCase())} · \${escapeHtml(act.slice(0, 48))}</span>
        </div>\`;
      }).join('');
    }

    const authEl = document.getElementById('authList');
    if (authEl && data.auth) {
      authEl.innerHTML = Object.entries(data.auth).map(([k, v]) => \`
        <div class="auth-row">
          <span><strong>\${escapeHtml(k)}</strong> (\${escapeHtml(v.authMode || 'cli')})</span>
          <span style="color:\${v.authenticated ? 'var(--ok)' : 'var(--text-muted)'};font-weight:600;">
            \${v.authenticated ? 'ĐÃ KẾT NỐI' : (v.installed ? 'CHƯA ĐĂNG NHẬP' : 'CHƯA CÀI ĐẶT')}
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
    initialSwitchDone = true;
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
