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
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>BotAutoTask — 24/7 Cloud & Mobile Control</title>
<style>
  :root{color-scheme:dark;--bg:#0b0f17;--card:#151c28;--border:#263248;--fg:#e2e8f0;--muted:#94a3b8;--accent:#38bdf8;--ok:#22c55e;--warn:#f59e0b;--err:#ef4444}
  *{box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif}
  body{margin:0;background:var(--bg);color:var(--fg);padding:16px;max-width:980px;margin-inline:auto}
  h1{font-size:1.25rem;margin:0 0 4px;display:flex;align-items:center;gap:8px}
  .sub{color:var(--muted);font-size:.85rem;margin-bottom:16px}
  .card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:14px}
  .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  input,select,textarea,button{background:#0f1520;color:var(--fg);border:1px solid var(--border);border-radius:8px;padding:9px 12px;font-size:.9rem}
  input,select,textarea{width:100%}
  button{cursor:pointer;background:var(--accent);color:#03111c;font-weight:600;border:none;width:auto}
  button.sec{background:#1e293b;color:var(--fg);border:1px solid var(--border)}
  button.danger{background:var(--err);color:#fff}
  .badge{padding:2px 8px;border-radius:99px;font-size:.75rem;font-weight:600;background:#1e293b}
  .QUEUED,.RUNNING_LOCAL,.RUNNING_CLOUD{color:var(--accent)}
  .COMPLETED{color:var(--ok)} .PAUSED{color:var(--warn)} .CANCELLED,.FAILED{color:var(--err)}
  .goal{border-top:1px solid var(--border);padding:10px 0;margin-top:10px}
  .mono{font-family:ui-monospace,Consolas,monospace;font-size:.8rem;color:var(--muted)}
</style>
</head>
<body>
  <h1>🤖 BotAutoTask Cloud Core <span id="conn" class="badge">Checking...</span></h1>
  <div class="sub">Điều khiển đội Agent 24/7 từ điện thoại & máy tính (Cloudflare Worker + D1 + GitHub Actions)</div>

  <div id="authCard" class="card" style="display:none">
    <b>🔑 Nhập API Token (chỉ cần 1 lần)</b>
    <p class="sub">Lấy trong <code>~/.botautotask/config.json</code> (trường <code>cloud.apiToken</code>) hoặc mở bằng link có <code>#token=...</code></p>
    <div class="row">
      <input id="tokenInput" type="password" placeholder="BOTAUTOTASK_API_TOKEN" style="flex:1"/>
      <button onclick="saveToken()">Lưu & Kết nối</button>
    </div>
  </div>

  <div class="card">
    <b>🎯 Giao nhiệm vụ mới (Goal)</b>
    <div style="display:grid;gap:8px;margin-top:10px">
      <textarea id="prompt" rows="2" placeholder="Mô tả công việc cho Agent (VD: Viết unit test và fix lỗi auth)..."></textarea>
      <div class="row">
        <select id="core" style="flex:1;min-width:180px">
          <option value="auto">Lõi AI: Auto (Săn Model Free tốt nhất)</option>
          <option value="opencode:opencode/deepseek-v4.1-flash-free">OpenCode: deepseek-v4.1-flash-free</option>
          <option value="opencode:freemodel/claude-sonnet-4-6">OpenCode: claude-sonnet-4-6 (Free)</option>
          <option value="codex">Codex (ChatGPT OAuth 0-Key)</option>
          <option value="claude">Claude Code</option>
          <option value="antigravity">Antigravity IDE</option>
        </select>
        <select id="mode" style="flex:1;min-width:150px">
          <option value="auto">Chế độ: Auto (PC -> Cloud)</option>
          <option value="local">Chỉ chạy trên PC (Local)</option>
          <option value="cloud">Chạy ngay trên Cloud (GitHub Actions)</option>
        </select>
      </div>
      <div class="row">
        <input id="repo" placeholder="GitHub Repo khi tắt máy (VD: huongmh14/BotAutoTask)" value="huongmh14/BotAutoTask" style="flex:1"/>
        <input id="check" placeholder="Lệnh kiểm tra (VD: npm test)" value="npm test" style="flex:1"/>
        <button onclick="createGoal()">🚀 Gửi Goal</button>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="row" style="justify-content:space-between">
      <b>📋 Danh sách Goals & Điều khiển trực tiếp</b>
      <button class="sec" onclick="loadState()">↻ Làm mới</button>
    </div>
    <div id="goalsList" class="sub" style="margin-top:8px">Đang tải...</div>
  </div>

  <div class="card">
    <b>📜 Nhật ký bước chạy (Journal Entries)</b>
    <div id="journalList" class="sub" style="margin-top:8px">Đang tải...</div>
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
      document.getElementById('conn').textContent = 'Cần nhập Token';
      throw new Error('Unauthorized');
    }
    document.getElementById('authCard').style.display = 'none';
    document.getElementById('conn').textContent = '🟢 Đã kết nối 24/7';
    return res.json();
  }
  async function createGoal() {
    const prompt = document.getElementById('prompt').value.trim();
    if (!prompt) return alert('Nhập mô tả công việc!');
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
  async function goalAction(goalId, action, value) {
    await api('/api/goals/action', { goalId, action, value });
    loadState();
  }
  async function loadState() {
    try {
      const data = await api('/api/state');
      const gEl = document.getElementById('goalsList');
      gEl.innerHTML = (data.goals || []).length ? data.goals.map(g => \`
        <div class="goal">
          <div class="row" style="justify-content:space-between">
            <div><b>\${esc(g.title)}</b> <span class="mono">(\${esc(g.id)})</span></div>
            <span class="badge \${esc(g.status)}">\${esc(g.status)}</span>
          </div>
          <div class="mono" style="margin:4px 0">Worker: \${esc(g.lease_owner || 'waiting')} | Core: \${esc(g.preferred_core)} | Mode: \${esc(g.execution_mode)} | Step: \${g.current_step}/\${g.max_steps}</div>
          <div class="row" style="margin-top:6px">
            <button class="sec" onclick="goalAction('\${esc(g.id)}','pause')">⏸ Pause</button>
            <button class="sec" onclick="goalAction('\${esc(g.id)}','resume')">▶ Resume</button>
            <button class="sec" onclick="goalAction('\${esc(g.id)}','switch',prompt('Đổi lõi/model (auto, codex, claude, opencode:...):','\${esc(g.preferred_core)}'))">🔄 Đổi Lõi</button>
            <button class="danger" onclick="goalAction('\${esc(g.id)}','cancel')">✕ Hủy</button>
          </div>
        </div>\`).join('') : 'Chưa có Goal nào. Hãy tạo Goal ở trên!';
      const jEl = document.getElementById('journalList');
      jEl.innerHTML = (data.journal || []).length ? data.journal.map(e => \`
        <div class="goal mono">
          <b>[\${esc(e.goal_id)} #Step \${e.step_number}]</b> (\${esc(e.core_used)}:\${esc(e.model_used)} → \${esc(e.outcome)}): \${esc(e.summary)}
        </div>\`).join('') : 'Chưa có bước chạy nào.';
    } catch {}
  }
  loadState();
  setInterval(loadState, 8000);
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
      return Response.json({ goals: goals || [], journal: journal || [] });
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
