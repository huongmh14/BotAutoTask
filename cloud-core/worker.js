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

function renderCloudDashboardHtml() {
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>BotAutoTask — 24/7 Cloud & Coworker Mesh</title>
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
    width: 30px; height: 30px; border-radius: 8px;
    background: linear-gradient(135deg, var(--cyan), var(--violet));
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-mono); font-weight: 800; font-size: 0.85rem; color: #fff;
  }
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
      <div class="logo">B²</div>
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
        const stClass = g.status === 'COMPLETED' ? 'ok' : (g.status === 'PAUSED' ? 'warn' : (g.status === 'CANCELLED' ? 'err' : ''));
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
        await env.DB.prepare(`UPDATE goals SET status = ?, updated_at = ? WHERE status NOT IN ('COMPLETED', 'CANCELLED')`)
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

      if (newStatus === 'COMPLETED' || body.outcome === 'RATE_LIMITED') {
        const icon = newStatus === 'COMPLETED' ? '✅' : '🔄';
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
