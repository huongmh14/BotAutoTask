/**
 * BotAutoTask — Web Dashboard UI.
 * Clean 2-column chat layout (Messenger / Telegram style):
 *   - Left sidebar: chat list (group channel + AI coworkers), search, connection state
 *   - Right: conversation with left/right bubbles, typing indicator, composer
 *   - Ocean-blue primary palette (#0284C7) with light / deep-ocean dark themes
 *   - 52Hz Baleen Whale mascot (pure inline SVG traced from official logo, 0 external assets)
 */

export const WHALE_52HZ_PATH_D = 'M723.4 329.6Q751.4 340.1 761.4 345.1Q771.4 350.1 780.2 356.3Q789.0 362.5 796.8 370.2Q804.5 378.0 808.7 383.8Q812.9 389.6 812.7 390.7Q812.5 391.8 804.9 386.9Q797.4 382.1 786.4 378.1Q775.4 374.1 749.0 369.1Q722.6 364.1 721.8 365.3Q721.0 366.5 721.0 387.5Q721.0 408.5 722.1 415.4Q723.1 422.4 725.4 424.1Q727.6 425.9 739.0 427.0Q750.4 428.1 755.9 429.6Q761.4 431.1 768.2 434.8Q775.0 438.5 778.2 442.2Q781.5 446.0 783.2 449.8Q784.9 453.6 784.9 458.0Q784.9 462.4 782.4 466.9Q780.0 471.5 773.7 474.7Q767.4 477.9 760.4 477.9Q753.5 478.0 747.6 476.4Q741.6 474.9 732.3 469.7Q723.0 464.5 718.2 460.2Q713.5 456.0 708.0 449.0Q702.5 442.0 696.8 430.2Q691.1 418.4 689.1 410.4Q687.1 402.4 686.1 392.4Q685.0 382.5 686.1 364.6Q687.1 346.6 689.1 337.1Q691.1 327.6 693.2 323.4Q695.4 319.1 723.4 329.6ZM974.7 340.8Q975.9 343.6 976.9 352.6Q978.0 361.5 977.4 381.4Q976.9 401.4 972.9 416.4Q968.9 431.4 965.4 438.9Q961.9 446.4 956.7 454.2Q951.5 462.0 944.8 468.8Q938.0 475.5 928.2 481.7Q918.4 487.9 906.4 491.9Q894.4 495.9 886.4 496.9Q878.5 498.0 875.1 497.4Q871.6 496.9 873.4 491.8Q875.1 486.6 881.8 476.8Q888.5 467.0 895.2 460.8Q902.0 454.5 915.5 445.0Q929.0 435.5 935.2 429.8Q941.5 424.0 946.2 416.7Q950.9 409.4 952.4 402.4Q954.0 395.5 953.4 392.1Q952.9 388.6 951.2 385.3Q949.5 382.0 945.9 379.1Q942.4 376.1 936.9 374.6Q931.5 373.0 925.5 373.0Q919.5 373.0 912.6 374.6Q905.6 376.1 897.1 380.1Q888.6 384.1 882.8 388.3Q877.0 392.5 871.2 398.8Q865.5 405.0 862.8 409.8Q860.1 414.6 860.4 415.8Q860.6 416.9 864.5 417.4Q868.4 417.9 876.5 411.0Q884.6 404.1 891.1 401.6Q897.6 399.1 901.6 399.1Q905.5 399.0 908.2 400.2Q911.0 401.5 912.9 404.6Q914.9 407.6 914.9 410.0Q914.9 412.4 913.2 416.7Q911.5 421.0 908.2 424.8Q905.0 428.5 890.5 440.0Q876.0 451.5 867.2 461.2Q858.5 471.0 853.8 479.3Q849.1 487.6 842.5 504.5Q835.9 521.4 830.4 532.4Q824.9 543.4 818.2 554.2Q811.5 565.0 805.0 573.5Q798.5 582.0 788.2 592.2Q778.0 602.5 771.0 608.0Q764.0 613.5 744.7 624.7Q725.4 635.9 712.4 641.4Q699.4 646.9 685.4 651.4Q671.4 655.9 647.4 660.4Q623.5 665.0 602.5 666.0Q581.5 667.0 571.0 666.5Q560.5 666.0 546.1 663.9Q531.6 661.9 521.1 659.4Q510.6 656.9 501.8 653.7Q493.0 650.5 481.2 634.8Q469.5 619.0 450.1 603.1Q430.6 587.1 435.6 594.1Q440.5 601.0 456.0 618.0Q471.5 635.0 478.7 645.8Q485.9 656.6 498.5 683.5Q511.1 710.4 524.0 732.5Q536.9 754.6 537.9 760.5Q538.9 766.4 536.1 769.1Q533.4 771.9 527.5 771.4Q521.6 770.9 513.6 768.4Q505.6 765.9 489.6 758.4Q473.6 750.9 463.3 744.2Q453.0 737.5 444.0 730.0Q435.0 722.5 427.8 714.8Q420.5 707.0 414.5 699.0Q408.5 691.0 400.8 677.2Q393.1 663.4 386.1 643.4Q379.1 623.4 377.6 616.4Q376.0 609.5 374.9 597.6Q373.9 585.6 364.2 582.8Q354.6 579.9 346.3 575.7Q338.0 571.5 320.0 557.0Q302.0 542.5 293.2 536.8Q284.4 531.1 265.9 523.6Q247.4 516.1 225.9 511.6Q204.4 507.1 180.4 504.6Q156.5 502.0 124.5 500.5Q92.5 499.0 79.5 497.1Q66.5 495.2 66.3 496.3Q66.1 497.4 67.8 500.2Q69.5 503.0 72.8 505.8Q76.0 508.5 86.7 513.8Q97.4 519.1 109.2 527.3Q121.0 535.5 132.2 546.8Q143.5 558.0 158.0 575.5Q172.5 593.0 183.8 604.2Q195.0 615.5 206.0 623.5Q217.0 631.5 230.3 638.2Q243.6 644.9 257.6 649.4Q271.6 653.9 287.6 656.9Q303.5 660.0 318.0 661.0Q332.5 662.0 356.9 662.1Q381.4 662.1 380.9 663.0Q380.4 663.9 375.9 664.9Q371.4 665.9 358.9 667.4Q346.5 669.0 327.5 669.0Q308.5 669.0 293.1 666.9Q277.6 664.9 257.1 658.9Q236.6 652.9 227.1 648.4Q217.6 643.9 209.3 638.7Q201.0 633.5 186.2 620.8Q171.5 608.0 152.0 585.0Q132.5 562.0 120.2 549.8Q108.0 537.5 99.5 531.5Q91.0 525.5 81.5 520.5Q72.0 515.5 64.8 509.8Q57.5 504.0 54.8 500.2Q52.1 496.4 49.6 490.4Q47.1 484.4 47.1 481.0Q47.1 477.6 48.1 475.1Q49.1 472.6 50.9 470.9Q52.6 469.1 57.1 467.6Q61.5 466.0 76.0 467.0Q90.5 468.0 138.9 475.6Q187.4 483.1 215.9 489.6Q244.4 496.1 254.9 500.1Q265.4 504.1 275.7 509.8Q286.0 515.5 295.5 523.5Q305.0 531.5 317.5 544.5Q330.0 557.5 335.8 561.2Q341.6 564.9 350.6 568.4Q359.6 571.9 366.6 572.9Q373.5 574.0 376.4 573.6Q379.4 573.1 373.0 571.0Q366.6 568.9 354.3 562.2Q342.0 555.5 320.0 534.5Q298.0 513.5 284.2 505.3Q270.4 497.1 251.9 491.1Q233.4 485.1 210.4 480.6Q187.4 476.1 138.9 469.1Q90.5 462.0 78.5 461.0Q66.5 460.0 61.1 460.4Q55.6 460.9 54.8 459.2Q54.0 457.5 55.1 455.1Q56.1 452.6 61.4 447.4Q66.6 442.1 73.1 439.1Q79.6 436.1 89.6 433.6Q99.6 431.1 122.1 429.1Q144.5 427.0 181.5 422.0Q218.5 417.0 246.0 416.5Q273.5 416.0 298.0 418.0Q322.5 420.0 345.4 423.6Q368.4 427.1 395.9 433.6Q423.4 440.1 449.9 448.6Q476.4 457.1 507.0 469.0Q537.6 480.9 546.1 483.4Q554.6 485.9 566.1 486.4Q577.5 487.0 590.0 484.0Q602.5 481.0 612.9 481.1Q623.4 481.1 625.2 481.8Q627.0 482.5 628.5 484.5Q630.0 486.5 627.6 489.6Q625.1 492.6 625.3 495.3Q625.5 498.0 629.6 500.4Q633.6 502.9 640.6 504.9Q647.6 506.9 660.1 508.4Q672.5 510.0 697.0 509.5Q721.5 509.0 736.4 506.4Q751.4 503.9 769.9 497.4Q788.4 490.9 797.4 484.4Q806.5 478.0 809.2 472.2Q811.9 466.4 811.9 461.9Q812.0 457.5 810.9 453.1Q809.9 448.6 806.7 442.8Q803.5 437.0 798.8 432.2Q794.0 427.5 784.7 422.3Q775.4 417.1 768.9 415.1Q762.4 413.1 753.2 411.8Q744.1 410.4 743.9 398.2Q743.6 386.1 757.5 387.6Q771.4 389.1 778.9 391.1Q786.4 393.1 792.4 395.6Q798.4 398.1 804.2 401.8Q810.0 405.5 815.8 411.2Q821.5 417.0 824.2 421.8Q826.9 426.6 829.7 439.2Q832.5 451.8 834.8 441.2Q837.1 430.6 842.6 417.6Q848.1 404.6 854.8 395.3Q861.5 386.0 867.8 380.2Q874.0 374.5 882.8 368.8Q891.6 363.1 901.1 359.1Q910.6 355.1 942.1 346.6Q973.5 338.0 974.7 340.8ZM314.0 481.5Q312.0 482.5 311.1 484.1Q310.1 485.6 310.1 489.0Q310.1 492.4 312.4 494.6Q314.6 496.9 317.6 496.9Q320.5 497.0 323.0 495.5Q325.5 494.0 326.2 490.8Q326.9 487.6 324.9 484.6Q323.0 481.5 319.5 481.0Q316.0 480.5 314.0 481.5ZM132.9 523.1Q144.4 528.1 153.2 534.3Q162.0 540.5 192.0 571.0Q222.0 601.5 235.5 611.5Q249.0 621.5 266.3 629.7Q283.6 637.9 298.6 641.9Q313.6 645.9 327.5 647.5Q341.4 649.1 342.1 649.8Q342.8 650.5 342.1 650.8Q341.5 651.0 327.0 651.0Q312.5 651.0 302.6 649.4Q292.6 647.9 283.1 645.4Q273.6 642.9 258.8 636.2Q244.0 629.5 233.5 622.5Q223.0 615.5 216.0 609.5Q209.0 603.5 180.5 573.0Q152.0 542.5 145.0 536.5Q138.0 530.5 129.5 525.0Q121.0 519.5 121.2 518.8Q121.4 518.1 132.9 523.1ZM177.9 526.1Q189.4 531.1 196.2 535.8Q203.0 540.5 226.0 562.5Q249.0 584.5 265.3 596.2Q281.6 607.9 294.6 613.9Q307.6 619.9 323.6 624.4Q339.6 628.9 345.5 629.5Q351.4 630.1 352.6 630.8Q353.8 631.5 353.1 631.8Q352.5 632.0 341.5 632.0Q330.5 632.0 319.1 629.9Q307.6 627.9 297.1 624.4Q286.6 620.9 276.1 615.4Q265.6 609.9 250.8 598.2Q236.0 586.5 215.5 565.0Q195.0 543.5 186.5 536.5Q178.0 529.5 172.5 526.5Q167.0 523.5 166.1 522.5Q165.2 521.5 165.8 521.3Q166.4 521.1 177.9 526.1Z';

export function renderDashboardHtml(defaultToken = '') {
  const safeDefaultToken = JSON.stringify(String(defaultToken || ''));
  return `<!DOCTYPE html>
<html lang="vi" data-theme="ocean-light">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>WhaleBot — Tactical Coworker Mesh</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1024 1024'%3E%3Crect width='1024' height='1024' rx='220' fill='%23FFFFFF'/%3E%3Cpath fill='%231670ED' fill-rule='evenodd' d='${WHALE_52HZ_PATH_D}'/%3E%3C/svg%3E" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/lucide@0.460.0/dist/umd/lucide.min.js" defer></script>
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
    width: 42px;
    height: 42px;
    border-radius: 13px;
    background: #FFFFFF;
    border: 1.5px solid var(--border-strong);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 4px 12px var(--accent-soft);
    overflow: hidden;
  }
  .brand-logo svg {
    width: 38px;
    height: 38px;
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
    border: 1.5px solid var(--border-strong);
    background: #FFFFFF;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: #1670ED;
  }
  .avatar svg {
    width: 36px;
    height: 36px;
  }
  .avatar.sm {
    width: 34px;
    height: 34px;
  }
  .avatar.sm svg {
    width: 28px;
    height: 28px;
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
    width: 148px;
    height: 148px;
    margin: 0 auto 18px;
    border-radius: 50%;
    background: #FFFFFF;
    border: 2px solid var(--border-strong);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 0 10px var(--accent-soft), 0 12px 28px rgba(22, 112, 237, 0.22);
    overflow: hidden;
  }
  .hero-art svg {
    width: 132px;
    height: 132px;
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

  /* ===== Spec 08 Attention UI, Tool Chips, Approvals, Diff Viewer & Cmd+K ===== */
  .bucket-bar {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 12px 8px;
    flex-wrap: wrap;
  }
  .bucket-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--bg-pill);
    color: var(--text-secondary);
  }
  .bucket-pill.attention {
    background: rgba(217, 119, 6, 0.16);
    color: var(--warn);
  }
  .bucket-pill.working {
    background: rgba(2, 132, 199, 0.15);
    color: var(--accent);
  }
  .bucket-pill.done {
    background: rgba(22, 163, 74, 0.15);
    color: var(--ok);
  }

  .chat-item.unread .chat-item-name {
    font-weight: 800;
    color: var(--accent);
  }
  .chat-item.unread .chat-item-preview {
    font-weight: 700;
    color: var(--text-primary);
  }
  .chat-item.attention-row {
    background: rgba(217, 119, 6, 0.09);
    border: 1px solid rgba(217, 119, 6, 0.28);
  }
  .unread-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
    flex-shrink: 0;
  }
  .time-ago {
    font-size: 10.5px;
    font-weight: 600;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .kbd-hint {
    font-family: var(--font-mono);
    font-size: 10.5px;
    padding: 1px 5px;
    border-radius: 5px;
    border: 1px solid var(--border-strong);
    color: var(--text-muted);
    background: var(--bg-sidebar);
    flex-shrink: 0;
  }
  .icon-btn.active-toggle {
    color: var(--accent);
    background: var(--accent-soft);
  }

  /* Smart autoscroll jump pill */
  .jump-latest-btn {
    position: sticky;
    bottom: 8px;
    align-self: center;
    display: none;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 999px;
    border: 1px solid var(--accent);
    background: var(--bg-card);
    color: var(--accent);
    font-size: 12px;
    font-weight: 700;
    box-shadow: var(--shadow-md);
    cursor: pointer;
    z-index: 20;
  }
  .jump-latest-btn.visible {
    display: inline-flex;
  }

  /* Collapsible Tool-Call Chips (OpenMuse) */
  .tool-chip {
    margin-top: 6px;
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    background: var(--bg-card);
    color: var(--text-primary);
    font-size: 12px;
    overflow: hidden;
  }
  .tool-chip summary {
    padding: 6px 10px;
    cursor: pointer;
    font-weight: 700;
    font-family: var(--font-mono);
    display: flex;
    align-items: center;
    gap: 6px;
    user-select: none;
    background: var(--bg-pill);
  }
  .tool-chip pre {
    margin: 0;
    padding: 8px 10px;
    font-family: var(--font-mono);
    font-size: 11.5px;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 180px;
    overflow-y: auto;
  }

  /* Markdown inside bubbles */
  .msg-bubble code {
    font-family: var(--font-mono);
    font-size: 12.5px;
    padding: 1px 5px;
    border-radius: 5px;
    background: rgba(15, 23, 42, 0.08);
  }
  .msg-row.out .msg-bubble code {
    background: rgba(255, 255, 255, 0.18);
  }
  .msg-bubble pre {
    margin: 6px 0;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(15, 23, 42, 0.08);
    overflow-x: auto;
    font-family: var(--font-mono);
    font-size: 12px;
  }

  /* Inline HITL Approval Card (OpenMuse actions.ts) */
  .approval-card {
    align-self: stretch;
    border: 1.5px solid rgba(217, 119, 6, 0.45);
    background: rgba(217, 119, 6, 0.07);
    border-radius: 14px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .approval-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-weight: 800;
    font-size: 13px;
    color: var(--warn);
  }
  .approval-cmd {
    font-family: var(--font-mono);
    font-size: 12px;
    padding: 6px 10px;
    border-radius: 8px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    color: var(--text-primary);
    overflow-x: auto;
  }
  .approval-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .btn-approve {
    padding: 6px 12px;
    border-radius: 8px;
    border: none;
    background: var(--ok);
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }
  .btn-deny {
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid var(--err);
    background: transparent;
    color: var(--err);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  /* Removable Follow-Up Queue Bar (OpenMuse conversation-queue) */
  .queue-bar {
    display: none;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    padding: 4px 2px;
    font-size: 11.5px;
  }
  .queue-bar.visible {
    display: flex;
  }
  .queue-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 9px;
    border-radius: 999px;
    background: var(--bg-pill);
    border: 1px solid var(--border-strong);
    font-size: 11.5px;
    max-width: 280px;
  }
  .queue-chip span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .queue-chip button {
    border: none;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font-weight: 800;
    line-height: 1;
  }

  /* Diff Review Modal (Orca diff-comments) */
  .modal.modal-wide {
    max-width: 860px;
  }
  .diff-box {
    font-family: var(--font-mono);
    font-size: 12px;
    background: var(--bg-main);
    border: 1px solid var(--border);
    border-radius: 10px;
    max-height: 360px;
    overflow: auto;
  }
  .diff-line {
    display: flex;
    gap: 8px;
    padding: 1px 10px;
    white-space: pre;
    cursor: pointer;
    border-bottom: 1px solid transparent;
  }
  .diff-line:hover {
    background: var(--bg-hover);
  }
  .diff-line.add {
    background: rgba(22, 163, 74, 0.12);
    color: var(--ok);
  }
  .diff-line.del {
    background: rgba(220, 38, 38, 0.12);
    color: var(--err);
  }
  .diff-line.hunk {
    background: var(--bg-pill);
    color: var(--accent);
    font-weight: 700;
  }
  .diff-num {
    width: 38px;
    color: var(--text-muted);
    text-align: right;
    user-select: none;
    flex-shrink: 0;
  }
  .diff-comment-pill {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 8px;
    background: var(--bg-pill);
    font-size: 12px;
    margin-top: 4px;
  }

  /* Ctrl+K Quick Switcher Palette (Orca cmd-j) */
  .cmdk-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 300px;
    overflow-y: auto;
  }
  .cmdk-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 9px 12px;
    border-radius: 10px;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    font-size: 13px;
  }
  .cmdk-item:hover, .cmdk-item.selected {
    background: var(--bg-active);
    color: var(--accent);
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
          <div class="brand-logo" title="WhaleBot 52Hz">
            <svg viewBox="20 180 984 720" xmlns="http://www.w3.org/2000/svg" aria-label="WhaleBot 52Hz Logo">
              <path fill="#1670ED" fill-rule="evenodd" d="${WHALE_52HZ_PATH_D}"/>
            </svg>
          </div>
          <div class="brand-text">
            <div class="brand-name">WhaleBot</div>
            <div class="brand-sub">Multi-Agent Chat</div>
          </div>
        </div>

        <div class="brand-actions">
          <button class="icon-btn" id="notifToggleBtn" onclick="toggleNotifications()" title="Bật/tắt thông báo trình duyệt">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </button>
          <button class="icon-btn" onclick="openCmdPalette()" title="Chuyển nhanh (Ctrl+K)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/></svg>
          </button>
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
          <span class="kbd-hint" onclick="openCmdPalette()" style="cursor:pointer;" title="Mở bảng lệnh nhanh">Ctrl+K</span>
        </div>
      </div>

      <div class="bucket-bar" id="bucketSummaryBar"></div>

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
          <span class="avatar sm" id="headerAvatar" style="background:#FFFFFF;"></span>
          <div class="header-info">
            <div class="header-title-row">
              <span class="header-title" id="headerTitle">Nhóm WhaleBot</span>
              <span class="role-tag" id="headerRoleTag">Nhóm</span>
            </div>
            <div class="header-sub" id="headerSubtitle">Kênh phối hợp chung · #mesh-command-room</div>
          </div>
        </div>

        <div class="header-actions">
          <button class="pill-btn" onclick="openDiffModal(currentChannel === 'all' ? 'coder' : currentChannel)" title="Xem git diff, thêm góp ý theo dòng & gộp nhánh">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>
            <span>Xem diff & Gộp</span>
          </button>
          <button class="icon-btn" onclick="clearCurrentView()" title="Xóa lịch sử hiển thị">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      </header>

      <section class="chat-stream" id="chatStream" onscroll="onStreamScroll()"></section>
      <button class="jump-latest-btn" id="jumpLatestBtn" onclick="jumpToLatest()">↓ Tin nhắn mới nhất</button>

      <footer class="composer">
        <div class="queue-bar" id="composerQueueBar"></div>
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
        <div class="modal-card">
          <h4>Thư viện kinh nghiệm (Harness² Experience Library)</h4>
          <div id="experienceListBox" style="font-size:12.5px;color:var(--text-secondary);white-space:pre-wrap;">Chưa có bài học nào được lưu.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- MODAL: DIFF REVIEW & LINE COMMENTS (Spec 08 C4 / Orca) -->
  <div class="modal-backdrop" id="diffModal" onclick="if(event.target===this)closeTelemetry()">
    <div class="modal modal-wide" role="dialog" aria-modal="true" aria-label="Xem diff và gộp nhánh">
      <div class="modal-head">
        <span id="diffModalTitle">Xem diff trước khi gộp nhánh</span>
        <button class="icon-btn" onclick="closeTelemetry()">✕</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12.5px;color:var(--text-secondary);">
          <span id="diffStatSummary">Đang tải diff...</span>
          <span>💡 Bấm vào một dòng code để gắn nhận xét gửi lại cho đồng sự</span>
        </div>
        <div class="diff-box" id="diffLinesBox"></div>
        <div id="diffCommentsBox"></div>
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;">
          <button class="pill-btn" id="sendDiffCommentsBtn" onclick="submitDiffComments()" style="display:none;">Gửi góp ý cho đồng sự</button>
          <button class="primary-btn" onclick="confirmMergeFromModal()">Kiểm thử & Gộp vào nhánh chính</button>
        </div>
      </div>
    </div>
  </div>

  <!-- MODAL: CTRL+K QUICK SWITCHER PALETTE (Spec 08 E5 / Orca cmd-j) -->
  <div class="modal-backdrop" id="cmdkModal" onclick="if(event.target===this)closeTelemetry()">
    <div class="modal" role="dialog" aria-modal="true" aria-label="Bảng điều khiển nhanh">
      <div class="modal-head">
        <span>Chuyển nhanh · Ctrl+K</span>
        <button class="icon-btn" onclick="closeTelemetry()">✕</button>
      </div>
      <div class="modal-body">
        <input
          id="cmdkInput"
          class="form-input"
          type="text"
          placeholder="Tìm đồng sự hoặc lệnh (Gộp nhánh, Dừng tất cả, Đổi giao diện...)"
          oninput="renderCmdkList()"
          onkeydown="onCmdkKeydown(event)"
        />
        <div class="cmdk-list" id="cmdkList"></div>
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
  // ===== 52Hz Baleen Whale Mascot (Smooth Vector SVG with negative-space 52 tail flukes) =====
  const WHALE_52HZ_D = '${WHALE_52HZ_PATH_D}';
  function whaleSvg(opts) {
    opts = opts || {};
    const fill = opts.fill || '#1670ED';
    return '<svg viewBox="20 180 984 720" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path fill="' + fill + '" fill-rule="evenodd" d="' + WHALE_52HZ_D + '"/>' +
      '</svg>';
  }

  // Exact 52Hz Whale (#1670ED on white) for avatars and welcome hero
  const WHALE_MARK = whaleSvg({ fill: '#1670ED' });
  const WHALE_HERO = whaleSvg({ fill: '#1670ED' });

  const ICONS = {
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>'
  };

  const PERSONAS = {
    all: {
      title: 'Nhóm WhaleBot',
      tag: 'Nhóm',
      grad: '#FFFFFF',
      sub: 'Kênh phối hợp chung · #mesh-command-room'
    },
    lead: {
      title: '@lead · Trưởng nhóm',
      tag: 'Lead',
      grad: '#FFFFFF',
      sub: 'Điều phối & phân công công việc'
    },
    coder: {
      title: '@coder · Lập trình viên',
      tag: 'Writer',
      grad: '#FFFFFF',
      sub: 'Viết code & kiểm thử trong Git Worktree riêng'
    },
    reviewer: {
      title: '@reviewer · Kiểm duyệt',
      tag: 'QA',
      grad: '#FFFFFF',
      sub: 'Review code & đảm bảo chất lượng'
    }
  };

  function getPersona(id) {
    if (PERSONAS[id]) return PERSONAS[id];
    return {
      title: '@' + id,
      tag: 'Đồng sự',
      grad: '#FFFFFF',
      sub: 'Chuyên gia đồng hành'
    };
  }

  let authToken = ${safeDefaultToken};
  if (location.hash.startsWith('#k=')) {
    authToken = location.hash.slice(3);
  }

  let agentsState = [
    {
      id: 'lead',
      name: 'Team Lead (Orchestrator)',
      role: 'reader',
      preferredCore: 'auto',
      status: 'idle',
      description: 'Điều phối & phân công công việc'
    },
    {
      id: 'coder',
      name: 'Senior Implementation Engineer',
      role: 'writer',
      preferredCore: 'auto',
      status: 'idle',
      description: 'Viết code & kiểm thử trong Git Worktree riêng'
    },
    {
      id: 'reviewer',
      name: 'Adversarial Reviewer & QA',
      role: 'reader',
      preferredCore: 'auto',
      status: 'idle',
      description: 'Review code & đảm bảo chất lượng'
    }
  ];
  let approvalsState = [];
  let feedItems = [];
  let currentChannel = 'all';
  let currentVerifyCmd = 'python -m unittest discover -s tests -p "test_*.py" -v; python scripts/query_engine.py --test; python scripts/evaluate.py --check';
  let sseSource = null;
  let sseState = 'CONNECTING';
  let lastStateOkTs = 0;
  let stickToBottom = true;
  let unseenCountOnScroll = 0;
  let lastSeenMap = {};
  let notifEnabled = false;
  const notifCooldownMap = new Map();
  let diffTargetAgent = 'coder';
  let diffComments = [];
  let cmdkItems = [];
  let cmdkIndex = 0;

  try {
    lastSeenMap = JSON.parse(localStorage.getItem('botautotask-last-seen') || '{}') || {};
    notifEnabled = localStorage.getItem('botautotask-notif') === '1';
  } catch {}

  function saveLastSeen(agentId) {
    if (!agentId || agentId === 'all') return;
    lastSeenMap[agentId] = Date.now();
    try { localStorage.setItem('botautotask-last-seen', JSON.stringify(lastSeenMap)); } catch {}
  }

  function formatAgo(ms) {
    if (!ms) return '';
    const sec = Math.max(1, Math.floor((Date.now() - ms) / 1000));
    if (sec < 60) return sec + 's';
    const min = Math.floor(sec / 60);
    if (min < 60) return min + 'm';
    const hr = Math.floor(min / 60);
    return hr + 'h';
  }

  function getAgentBucket(a) {
    const hasPendingApproval = approvalsState.some((ap) => ap.status === 'pending' && ap.callerId === a.id);
    if (hasPendingApproval || a.status === 'error') return 'attention';
    if (a.status === 'running') return 'working';
    const seen = lastSeenMap[a.id] || 0;
    if (a.finishedAtMs && a.finishedAtMs > seen && currentChannel !== a.id) return 'done';
    return 'idle';
  }

  function maybeNotify(key, title, body) {
    if (!notifEnabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (typeof document.hasFocus === 'function' && document.hasFocus()) return;
    const now = Date.now();
    const prev = notifCooldownMap.get(key) || 0;
    if (now - prev < 5000) return;
    notifCooldownMap.set(key, now);
    if (notifCooldownMap.size > 50) {
      const oldest = notifCooldownMap.keys().next().value;
      notifCooldownMap.delete(oldest);
    }
    try { new Notification(title, { body, tag: key }); } catch {}
  }

  async function toggleNotifications() {
    if (typeof Notification === 'undefined') return;
    if (!notifEnabled) {
      const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      notifEnabled = perm === 'granted';
    } else {
      notifEnabled = false;
    }
    try { localStorage.setItem('botautotask-notif', notifEnabled ? '1' : '0'); } catch {}
    syncNotifBtn();
  }

  function syncNotifBtn() {
    const btn = document.getElementById('notifToggleBtn');
    if (btn) btn.classList.toggle('active-toggle', notifEnabled);
  }

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
            if (!stickToBottom) unseenCountOnScroll++;
            renderStream();
            renderRoster();
          }
        } else if (frame.family === 'agent_status') {
          if (p.status === 'idle' || p.status === 'error') {
            const per = getPersona(p.agentId || 'coder');
            maybeNotify(
              (p.agentId || 'agent') + ':' + p.status,
              p.status === 'error' ? ('⚠️ ' + per.title + ' gặp lỗi') : ('✅ ' + per.title + ' đã hoàn thành'),
              'Bấm để mở WhaleBot và kiểm tra kết quả.'
            );
          }
        } else if (frame.family === 'approval_request' && p.approval) {
          maybeNotify(
            'appr:' + p.approval.id,
            '🔔 Cần duyệt: @' + p.approval.callerId,
            p.approval.action + ' — chờ bạn phê duyệt'
          );
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
      approvalsState = Array.isArray(data.approvals) ? data.approvals : [];

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
      renderQueueBar();
      renderRuntimeModal(data);
    } catch {}
  }

  function renderRoster() {
    const q = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
    const groupEl = document.getElementById('groupRoster');
    const coworkerEl = document.getElementById('coworkerRoster');
    const countEl = document.getElementById('podCountLabel');
    const bucketBar = document.getElementById('bucketSummaryBar');
    if (!groupEl || !coworkerEl) return;
    if (countEl) countEl.textContent = agentsState.length + ' thành viên';

    const counts = { attention: 0, working: 0, done: 0, idle: 0 };
    for (const a of agentsState) {
      counts[getAgentBucket(a)]++;
    }

    const badgeTotal = counts.attention + counts.done;
    document.title = (badgeTotal > 0 ? '(' + badgeTotal + ') ' : '') + 'WhaleBot — Tactical Coworker Mesh';

    if (bucketBar) {
      const pills = [];
      if (counts.attention > 0) pills.push('<span class="bucket-pill attention">⚠️ ' + counts.attention + ' cần chú ý</span>');
      if (counts.working > 0) pills.push('<span class="bucket-pill working">⚡ ' + counts.working + ' đang chạy</span>');
      if (counts.done > 0) pills.push('<span class="bucket-pill done">● ' + counts.done + ' mới xong</span>');
      if (pills.length === 0) pills.push('<span class="bucket-pill">🌊 Đội ngũ sẵn sàng</span>');
      bucketBar.innerHTML = pills.join('');
    }

    const runningCount = counts.working;
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

    const bucketOrder = { attention: 0, working: 1, done: 2, idle: 3 };
    const filtered = agentsState
      .filter((a) => {
        if (!q) return true;
        const p = getPersona(a.id);
        return (
          a.id.toLowerCase().includes(q) ||
          p.title.toLowerCase().includes(q) ||
          (a.name || '').toLowerCase().includes(q) ||
          (a.description || '').toLowerCase().includes(q)
        );
      })
      .slice()
      .sort((a, b) => {
        const ba = bucketOrder[getAgentBucket(a)] ?? 3;
        const bb = bucketOrder[getAgentBucket(b)] ?? 3;
        if (ba !== bb) return ba - bb;
        return String(a.id).localeCompare(String(b.id));
      });

    coworkerEl.innerHTML = filtered.map((a) => {
      const p = getPersona(a.id);
      const bucket = getAgentBucket(a);
      const isRunning = a.status === 'running';
      const isQueued = (a.inboxCount || 0) > 0 || (a.pendingSteers || 0) > 0;
      const dotCls = isRunning ? 'working' : (a.status === 'error' ? 'error' : (isQueued ? 'queued' : 'online'));
      const doingText = a.doing || (a.recentActivity || []).slice(-1)[0] || a.description || p.sub;
      let preview = doingText;
      let rightMeta = '<span class="role-tag">' + escapeHtml(p.tag) + '</span>';

      if (bucket === 'attention') {
        preview = a.status === 'error' ? ('⚠️ Lỗi · ' + doingText) : '🔔 Cần bạn phê duyệt';
        rightMeta = '<span class="bucket-pill attention">Duyệt</span>';
      } else if (isRunning) {
        const el = a.elapsedMs ? (' · ' + formatAgo(Date.now() - a.elapsedMs)) : '';
        preview = 'Đang làm: ' + doingText + el;
      } else if (bucket === 'done' && a.finishedAtMs) {
        preview = '✓ Xong ' + formatAgo(a.finishedAtMs) + ' trước · ' + doingText;
        rightMeta = '<span class="unread-dot" title="Mới hoàn thành"></span>';
      } else if (a.finishedAtMs) {
        rightMeta = '<span class="time-ago">' + formatAgo(a.finishedAtMs) + '</span>';
      }

      const rowCls = [
        'chat-item',
        currentChannel === a.id ? 'active' : '',
        bucket === 'done' ? 'unread' : '',
        bucket === 'attention' ? 'attention-row' : ''
      ].filter(Boolean).join(' ');

      return \`
        <button class="\${rowCls}" onclick="selectChannel('\${escapeHtml(a.id)}')">
          <span class="avatar" style="background:\${p.grad}">
            \${WHALE_MARK}
            <i class="status-dot \${dotCls}"></i>
          </span>
          <span class="chat-item-main">
            <span class="chat-item-top">
              <span class="chat-item-name">\${escapeHtml(p.title)}</span>
              \${rightMeta}
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

  function onStreamScroll() {
    const stream = document.getElementById('chatStream');
    if (!stream) return;
    const dist = stream.scrollHeight - stream.scrollTop - stream.clientHeight;
    stickToBottom = dist < 80;
    if (stickToBottom) {
      unseenCountOnScroll = 0;
      const btn = document.getElementById('jumpLatestBtn');
      if (btn) btn.classList.remove('visible');
    }
  }

  function jumpToLatest() {
    const stream = document.getElementById('chatStream');
    if (!stream) return;
    stickToBottom = true;
    unseenCountOnScroll = 0;
    stream.scrollTop = stream.scrollHeight;
    const btn = document.getElementById('jumpLatestBtn');
    if (btn) btn.classList.remove('visible');
  }

  function formatBubbleContent(rawText) {
    const str = String(rawText || '');
    const toolChips = [];
    const cleaned = str.replace(/\\[Tool\\s+([A-Za-z0-9_]+)\\s*->\\s*([\\s\\S]*?)\\]/g, (_, toolName, jsonText) => {
      toolChips.push({ name: toolName, payload: jsonText.trim() });
      return '';
    }).trim();

    let bodyHtml = escapeHtml(cleaned);
    try {
      if (window.marked && typeof window.marked.parse === 'function' && cleaned) {
        // Parse safe escaped text so raw HTML in agent output cannot execute
        bodyHtml = window.marked.parse(bodyHtml, { breaks: true });
      }
    } catch {}

    const chipsHtml = toolChips.map((tc) => \`
      <details class="tool-chip">
        <summary>🔧 \${escapeHtml(tc.name)} · kết quả tool</summary>
        <pre>\${escapeHtml(tc.payload)}</pre>
      </details>
    \`).join('');

    return (bodyHtml || '') + chipsHtml;
  }

  function renderApprovalCardsHtml() {
    const visibleApprovals = approvalsState.filter((ap) => {
      if (currentChannel === 'all') return true;
      return ap.callerId === currentChannel;
    });
    if (visibleApprovals.length === 0) return '';

    return visibleApprovals.map((ap) => {
      const isPending = ap.status === 'pending';
      const cmdPreview = ap.args ? JSON.stringify(ap.args) : ap.action;
      const statusBadge = isPending
        ? '⏳ Đang chờ bạn duyệt'
        : (ap.status === 'succeeded' ? '✅ Đã duyệt & thực thi' : (ap.status === 'denied' ? '🚫 Đã từ chối' : ('ℹ️ ' + ap.status)));
      return \`
        <div class="approval-card" data-approval-id="\${escapeHtml(ap.id)}">
          <div class="approval-head">
            <span>🛡️ Yêu cầu phê duyệt từ @\${escapeHtml(ap.callerId || 'agent')} · \${escapeHtml(ap.action)}</span>
            <span>\${statusBadge}</span>
          </div>
          <div class="approval-cmd">\${escapeHtml(cmdPreview)}</div>
          \${isPending ? \`
            <div class="approval-actions">
              <button class="pill-btn" onclick="openDiffModal('\${escapeHtml(ap.callerId || 'coder')}')">🔍 Xem diff</button>
              <button class="btn-approve" onclick="decideApprovalClick('\${escapeHtml(ap.id)}', '\${escapeHtml(ap.hash || '')}', 'approve')">✓ Phê duyệt</button>
              <button class="btn-deny" onclick="decideApprovalClick('\${escapeHtml(ap.id)}', '\${escapeHtml(ap.hash || '')}', 'deny')">✕ Từ chối</button>
            </div>
          \` : ''}
        </div>
      \`;
    }).join('');
  }

  async function decideApprovalClick(id, hash, decision) {
    const note = decision === 'deny' ? (prompt('Lý do từ chối (gửi cho đồng sự):', '') || '') : '';
    await apiFetch('/api/approvals/' + encodeURIComponent(id), {
      method: 'POST',
      body: JSON.stringify({
        nonce: 'appr-' + Date.now() + '-' + id,
        decision,
        hash,
        note
      })
    });
    refreshState();
  }

  function renderQueueBar() {
    const bar = document.getElementById('composerQueueBar');
    if (!bar) return;
    const items = [];
    for (const a of agentsState) {
      if (currentChannel !== 'all' && a.id !== currentChannel) continue;
      const list = Array.isArray(a.inboxPreview) ? a.inboxPreview : [];
      for (const it of list) {
        items.push({ agentId: a.id, index: it.index, message: it.message });
      }
    }
    if (items.length === 0) {
      bar.classList.remove('visible');
      bar.innerHTML = '';
      return;
    }
    bar.classList.add('visible');
    bar.innerHTML = '<strong style="color:var(--text-secondary);">Hàng đợi (' + items.length + '):</strong>' +
      items.map((it) => \`
        <span class="queue-chip">
          <span>@\${escapeHtml(it.agentId)}: \${escapeHtml(it.message)}</span>
          <button onclick="removeQueuedItem('\${escapeHtml(it.agentId)}', \${Number(it.index)})" title="Xoá khỏi hàng đợi">✕</button>
        </span>
      \`).join('');
  }

  async function removeQueuedItem(agentId, index) {
    await apiFetch('/api/agents/' + encodeURIComponent(agentId) + '/inbox/remove', {
      method: 'POST',
      body: JSON.stringify({ nonce: 'rmq-' + Date.now(), index })
    });
    refreshState();
  }

  function renderStream() {
    const stream = document.getElementById('chatStream');
    if (!stream) return;
    const msgs = getVisibleMessages();
    const approvalsHtml = renderApprovalCardsHtml();

    const runningAgents = currentChannel === 'all'
      ? agentsState.filter((a) => a.status === 'running')
      : agentsState.filter((a) => a.id === currentChannel && a.status === 'running');

    if (msgs.length === 0 && runningAgents.length === 0 && !approvalsHtml) {
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
            <div class="msg-bubble \${m.priority ? 'priority' : ''}">\${formatBubbleContent(m.text)}</div>
          </div>
        </div>
      \`;
    }

    html += approvalsHtml;

    for (const a of runningAgents) {
      const p = getPersona(a.id);
      const lastAct = a.doing || (a.recentActivity || []).slice(-1)[0] || 'Đang xử lý...';
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
    if (stickToBottom) {
      stream.scrollTop = stream.scrollHeight;
    } else {
      const btn = document.getElementById('jumpLatestBtn');
      if (btn) {
        btn.textContent = unseenCountOnScroll > 0 ? ('↓ ' + unseenCountOnScroll + ' tin nhắn mới') : '↓ Tin nhắn mới nhất';
        btn.classList.add('visible');
      }
    }
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
    saveLastSeen(ch);
    stickToBottom = true;
    unseenCountOnScroll = 0;
    document.getElementById('sidebar')?.classList.remove('mobile-open');
    renderRoster();
    renderHeader();
    renderQueueBar();
    renderStream();
  }

  async function loadExperienceModal() {
    try {
      const res = await apiFetch('/api/experience?domain=general');
      if (!res.ok) return;
      const data = await res.json();
      const box = document.getElementById('experienceListBox');
      if (!box) return;
      if (!Array.isArray(data.entries) || data.entries.length === 0) {
        box.textContent = 'Chưa có bài học nào trong .botautotask/library/general.';
        return;
      }
      box.textContent = data.entries.slice(0, 6).join('\\n---\\n');
    } catch {}
  }

  async function openDiffModal(agentId) {
    diffTargetAgent = (!agentId || agentId === 'all') ? 'coder' : agentId;
    diffComments = [];
    openModal('diffModal');
    const titleEl = document.getElementById('diffModalTitle');
    const statEl = document.getElementById('diffStatSummary');
    const boxEl = document.getElementById('diffLinesBox');
    if (titleEl) titleEl.textContent = 'Xem diff & Gộp nhánh · @' + diffTargetAgent;
    if (statEl) statEl.textContent = 'Đang tải git diff...';
    if (boxEl) boxEl.innerHTML = '';
    renderDiffComments();

    try {
      const res = await apiFetch('/api/agents/' + encodeURIComponent(diffTargetAgent) + '/diff');
      if (!res.ok) {
        if (statEl) statEl.textContent = 'Không tải được diff.';
        return;
      }
      const data = await res.json();
      if (statEl) {
        statEl.textContent = (data.branch ? ('Nhánh: ' + data.branch + ' · ') : '') +
          (data.stat || (data.diff ? 'Có thay đổi' : 'Không có khác biệt so với HEAD'));
      }
      const raw = String(data.diff || '');
      if (!raw.trim()) {
        if (boxEl) boxEl.innerHTML = '<div style="padding:14px;color:var(--text-secondary);">Nhánh sạch, chưa có thay đổi nào cần gộp.</div>';
        return;
      }
      let currentFile = 'worktree';
      let lineNo = 0;
      const lines = raw.split(/\\r?\\n/);
      if (boxEl) {
        boxEl.innerHTML = lines.map((line) => {
          lineNo++;
          if (line.startsWith('+++ b/')) currentFile = line.slice(6).trim();
          let cls = 'diff-line';
          if (line.startsWith('+') && !line.startsWith('+++')) cls += ' add';
          else if (line.startsWith('-') && !line.startsWith('---')) cls += ' del';
          else if (line.startsWith('@@')) cls += ' hunk';
          return \`<div class="\${cls}" onclick="addDiffLineComment('\${escapeHtml(currentFile)}', \${lineNo})"><span class="diff-num">\${lineNo}</span><span>\${escapeHtml(line)}</span></div>\`;
        }).join('');
      }
    } catch {
      if (statEl) statEl.textContent = 'Lỗi khi đọc diff.';
    }
  }

  function addDiffLineComment(file, line) {
    const comment = prompt('Nhận xét cho ' + file + ' (dòng ' + line + '):', '');
    if (!comment || !comment.trim()) return;
    diffComments.push({ file, line, comment: comment.trim() });
    renderDiffComments();
  }

  function removeDiffComment(idx) {
    diffComments.splice(idx, 1);
    renderDiffComments();
  }

  function renderDiffComments() {
    const box = document.getElementById('diffCommentsBox');
    const sendBtn = document.getElementById('sendDiffCommentsBtn');
    if (sendBtn) sendBtn.style.display = diffComments.length > 0 ? 'inline-flex' : 'none';
    if (!box) return;
    if (diffComments.length === 0) {
      box.innerHTML = '';
      return;
    }
    box.innerHTML = diffComments.map((c, idx) => \`
      <div class="diff-comment-pill">
        <span><strong>\${escapeHtml(c.file)}:\${c.line}</strong> — "\${escapeHtml(c.comment)}"</span>
        <button class="icon-btn" onclick="removeDiffComment(\${idx})" title="Xoá">✕</button>
      </div>
    \`).join('');
  }

  function formatDiffCommentsForAgent(comments) {
    return 'Review comments on your branch:\\n' + comments.map((c) =>
      \`File: \${c.file}\\nLines: \${c.line}\\nUser comment: "\${c.comment}"\`
    ).join('\\n\\n');
  }

  async function submitDiffComments() {
    if (diffComments.length === 0) return;
    const formatted = formatDiffCommentsForAgent(diffComments);
    await apiFetch('/api/agents/' + encodeURIComponent(diffTargetAgent) + '/message', {
      method: 'POST',
      body: JSON.stringify({
        nonce: 'diffc-' + Date.now(),
        text: formatted,
        delivery: 'send',
        wait: true
      })
    });
    diffComments = [];
    closeTelemetry();
    selectChannel(diffTargetAgent);
    refreshState();
  }

  async function confirmMergeFromModal() {
    const target = diffTargetAgent || 'coder';
    closeTelemetry();
    await mergeAgentWorktree(target);
  }

  function openCmdPalette() {
    openModal('cmdkModal');
    const inp = document.getElementById('cmdkInput');
    if (inp) {
      inp.value = '';
      cmdkIndex = 0;
      renderCmdkList();
      setTimeout(() => inp.focus(), 20);
    }
  }

  function getCmdkCatalog() {
    const list = [
      { label: '🌊 Kênh chung Nhóm WhaleBot', sub: 'Alt+1', run: () => selectChannel('all') },
      ...agentsState.map((a, idx) => ({
        label: '🐋 Chuyển tới ' + getPersona(a.id).title,
        sub: 'Alt+' + (idx + 2) + ' · ' + a.status,
        run: () => selectChannel(a.id)
      })),
      { label: '🔍 Xem diff & Gộp nhánh (@coder)', sub: 'Diff Review', run: () => openDiffModal(currentChannel === 'all' ? 'coder' : currentChannel) },
      { label: '➕ Thêm đồng sự mới', sub: 'Spawn', run: () => openModal('spawnModal') },
      { label: '🌓 Đổi giao diện Sáng / Tối', sub: 'Theme', run: () => toggleOceanTheme() },
      { label: '🔔 Bật / tắt thông báo trình duyệt', sub: 'Notifications', run: () => toggleNotifications() },
      { label: '⚙️ Cài đặt & Thư viện kinh nghiệm', sub: 'Runtime', run: () => { openModal('runtimeModal'); loadExperienceModal(); } },
      { label: '🛑 Dừng khẩn cấp tất cả đồng sự', sub: 'Stop All', run: () => apiFetch('/api/agents/stop-all', { method: 'POST', body: JSON.stringify({ confirm: true }) }).then(refreshState) }
    ];
    return list;
  }

  function renderCmdkList() {
    const q = (document.getElementById('cmdkInput')?.value || '').trim().toLowerCase();
    const box = document.getElementById('cmdkList');
    if (!box) return;
    cmdkItems = getCmdkCatalog().filter((it) => !q || it.label.toLowerCase().includes(q) || (it.sub || '').toLowerCase().includes(q));
    if (cmdkIndex >= cmdkItems.length) cmdkIndex = 0;
    box.innerHTML = cmdkItems.map((it, idx) => \`
      <button class="cmdk-item \${idx === cmdkIndex ? 'selected' : ''}" onclick="runCmdkItem(\${idx})">
        <span><strong>\${escapeHtml(it.label)}</strong></span>
        <span class="kbd-hint">\${escapeHtml(it.sub || '')}</span>
      </button>
    \`).join('');
  }

  function runCmdkItem(idx) {
    const item = cmdkItems[idx];
    closeTelemetry();
    if (item && typeof item.run === 'function') item.run();
  }

  function onCmdkKeydown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      cmdkIndex = (cmdkIndex + 1) % Math.max(1, cmdkItems.length);
      renderCmdkList();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      cmdkIndex = (cmdkIndex - 1 + Math.max(1, cmdkItems.length)) % Math.max(1, cmdkItems.length);
      renderCmdkList();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runCmdkItem(cmdkIndex);
    } else if (e.key === 'Escape') {
      closeTelemetry();
    }
  }

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCmdPalette();
    } else if (e.key === 'Escape') {
      closeTelemetry();
    } else if (e.altKey && /^[1-9]$/.test(e.key)) {
      e.preventDefault();
      const n = parseInt(e.key, 10);
      if (n === 1) selectChannel('all');
      else if (agentsState[n - 2]) selectChannel(agentsState[n - 2].id);
    }
  });

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
    if (id === 'runtimeModal') loadExperienceModal();
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
          wait: delivery !== 'queue'
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

  renderRoster();
  renderHeader();
  renderStream();
  syncNotifBtn();
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
