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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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

    // Authenticate Worker Lease API requests
    const authHeader = request.headers.get('Authorization') || '';
    if (env.BOTAUTOTASK_API_TOKEN && authHeader !== `Bearer ${env.BOTAUTOTASK_API_TOKEN}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 2. Lease Acquire / Heartbeat
    if (request.method === 'POST' && url.pathname === '/api/lease/acquire') {
      const { workerId = 'local-pc', goalId = null } = await request.json().catch(() => ({}));
      const now = Date.now();
      const leaseExpiry = now + 90_000;

      const goal = goalId
        ? await env.DB.prepare(`SELECT * FROM goals WHERE id = ?`).bind(goalId).first()
        : await env.DB.prepare(
            `SELECT * FROM goals
             WHERE status IN ('QUEUED', 'RUNNING_LOCAL', 'RUNNING_CLOUD')
               AND (lease_expires_at < ? OR lease_owner = ?)
             ORDER BY created_at ASC LIMIT 1`
          )
            .bind(now, workerId)
            .first();

      if (!goal) {
        return Response.json({ goal: null });
      }

      const nextStatus = workerId === 'local-pc' ? 'RUNNING_LOCAL' : 'RUNNING_CLOUD';
      await env.DB.prepare(
        `UPDATE goals SET status = ?, lease_owner = ?, lease_expires_at = ?, updated_at = ? WHERE id = ?`
      )
        .bind(nextStatus, workerId, leaseExpiry, now, goal.id)
        .run();

      const { results: journal } = await env.DB.prepare(
        `SELECT * FROM journal_entries WHERE goal_id = ? ORDER BY step_number ASC`
      )
        .bind(goal.id)
        .all();

      return Response.json({ goal: { ...goal, status: nextStatus }, journal: journal || [] });
    }

    // 3. Record Step Journal & Completion
    if (request.method === 'POST' && url.pathname === '/api/lease/step') {
      const body = await request.json();
      const now = Date.now();

      await env.DB.prepare(
        `INSERT INTO journal_entries (goal_id, step_number, worker_id, core_used, model_used, outcome, summary, git_commit, created_at)
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
