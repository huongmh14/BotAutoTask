/**
 * BotAutoTask — Cloud Control Plane (Cloudflare Worker + D1 SQLite 24/7).
 * Handles:
 * 1. Telegram Bot Webhook (/goal, /status, /switch, /mode, /pause, /resume, /cancel)
 * 2. Durable SQL Lease API for Local PC Daemon and GitHub Actions Cloud Worker
 * 3. Cron Trigger (every 2 minutes) to dispatch GitHub Actions when PC is powered off / offline
 */

export function parseTelegramCommand(text = '') {
  const raw = String(text || '').trim();
  const [firstToken, ...restTokens] = raw.split(/\s+/);
  const command = (firstToken || '').split('@')[0].toLowerCase();
  const flags = {};
  const argWords = [];

  for (let i = 0; i < restTokens.length; i++) {
    const token = restTokens[i];
    if (token.startsWith('--') && token.length > 2) {
      const key = token.slice(2);
      const val = restTokens[i + 1] && !restTokens[i + 1].startsWith('--') ? restTokens[++i] : 'true';
      flags[key] = val;
    } else {
      argWords.push(token);
    }
  }

  return {
    command,
    args: argWords.join(' ').trim(),
    flags
  };
}

/**
 * Determines if a goal's local lease has expired and should be handed over to GitHub Actions Cloud Worker.
 */
export function shouldTriggerCloudFallback(goal, nowMs = Date.now()) {
  if (!goal) return false;
  if (!['QUEUED', 'RUNNING_LOCAL'].includes(goal.status)) return false;
  if (!['auto', 'cloud'].includes(goal.execution_mode || 'auto')) return false;
  if (!goal.repo_url) return false;
  const expiresAt = Number(goal.lease_expires_at || 0);
  return expiresAt < nowMs;
}

/**
 * Constant-time bearer check. Hashing both sides first gives equal-length buffers, so the
 * comparison time does not leak the token length or a matching prefix.
 */
export async function isAuthorized(authHeader, expectedToken) {
  if (!expectedToken) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(authHeader || ''))),
    crypto.subtle.digest('SHA-256', enc.encode(`Bearer ${expectedToken}`))
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

async function sendTelegramMessage(env, text, chatId = env.TELEGRAM_ALLOWED_CHAT_ID) {
  if (!env.TELEGRAM_BOT_TOKEN || !chatId) return;
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown'
    })
  }).catch(() => {});
}

async function triggerGitHubActions(env, goal) {
  if (!env.GITHUB_PAT || !goal.repo_url) return false;
  const workflowFile = env.GITHUB_WORKFLOW_FILE || 'botautotask-worker.yml';
  const branch = goal.branch || 'main';
  const url = `https://api.github.com/repos/${goal.repo_url}/actions/workflows/${workflowFile}/dispatches`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_PAT}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'BotAutoTask-CloudCore'
    },
    body: JSON.stringify({
      ref: branch,
      inputs: {
        goal_id: goal.id
      }
    })
  });
  return res.ok;
}

const WHALE_52HZ_CLOUD_D = 'M723.4 329.6Q751.4 340.1 761.4 345.1Q771.4 350.1 780.2 356.3Q789.0 362.5 796.8 370.2Q804.5 378.0 808.7 383.8Q812.9 389.6 812.7 390.7Q812.5 391.8 804.9 386.9Q797.4 382.1 786.4 378.1Q775.4 374.1 749.0 369.1Q722.6 364.1 721.8 365.3Q721.0 366.5 721.0 387.5Q721.0 408.5 722.1 415.4Q723.1 422.4 725.4 424.1Q727.6 425.9 739.0 427.0Q750.4 428.1 755.9 429.6Q761.4 431.1 768.2 434.8Q775.0 438.5 778.2 442.2Q781.5 446.0 783.2 449.8Q784.9 453.6 784.9 458.0Q784.9 462.4 782.4 466.9Q780.0 471.5 773.7 474.7Q767.4 477.9 760.4 477.9Q753.5 478.0 747.6 476.4Q741.6 474.9 732.3 469.7Q723.0 464.5 718.2 460.2Q713.5 456.0 708.0 449.0Q702.5 442.0 696.8 430.2Q691.1 418.4 689.1 410.4Q687.1 402.4 686.1 392.4Q685.0 382.5 686.1 364.6Q687.1 346.6 689.1 337.1Q691.1 327.6 693.2 323.4Q695.4 319.1 723.4 329.6ZM974.7 340.8Q975.9 343.6 976.9 352.6Q978.0 361.5 977.4 381.4Q976.9 401.4 972.9 416.4Q968.9 431.4 965.4 438.9Q961.9 446.4 956.7 454.2Q951.5 462.0 944.8 468.8Q938.0 475.5 928.2 481.7Q918.4 487.9 906.4 491.9Q894.4 495.9 886.4 496.9Q878.5 498.0 875.1 497.4Q871.6 496.9 873.4 491.8Q875.1 486.6 881.8 476.8Q888.5 467.0 895.2 460.8Q902.0 454.5 915.5 445.0Q929.0 435.5 935.2 429.8Q941.5 424.0 946.2 416.7Q950.9 409.4 952.4 402.4Q954.0 395.5 953.4 392.1Q952.9 388.6 951.2 385.3Q949.5 382.0 945.9 379.1Q942.4 376.1 936.9 374.6Q931.5 373.0 925.5 373.0Q919.5 373.0 912.6 374.6Q905.6 376.1 897.1 380.1Q888.6 384.1 882.8 388.3Q877.0 392.5 871.2 398.8Q865.5 405.0 862.8 409.8Q860.1 414.6 860.4 415.8Q860.6 416.9 864.5 417.4Q868.4 417.9 876.5 411.0Q884.6 404.1 891.1 401.6Q897.6 399.1 901.6 399.1Q905.5 399.0 908.2 400.2Q911.0 401.5 912.9 404.6Q914.9 407.6 914.9 410.0Q914.9 412.4 913.2 416.7Q911.5 421.0 908.2 424.8Q905.0 428.5 890.5 440.0Q876.0 451.5 867.2 461.2Q858.5 471.0 853.8 479.3Q849.1 487.6 842.5 504.5Q835.9 521.4 830.4 532.4Q824.9 543.4 818.2 554.2Q811.5 565.0 805.0 573.5Q798.5 582.0 788.2 592.2Q778.0 602.5 771.0 608.0Q764.0 613.5 744.7 624.7Q725.4 635.9 712.4 641.4Q699.4 646.9 685.4 651.4Q671.4 655.9 647.4 660.4Q623.5 665.0 602.5 666.0Q581.5 667.0 571.0 666.5Q560.5 666.0 546.1 663.9Q531.6 661.9 521.1 659.4Q510.6 656.9 501.8 653.7Q493.0 650.5 481.2 634.8Q469.5 619.0 450.1 603.1Q430.6 587.1 435.6 594.1Q440.5 601.0 456.0 618.0Q471.5 635.0 478.7 645.8Q485.9 656.6 498.5 683.5Q511.1 710.4 524.0 732.5Q536.9 754.6 537.9 760.5Q538.9 766.4 536.1 769.1Q533.4 771.9 527.5 771.4Q521.6 770.9 513.6 768.4Q505.6 765.9 489.6 758.4Q473.6 750.9 463.3 744.2Q453.0 737.5 444.0 730.0Q435.0 722.5 427.8 714.8Q420.5 707.0 414.5 699.0Q408.5 691.0 400.8 677.2Q393.1 663.4 386.1 643.4Q379.1 623.4 377.6 616.4Q376.0 609.5 374.9 597.6Q373.9 585.6 364.2 582.8Q354.6 579.9 346.3 575.7Q338.0 571.5 320.0 557.0Q302.0 542.5 293.2 536.8Q284.4 531.1 265.9 523.6Q247.4 516.1 225.9 511.6Q204.4 507.1 180.4 504.6Q156.5 502.0 124.5 500.5Q92.5 499.0 79.5 497.1Q66.5 495.2 66.3 496.3Q66.1 497.4 67.8 500.2Q69.5 503.0 72.8 505.8Q76.0 508.5 86.7 513.8Q97.4 519.1 109.2 527.3Q121.0 535.5 132.2 546.8Q143.5 558.0 158.0 575.5Q172.5 593.0 183.8 604.2Q195.0 615.5 206.0 623.5Q217.0 631.5 230.3 638.2Q243.6 644.9 257.6 649.4Q271.6 653.9 287.6 656.9Q303.5 660.0 318.0 661.0Q332.5 662.0 356.9 662.1Q381.4 662.1 380.9 663.0Q380.4 663.9 375.9 664.9Q371.4 665.9 358.9 667.4Q346.5 669.0 327.5 669.0Q308.5 669.0 293.1 666.9Q277.6 664.9 257.1 658.9Q236.6 652.9 227.1 648.4Q217.6 643.9 209.3 638.7Q201.0 633.5 186.2 620.8Q171.5 608.0 152.0 585.0Q132.5 562.0 120.2 549.8Q108.0 537.5 99.5 531.5Q91.0 525.5 81.5 520.5Q72.0 515.5 64.8 509.8Q57.5 504.0 54.8 500.2Q52.1 496.4 49.6 490.4Q47.1 484.4 47.1 481.0Q47.1 477.6 48.1 475.1Q49.1 472.6 50.9 470.9Q52.6 469.1 57.1 467.6Q61.5 466.0 76.0 467.0Q90.5 468.0 138.9 475.6Q187.4 483.1 215.9 489.6Q244.4 496.1 254.9 500.1Q265.4 504.1 275.7 509.8Q286.0 515.5 295.5 523.5Q305.0 531.5 317.5 544.5Q330.0 557.5 335.8 561.2Q341.6 564.9 350.6 568.4Q359.6 571.9 366.6 572.9Q373.5 574.0 376.4 573.6Q379.4 573.1 373.0 571.0Q366.6 568.9 354.3 562.2Q342.0 555.5 320.0 534.5Q298.0 513.5 284.2 505.3Q270.4 497.1 251.9 491.1Q233.4 485.1 210.4 480.6Q187.4 476.1 138.9 469.1Q90.5 462.0 78.5 461.0Q66.5 460.0 61.1 460.4Q55.6 460.9 54.8 459.2Q54.0 457.5 55.1 455.1Q56.1 452.6 61.4 447.4Q66.6 442.1 73.1 439.1Q79.6 436.1 89.6 433.6Q99.6 431.1 122.1 429.1Q144.5 427.0 181.5 422.0Q218.5 417.0 246.0 416.5Q273.5 416.0 298.0 418.0Q322.5 420.0 345.4 423.6Q368.4 427.1 395.9 433.6Q423.4 440.1 449.9 448.6Q476.4 457.1 507.0 469.0Q537.6 480.9 546.1 483.4Q554.6 485.9 566.1 486.4Q577.5 487.0 590.0 484.0Q602.5 481.0 612.9 481.1Q623.4 481.1 625.2 481.8Q627.0 482.5 628.5 484.5Q630.0 486.5 627.6 489.6Q625.1 492.6 625.3 495.3Q625.5 498.0 629.6 500.4Q633.6 502.9 640.6 504.9Q647.6 506.9 660.1 508.4Q672.5 510.0 697.0 509.5Q721.5 509.0 736.4 506.4Q751.4 503.9 769.9 497.4Q788.4 490.9 797.4 484.4Q806.5 478.0 809.2 472.2Q811.9 466.4 811.9 461.9Q812.0 457.5 810.9 453.1Q809.9 448.6 806.7 442.8Q803.5 437.0 798.8 432.2Q794.0 427.5 784.7 422.3Q775.4 417.1 768.9 415.1Q762.4 413.1 753.2 411.8Q744.1 410.4 743.9 398.2Q743.6 386.1 757.5 387.6Q771.4 389.1 778.9 391.1Q786.4 393.1 792.4 395.6Q798.4 398.1 804.2 401.8Q810.0 405.5 815.8 411.2Q821.5 417.0 824.2 421.8Q826.9 426.6 829.7 439.2Q832.5 451.8 834.8 441.2Q837.1 430.6 842.6 417.6Q848.1 404.6 854.8 395.3Q861.5 386.0 867.8 380.2Q874.0 374.5 882.8 368.8Q891.6 363.1 901.1 359.1Q910.6 355.1 942.1 346.6Q973.5 338.0 974.7 340.8ZM314.0 481.5Q312.0 482.5 311.1 484.1Q310.1 485.6 310.1 489.0Q310.1 492.4 312.4 494.6Q314.6 496.9 317.6 496.9Q320.5 497.0 323.0 495.5Q325.5 494.0 326.2 490.8Q326.9 487.6 324.9 484.6Q323.0 481.5 319.5 481.0Q316.0 480.5 314.0 481.5ZM132.9 523.1Q144.4 528.1 153.2 534.3Q162.0 540.5 192.0 571.0Q222.0 601.5 235.5 611.5Q249.0 621.5 266.3 629.7Q283.6 637.9 298.6 641.9Q313.6 645.9 327.5 647.5Q341.4 649.1 342.1 649.8Q342.8 650.5 342.1 650.8Q341.5 651.0 327.0 651.0Q312.5 651.0 302.6 649.4Q292.6 647.9 283.1 645.4Q273.6 642.9 258.8 636.2Q244.0 629.5 233.5 622.5Q223.0 615.5 216.0 609.5Q209.0 603.5 180.5 573.0Q152.0 542.5 145.0 536.5Q138.0 530.5 129.5 525.0Q121.0 519.5 121.2 518.8Q121.4 518.1 132.9 523.1ZM177.9 526.1Q189.4 531.1 196.2 535.8Q203.0 540.5 226.0 562.5Q249.0 584.5 265.3 596.2Q281.6 607.9 294.6 613.9Q307.6 619.9 323.6 624.4Q339.6 628.9 345.5 629.5Q351.4 630.1 352.6 630.8Q353.8 631.5 353.1 631.8Q352.5 632.0 341.5 632.0Q330.5 632.0 319.1 629.9Q307.6 627.9 297.1 624.4Q286.6 620.9 276.1 615.4Q265.6 609.9 250.8 598.2Q236.0 586.5 215.5 565.0Q195.0 543.5 186.5 536.5Q178.0 529.5 172.5 526.5Q167.0 523.5 166.1 522.5Q165.2 521.5 165.8 521.3Q166.4 521.1 177.9 526.1Z';

function renderCloudDashboardHtml() {
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>WhaleBot 52Hz — 24/7 Cloud & Coworker Mesh</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1024 1024'%3E%3Crect width='1024' height='1024' rx='220' fill='%23FFFFFF'/%3E%3Cpath fill='%231670ED' fill-rule='evenodd' d='${WHALE_52HZ_CLOUD_D}'/%3E%3C/svg%3E"/>
<style>
  :root {
    color-scheme: dark;
    --bg-void: #06080d;
    --bg-surface: #0c1018;
    --bg-elevated: #121824;
    --bg-card: #161e2e;
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
    --font-mono: 'JetBrains Mono', 'Cascadia Code', ui-monospace, Consolas, monospace;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg-void); color: var(--fg-primary); font-family: var(--font-sans); min-height: 100vh; display: flex; flex-direction: column; }
  .topbar {
    background: var(--bg-surface); border-bottom: 1px solid var(--border-dim);
    padding: 12px 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;
  }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1rem; }
  .logo {
    width: 38px; height: 38px; border-radius: 10px;
    background: #ffffff;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
  }
  .logo svg { width: 34px; height: 34px; }
  .pill {
    padding: 4px 10px; border-radius: 6px; font-family: var(--font-mono); font-size: 0.73rem; font-weight: 600;
    border: 1px solid var(--border-dim); background: var(--bg-elevated); color: var(--fg-secondary);
  }
  .pill.ok { color: var(--emerald); background: var(--emerald-dim); border-color: rgba(16,185,129,0.4); }
  .pill.warn { color: var(--amber); background: var(--amber-dim); border-color: rgba(245,158,11,0.4); }
  .pill.err { color: var(--rose); background: var(--rose-dim); border-color: rgba(244,63,94,0.4); }
  .grid {
    display: grid; grid-template-columns: 300px 1fr 330px; gap: 14px; padding: 14px; max-width: 1440px; width: 100%; margin: 0 auto; flex: 1;
  }
  .col { display: flex; flex-direction: column; gap: 12px; }
  .card { background: var(--bg-surface); border: 1px solid var(--border-dim); border-radius: 10px; padding: 14px; }
  .card-hdr {
    font-family: var(--font-mono); font-size: 0.72rem; font-weight: 700; color: var(--fg-muted);
    letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 10px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .cw-item {
    background: var(--bg-elevated); border: 1px solid var(--border-dim); border-radius: 8px; padding: 10px; margin-bottom: 8px;
  }
  .cw-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-weight: 700; font-size: 0.86rem; }
  .role-tag { font-family: var(--font-mono); font-size: 0.65rem; padding: 1px 6px; border-radius: 4px; background: var(--cyan-dim); color: var(--cyan); }
  .role-tag.writer { background: var(--violet-dim); color: #c4b5fd; }
  input, select, textarea, button {
    background: var(--bg-void); color: var(--fg-primary); border: 1px solid var(--border-dim);
    border-radius: 7px; padding: 8px 11px; font-family: var(--font-sans); font-size: 0.84rem;
  }
  input, select, textarea { width: 100%; }
  button { cursor: pointer; background: var(--cyan); color: #04131a; font-weight: 600; border: none; width: auto; display: inline-flex; align-items: center; gap: 5px; }
  button.sec { background: var(--bg-elevated); color: var(--fg-primary); border: 1px solid var(--border-dim); }
  button.amber { background: var(--amber-dim); color: var(--amber); border: 1px solid rgba(245,158,11,0.4); }
  button.danger { background: var(--rose-dim); color: var(--rose); border: 1px solid rgba(244,63,94,0.4); }
  .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .goal-node {
    background: var(--bg-elevated); border: 1px solid var(--border-dim); border-radius: 8px; padding: 11px; margin-bottom: 8px;
  }
  .mono { font-family: var(--font-mono); font-size: 0.75rem; color: var(--fg-secondary); }
  @media (max-width: 960px) { .grid { grid-template-columns: 1fr; } }
</style>
</head>
<body>
  <div class="topbar">
    <div class="brand">
      <div class="logo"><svg viewBox="20 180 984 720" xmlns="http://www.w3.org/2000/svg"><path fill="#1670ED" fill-rule="evenodd" d="${WHALE_52HZ_CLOUD_D}"/></svg></div>
      <div>
        <div>BotAutoTask Cloud Core <span class="pill" style="font-size:0.65rem">24/7 RELAY & D1</span></div>
        <div class="mono" style="font-size:0.7rem;color:var(--fg-muted)">Coworker Mesh · Atomic Lease CAS · GitHub Actions Failover</div>
      </div>
    </div>
    <div class="row">
      <span id="conn" class="pill">Checking...</span>
      <button class="sec" onclick="loadState()">↻ Refresh</button>
    </div>
  </div>

  <div class="grid">
    <!-- Left: Coworker Squad & Remote Steer -->
    <div class="col">
      <div id="authCard" class="card" style="display:none;border-color:var(--amber)">
        <div class="card-hdr" style="color:var(--amber)">🔑 Pair API Token</div>
        <div class="row">
          <input id="tokenInput" type="password" placeholder="BOTAUTOTASK_API_TOKEN"/>
          <button onclick="saveToken()">Connect</button>
        </div>
      </div>

      <div class="card">
        <div class="card-hdr"><span>COWORKER MESH ROSTER</span><span>3 SPECIALISTS</span></div>
        <div class="cw-item">
          <div class="cw-top"><span>@lead · Team Lead</span><span class="role-tag">READER</span></div>
          <div class="mono" style="font-size:0.72rem">Decomposes goals, coordinates @coder & @reviewer, verifies completion contract.</div>
        </div>
        <div class="cw-item">
          <div class="cw-top"><span>@coder · Senior Engineer</span><span class="role-tag writer">WRITER (WORKTREE)</span></div>
          <div class="mono" style="font-size:0.72rem">Implements features & unit tests in isolated branch <code>botautotask/agent-coder</code>.</div>
        </div>
        <div class="cw-item" style="margin-bottom:0">
          <div class="cw-top"><span>@reviewer · Adversarial QA</span><span class="role-tag">READER</span></div>
          <div class="mono" style="font-size:0.72rem">Audits git diff, runs acceptance check, blocks unverified merges.</div>
        </div>
      </div>

      <div class="card">
        <div class="card-hdr"><span>⚡ 3-MODE REMOTE STEER DOCK</span></div>
        <div style="display:grid;gap:8px">
          <div class="row">
            <select id="cmdTarget" style="flex:1">
              <option value="lead">@lead (Orchestrator)</option>
              <option value="coder">@coder (Writer)</option>
              <option value="reviewer">@reviewer (QA)</option>
              <option value="all">@all (Broadcast)</option>
            </select>
            <select id="cmdType" style="flex:1">
              <option value="STEER">📨 Send / Steer</option>
              <option value="INTERRUPT">⚡ Interrupt Turn</option>
              <option value="QUEUE">⏳ Queue Follow-up</option>
            </select>
          </div>
          <input id="cmdPayload" placeholder="Inject remote instruction to coworker..."/>
          <button class="amber" style="justify-content:center" onclick="sendRemoteCommand()">Transmit Command ↵</button>
        </div>
      </div>
    </div>

    <!-- Center: Mission Launcher & Active Goals -->
    <div class="col">
      <div class="card">
        <div class="card-hdr"><span>🎯 DISPATCH NEW SQUAD MISSION (GOAL)</span></div>
        <div style="display:grid;gap:8px">
          <textarea id="prompt" rows="2" placeholder="Describe the feature, bugfix, or refactoring mission for the squad..."></textarea>
          <div class="row">
            <select id="core" style="flex:1;min-width:180px">
              <option value="auto">AI Core: Auto (Best Free Model)</option>
              <option value="opencode:opencode/deepseek-v4.1-flash-free">OpenCode: deepseek-v4.1-flash-free</option>
              <option value="opencode:freemodel/claude-sonnet-4-6">OpenCode: claude-sonnet-4-6 (Free)</option>
              <option value="codex">Codex (ChatGPT OAuth 0-Key)</option>
              <option value="claude">Claude Code</option>
              <option value="antigravity">Antigravity IDE</option>
            </select>
            <select id="mode" style="flex:1;min-width:150px">
              <option value="auto">Mode: Auto (PC → Cloud Failover)</option>
              <option value="local">Mode: Local PC Only</option>
              <option value="cloud">Mode: Cloud Immediately (GitHub Actions)</option>
            </select>
          </div>
          <div class="row">
            <input id="repo" placeholder="GitHub Repo (e.g. huongmh14/BotAutoTask)" value="huongmh14/BotAutoTask" style="flex:1"/>
            <input id="check" placeholder="Verify cmd (e.g. npm test)" value="npm test" style="flex:1"/>
            <button onclick="createGoal()">🚀 Launch Mission</button>
          </div>
        </div>
      </div>

      <div class="card" style="flex:1">
        <div class="card-hdr"><span>📋 ACTIVE & RECENT MISSIONS (CAS LEASE PROTECTED)</span></div>
        <div id="goalsList" class="mono">Loading missions...</div>
      </div>
    </div>

    <!-- Right: Live Journal & Remote Command Queue -->
    <div class="col">
      <div class="card">
        <div class="card-hdr"><span>📜 STEP JOURNAL & HANDOFF TELEMETRY</span></div>
        <div id="journalList" class="mono" style="max-height:380px;overflow-y:auto">Loading journal...</div>
      </div>

      <div class="card">
        <div class="card-hdr"><span>📡 PENDING REMOTE COMMANDS</span></div>
        <div id="commandsList" class="mono">No pending remote commands.</div>
      </div>
    </div>
  </div>

<script>
  const hashToken = new URLSearchParams(location.hash.slice(1)).get('token') || new URLSearchParams(location.search).get('token');
  if (hashToken) {
    localStorage.setItem('bat_token', hashToken);
    history.replaceState(null, '', location.pathname);
  }
  function getToken() { return localStorage.getItem('bat_token') || ''; }
  function saveToken() {
    localStorage.setItem('bat_token', document.getElementById('tokenInput').value.trim());
    loadState();
  }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  async function api(path, body) {
    const res = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 401) {
      document.getElementById('authCard').style.display = 'block';
      const c = document.getElementById('conn');
      c.className = 'pill err';
      c.textContent = 'TOKEN REQUIRED';
      throw new Error('Unauthorized');
    }
    document.getElementById('authCard').style.display = 'none';
    const c = document.getElementById('conn');
    c.className = 'pill ok';
    c.textContent = '🟢 24/7 CLOUD LIVE';
    return res.json();
  }
  async function createGoal() {
    const prompt = document.getElementById('prompt').value.trim();
    if (!prompt) return;
    await api('/api/goals', {
      prompt,
      preferred_core: document.getElementById('core').value,
      execution_mode: document.getElementById('mode').value,
      repo_url: document.getElementById('repo').value.trim(),
      acceptance_cmd: document.getElementById('check').value.trim()
    });
    document.getElementById('prompt').value = '';
    loadState();
  }
  async function sendRemoteCommand() {
    const payload = document.getElementById('cmdPayload').value.trim();
    if (!payload) return;
    await api('/api/commands', {
      target_id: document.getElementById('cmdTarget').value,
      command_type: document.getElementById('cmdType').value,
      payload
    });
    document.getElementById('cmdPayload').value = '';
    loadState();
  }
  async function goalAction(goalId, action, value) {
    await api('/api/goals/action', { goalId, action, value });
    loadState();
  }
  async function loadState() {
    try {
      const data = await api('/api/state');
      const gEl = document.getElementById('goalsList');
      gEl.innerHTML = (data.goals || []).length ? data.goals.map(g => {
        const stClass = g.status === 'COMPLETED' ? 'ok' : (g.status === 'COMPLETED_UNVERIFIED' || g.status === 'PAUSED' ? 'warn' : (g.status === 'CANCELLED' ? 'err' : ''));
        return \`
        <div class="goal-node">
          <div class="row" style="justify-content:space-between;margin-bottom:4px">
            <b style="color:var(--fg-primary)">\${esc(g.title)}</b>
            <span class="pill \${stClass}">\${esc(g.status)}</span>
          </div>
          <div class="mono" style="margin-bottom:8px;font-size:0.71rem">
            id: \${esc(g.id)} · worker: <b>\${esc(g.lease_owner || 'waiting')}</b> · epoch: #\${g.lease_epoch || 0} · core: \${esc(g.preferred_core)} · step: \${g.current_step}/\${g.max_steps}
          </div>
          <div class="row">
            <button class="sec" style="padding:4px 8px;font-size:0.74rem" onclick="goalAction('\${esc(g.id)}','pause')">⏸ Pause</button>
            <button class="sec" style="padding:4px 8px;font-size:0.74rem" onclick="goalAction('\${esc(g.id)}','resume')">▶ Resume</button>
            <button class="amber" style="padding:4px 8px;font-size:0.74rem" onclick="goalAction('\${esc(g.id)}','switch',prompt('Switch AI Core (auto, codex, claude, opencode:...):','\${esc(g.preferred_core)}'))">🔄 Swap Core</button>
            <button class="danger" style="padding:4px 8px;font-size:0.74rem" onclick="goalAction('\${esc(g.id)}','cancel')">✕ Cancel</button>
          </div>
        </div>\`;
      }).join('') : 'No missions queued yet.';

      const jEl = document.getElementById('journalList');
      jEl.innerHTML = (data.journal || []).length ? data.journal.map(e => \`
        <div style="border-bottom:1px solid var(--border-dim);padding:7px 0">
          <div style="color:var(--cyan);font-weight:700">[\${esc(e.goal_id)} · Step #\${e.step_number}] \${esc(e.outcome)}</div>
          <div style="font-size:0.7rem;color:var(--fg-muted)">via \${esc(e.core_used)}:\${esc(e.model_used)}</div>
          <div style="color:var(--fg-primary);margin-top:2px">\${esc(e.summary)}</div>
        </div>\`).join('') : 'No steps recorded yet.';

      const cEl = document.getElementById('commandsList');
      if (Array.isArray(data.commands) && data.commands.length) {
        cEl.innerHTML = data.commands.map(c => \`
          <div style="border-bottom:1px solid var(--border-dim);padding:5px 0">
            <span class="pill warn" style="padding:1px 5px;font-size:0.65rem">\${esc(c.command_type)}</span>
            <b>@\${esc(c.target_id || 'lead')}</b>: \${esc(c.payload)}
          </div>\`).join('');
      } else {
        cEl.innerHTML = 'Queue clear — all commands delivered.';
      }
    } catch {}
  }
  loadState();
  setInterval(loadState, 6000);
</script>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 0. Browser Dashboard on GET / (when opened in browser without Bearer header)
    const authHeader = request.headers.get('Authorization');
    if (request.method === 'GET' && url.pathname === '/' && !authHeader) {
      return new Response(renderCloudDashboardHtml(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // 1. Telegram Webhook (24/7 Mobile Control)
    if (request.method === 'POST' && url.pathname === '/webhook/telegram') {
      const update = await request.json().catch(() => ({}));
      const msg = update?.message;
      if (!msg?.text) return new Response('OK');

      const chatId = String(msg.chat?.id || '');
      if (env.TELEGRAM_ALLOWED_CHAT_ID && chatId !== String(env.TELEGRAM_ALLOWED_CHAT_ID)) {
        return new Response('Forbidden', { status: 403 });
      }

      const { command, args, flags } = parseTelegramCommand(msg.text);
      const now = Date.now();

      if (command === '/goal') {
        if (!args) {
          await sendTelegramMessage(
            env,
            'Usage: `/goal <target description> [--repo owner/repo] [--path D:\\repo] [--core opencode:deepseek-v4.1-flash-free] [--check "npm test"]`',
            chatId
          );
          return new Response('OK');
        }
        const id = `goal-${now.toString(36)}`;
        await env.DB.prepare(
          `INSERT INTO goals (id, title, target_prompt, repo_path, repo_url, acceptance_cmd, execution_mode, preferred_core, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'QUEUED', ?, ?)`
        )
          .bind(
            id,
            args.slice(0, 80),
            args,
            flags.path || null,
            flags.repo || null,
            flags.check || null,
            flags.mode || 'auto',
            flags.core || 'auto',
            now,
            now
          )
          .run();

        await sendTelegramMessage(
          env,
          `🎯 *Created Goal* \`${id}\`\n*Target:* ${args}\n*Core:* \`${flags.core || 'auto (best free model)'}\`\n*Mode:* \`${flags.mode || 'auto'}\``,
          chatId
        );
        return new Response('OK');
      }

      if (command === '/status') {
        const goal = await env.DB.prepare(`SELECT * FROM goals ORDER BY created_at DESC LIMIT 1`).first();
        if (!goal) {
          await sendTelegramMessage(env, 'No goals found.', chatId);
          return new Response('OK');
        }
        const { results: entries } = await env.DB.prepare(
          `SELECT * FROM journal_entries WHERE goal_id = ? ORDER BY step_number DESC LIMIT 3`
        )
          .bind(goal.id)
          .all();

        const logLines = (entries || [])
          .map((e) => `• Step ${e.step_number} (\`${e.core_used}:${e.model_used}\` → ${e.outcome}): ${e.summary}`)
          .join('\n');

        await sendTelegramMessage(
          env,
          `📊 *Goal:* \`${goal.id}\` (${goal.status})\n*Worker:* \`${goal.lease_owner || 'waiting'}\`\n*Preferred Core:* \`${goal.preferred_core}\`\n*Step:* ${goal.current_step}/${goal.max_steps}\n\n*Recent Journal:*\n${logLines || 'No steps recorded yet.'}`,
          chatId
        );
        return new Response('OK');
      }

      if (command === '/switch') {
        const newCore = args || 'auto';
        await env.DB.prepare(
          `UPDATE goals SET preferred_core = ?, updated_at = ? WHERE status IN ('QUEUED', 'RUNNING_LOCAL', 'RUNNING_CLOUD')`
        )
          .bind(newCore, now)
          .run();
        await sendTelegramMessage(
          env,
          `🔄 Switched active goal preferred core/model to \`${newCore}\`. Next step will use it immediately.`,
          chatId
        );
        return new Response('OK');
      }

      if (command === '/mode') {
        const newMode = ['local', 'cloud', 'auto'].includes(args) ? args : 'auto';
        await env.DB.prepare(
          `UPDATE goals SET execution_mode = ?, updated_at = ? WHERE status IN ('QUEUED', 'RUNNING_LOCAL', 'RUNNING_CLOUD')`
        )
          .bind(newMode, now)
          .run();
        await sendTelegramMessage(env, `⚙️ Switched execution mode to \`${newMode}\`.`, chatId);
        return new Response('OK');
      }

      if (command === '/pause' || command === '/cancel' || command === '/resume') {
        const nextStatus = command === '/pause' ? 'PAUSED' : command === '/cancel' ? 'CANCELLED' : 'QUEUED';
        await env.DB.prepare(`UPDATE goals SET status = ?, updated_at = ? WHERE status NOT IN ('COMPLETED', 'COMPLETED_UNVERIFIED', 'CANCELLED')`)
          .bind(nextStatus, now)
          .run();
        await sendTelegramMessage(env, `Updated active goal status to *${nextStatus}*.`, chatId);
        return new Response('OK');
      }

      return new Response('OK');
    }

    // Authenticate Worker Lease & Dashboard API requests (fail-closed: no configured token => nothing is authorized)
    if (!(await isAuthorized(authHeader, env.BOTAUTOTASK_API_TOKEN))) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 1b. Web/Mobile Dashboard APIs
    if (request.method === 'GET' && url.pathname === '/api/state') {
      const { results: goals } = await env.DB.prepare(`SELECT * FROM goals ORDER BY created_at DESC LIMIT 20`).all();
      const { results: journal } = await env.DB.prepare(`SELECT * FROM journal_entries ORDER BY id DESC LIMIT 30`).all();
      const { results: commands } = await env.DB.prepare(
        `SELECT * FROM remote_commands WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT 20`
      )
        .all()
        .catch(() => ({ results: [] }));
      return Response.json({ goals: goals || [], journal: journal || [], commands: commands || [] });
    }

    if (request.method === 'POST' && url.pathname === '/api/goals') {
      const body = await request.json().catch(() => ({}));
      const prompt = String(body.prompt || '').trim();
      if (!prompt) return Response.json({ error: 'Missing prompt' }, { status: 400 });
      const now = Date.now();
      const id = `goal-${now.toString(36)}`;
      const mode = ['local', 'cloud', 'auto'].includes(body.execution_mode) ? body.execution_mode : 'auto';
      await env.DB.prepare(
        `INSERT INTO goals (id, title, target_prompt, repo_path, repo_url, acceptance_cmd, execution_mode, preferred_core, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'QUEUED', ?, ?)`
      )
        .bind(id, prompt.slice(0, 80), prompt, body.repo_path || null, body.repo_url || null, body.acceptance_cmd || null, mode, body.preferred_core || 'auto', now, now)
        .run();
      if (mode === 'cloud' && body.repo_url) {
        await triggerGitHubActions(env, { id, repo_url: body.repo_url, branch: body.branch || 'dev' });
      }
      return Response.json({ ok: true, id });
    }

    if (request.method === 'POST' && url.pathname === '/api/goals/action') {
      const { goalId, action, value } = await request.json().catch(() => ({}));
      if (!goalId) return Response.json({ error: 'Missing goalId' }, { status: 400 });
      const now = Date.now();
      if (action === 'switch' && value) {
        await env.DB.prepare(`UPDATE goals SET preferred_core = ?, updated_at = ? WHERE id = ?`).bind(String(value), now, goalId).run();
      } else if (action === 'pause' || action === 'resume' || action === 'cancel') {
        const nextStatus = action === 'pause' ? 'PAUSED' : action === 'cancel' ? 'CANCELLED' : 'QUEUED';
        await env.DB.prepare(`UPDATE goals SET status = ?, updated_at = ? WHERE id = ?`).bind(nextStatus, now, goalId).run();
      }
      return Response.json({ ok: true });
    }

    // 2. Lease Acquire (Atomic CAS)
    if (request.method === 'POST' && url.pathname === '/api/lease/acquire') {
      const { workerId = 'local-pc', goalId = null } = await request.json().catch(() => ({}));
      const now = Date.now();
      const leaseExpiry = now + 90_000;

      const candidate = goalId
        ? await env.DB.prepare(`SELECT * FROM goals WHERE id = ?`).bind(goalId).first()
        : await env.DB.prepare(
            `SELECT * FROM goals
             WHERE status IN ('QUEUED', 'RUNNING_LOCAL', 'RUNNING_CLOUD')
               AND (lease_expires_at < ? OR lease_owner = ?)
             ORDER BY created_at ASC LIMIT 1`
          )
            .bind(now, workerId)
            .first();

      if (!candidate) {
        return Response.json({ goal: null });
      }

      const nextStatus = workerId === 'local-pc' ? 'RUNNING_LOCAL' : 'RUNNING_CLOUD';
      const casRes = await env.DB.prepare(
        `UPDATE goals
         SET status = ?, lease_owner = ?, lease_expires_at = ?, lease_epoch = COALESCE(lease_epoch, 0) + 1, updated_at = ?
         WHERE id = ? AND (lease_expires_at < ? OR lease_owner = ?)`
      )
        .bind(nextStatus, workerId, leaseExpiry, now, candidate.id, now, workerId)
        .run();

      const changes = casRes?.meta?.changes ?? casRes?.changes ?? 0;
      if (changes !== 1) {
        // Race condition: another worker acquired the lease in this window
        return Response.json({ goal: null, conflict: true });
      }

      const updatedGoal = await env.DB.prepare(`SELECT * FROM goals WHERE id = ?`).bind(candidate.id).first();
      const { results: journal } = await env.DB.prepare(
        `SELECT * FROM journal_entries WHERE goal_id = ? ORDER BY step_number ASC`
      )
        .bind(candidate.id)
        .all();

      return Response.json({ goal: updatedGoal, journal: journal || [] });
    }

    // 2b. Lease Heartbeat
    if (request.method === 'POST' && url.pathname === '/api/lease/heartbeat') {
      const { goal_id, worker_id = 'local-pc', lease_epoch } = await request.json().catch(() => ({}));
      if (!goal_id) return Response.json({ error: 'Missing goal_id' }, { status: 400 });
      const now = Date.now();
      const leaseExpiry = now + 90_000;

      let query = `UPDATE goals SET lease_expires_at = ?, updated_at = ? WHERE id = ? AND lease_owner = ?`;
      const binds = [leaseExpiry, now, goal_id, worker_id];

      if (typeof lease_epoch === 'number') {
        query += ` AND lease_epoch = ?`;
        binds.push(lease_epoch);
      }

      const res = await env.DB.prepare(query).bind(...binds).run();
      const changes = res?.meta?.changes ?? res?.changes ?? 0;
      if (changes !== 1) {
        return Response.json({ error: 'Fenced: lease lost or epoch mismatch' }, { status: 409 });
      }
      return Response.json({ ok: true, lease_expires_at: leaseExpiry });
    }

    // 3. Record Step Journal & Completion (with Epoch Fencing & Idempotent Journal)
    if (request.method === 'POST' && url.pathname === '/api/lease/step') {
      const body = await request.json();
      const now = Date.now();

      if (typeof body.lease_epoch === 'number') {
        const currentGoal = await env.DB.prepare(
          `SELECT lease_owner, lease_epoch FROM goals WHERE id = ?`
        ).bind(body.goal_id).first();

        if (currentGoal) {
          if (currentGoal.lease_epoch !== body.lease_epoch || currentGoal.lease_owner !== (body.worker_id || 'local-pc')) {
            return Response.json(
              { error: 'Fenced: lease expired or acquired by another worker', epoch_mismatch: true },
              { status: 409 }
            );
          }
        }
      }

      await env.DB.prepare(
        `INSERT OR IGNORE INTO journal_entries (goal_id, step_number, worker_id, core_used, model_used, outcome, summary, git_commit, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          body.goal_id,
          body.step_number,
          body.worker_id || 'local-pc',
          body.core_used,
          body.model_used,
          body.outcome,
          body.summary,
          body.git_commit || null,
          now
        )
        .run();

      const newStatus = body.goal_status || (body.outcome === 'GOAL_COMPLETED' ? 'COMPLETED' : 'RUNNING_LOCAL');
      await env.DB.prepare(
        `UPDATE goals SET current_step = ?, status = ?, lease_expires_at = ?, updated_at = ? WHERE id = ?`
      )
        .bind(body.step_number, newStatus, now + 90_000, now, body.goal_id)
        .run();

      if (newStatus === 'COMPLETED' || newStatus === 'COMPLETED_UNVERIFIED' || body.outcome === 'RATE_LIMITED') {
        const icon = newStatus === 'COMPLETED' ? '✅' : newStatus === 'COMPLETED_UNVERIFIED' ? '🟡' : '🔄';
        await sendTelegramMessage(
          env,
          `${icon} *Goal* \`${body.goal_id}\` [Step ${body.step_number} via \`${body.core_used}:${body.model_used}\`]: ${body.summary}`
        );
      }

      return Response.json({ ok: true });
    }

    // 4. Remote Commands API (Mobile/PWA Remote Steer & Interrupt)
    if (request.method === 'POST' && url.pathname === '/api/commands') {
      const body = await request.json().catch(() => ({}));
      const id = body.id || `cmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const now = Date.now();
      await env.DB.prepare(
        `INSERT INTO remote_commands (id, goal_id, target_id, command_type, payload, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'PENDING', ?)`
      )
        .bind(
          id,
          body.goal_id || null,
          body.target_id || null,
          body.command_type || 'STEER',
          typeof body.payload === 'string' ? body.payload : JSON.stringify(body.payload || {}),
          now
        )
        .run();
      return Response.json({ ok: true, id });
    }

    if (request.method === 'GET' && url.pathname === '/api/commands') {
      const goalId = url.searchParams.get('goalId');
      let query = `SELECT * FROM remote_commands WHERE status = 'PENDING'`;
      const binds = [];
      if (goalId) {
        query += ` AND (goal_id = ? OR goal_id IS NULL)`;
        binds.push(goalId);
      }
      query += ` ORDER BY created_at ASC LIMIT 10`;
      const { results: commands } = await env.DB.prepare(query).bind(...binds).all();
      return Response.json({ commands: commands || [] });
    }

    return Response.json({ service: 'BotAutoTask Cloud Core', status: 'healthy' });
  },

  // 4. Cron Trigger: Handover to GitHub Actions when Local PC is powered off / offline
  async scheduled(event, env, ctx) {
    const now = Date.now();
    const { results: goals } = await env.DB.prepare(
      `SELECT * FROM goals WHERE status IN ('QUEUED', 'RUNNING_LOCAL')`
    ).all();

    for (const goal of goals || []) {
      if (shouldTriggerCloudFallback(goal, now)) {
        const triggered = await triggerGitHubActions(env, goal);
        if (triggered) {
          await env.DB.prepare(
            `UPDATE goals SET status = 'RUNNING_CLOUD', lease_owner = 'gh-actions', lease_expires_at = ?, updated_at = ? WHERE id = ?`
          )
            .bind(now + 10 * 60 * 1000, now, goal.id)
            .run();
          await sendTelegramMessage(
            env,
            `☁️ Local PC offline for >90s. Automatically handed over Goal \`${goal.id}\` to *GitHub Actions Cloud Worker*.`
          );
        }
      }
    }
  }
};
