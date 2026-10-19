import { existsSync, lstatSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { commandExists, runCliProcess } from './spawn-cli.js';

/**
 * Zero-API-Key Local Auth & Direct Session Router
 * Inspired by Grok Bot 0.18 (`provider-session.ts`, `codex-direct-responses.ts`,
 * `inference-router-local.ts`) and Neko-Bot (`chatgpt-auth.ts`, `opencode-auth.ts`).
 *
 * Reuses existing local CLI logins (`codex login`, `claude login`, `opencode auth login`, `Antigravity`)
 * so the user NEVER needs to buy or paste separate metered API keys.
 */

export function getCodexAuthPath() {
  const codexHome = process.env.CODEX_HOME?.trim() || join(homedir(), '.codex');
  return join(codexHome, 'auth.json');
}

export function getClaudeCredentialsPath() {
  return join(homedir(), '.claude', '.credentials.json');
}

export function getOpenCodeAuthPath() {
  const localShare = process.env.LOCALAPPDATA || join(homedir(), '.local', 'share');
  const candidates = [
    join(localShare, 'opencode', 'auth.json'),
    join(homedir(), '.local', 'share', 'opencode', 'auth.json'),
    join(homedir(), '.neko-core', 'opencode-auth.json')
  ];
  return candidates.find((p) => existsSync(p)) || candidates[0];
}

/**
 * Reads local ~/.codex/auth.json created by `codex login` (ChatGPT OAuth mode).
 */
export function loadCodexCredentials() {
  const authPath = getCodexAuthPath();
  if (!existsSync(authPath)) return null;
  try {
    const stat = lstatSync(authPath);
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    const parsed = JSON.parse(readFileSync(authPath, 'utf8'));
    const accessToken = parsed?.tokens?.access_token;
    const refreshToken = parsed?.tokens?.refresh_token;
    const idToken = parsed?.tokens?.id_token;
    const accountId = parsed?.tokens?.account_id;
    if (
      parsed?.auth_mode !== 'chatgpt' ||
      typeof accessToken !== 'string' || !accessToken ||
      typeof refreshToken !== 'string' || !refreshToken ||
      typeof accountId !== 'string' || !accountId
    ) {
      return null;
    }
    return {
      accessToken,
      refreshToken,
      idToken: typeof idToken === 'string' ? idToken : '',
      accountId,
      path: authPath,
      document: parsed
    };
  } catch {
    return null;
  }
}

function extractJwtAudience(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
    const aud = payload?.aud;
    if (typeof aud === 'string') return aud;
    if (Array.isArray(aud)) return aud.find((item) => typeof item === 'string') || null;
    return null;
  } catch {
    return null;
  }
}

/**
 * Automatically refreshes ~/.codex/auth.json OAuth token on HTTP 401
 * using https://auth.openai.com/oauth/token (same mechanism as Grok Bot & Neko-Bot).
 */
export async function refreshCodexCredentials(current, fetchImpl = fetch) {
  const clientId = extractJwtAudience(current.idToken) || 'app_EMoamEEZ73f0CkXaXp7hrann';
  const res = await fetchImpl('https://auth.openai.com/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: current.refreshToken,
      client_id: clientId
    })
  });
  if (!res.ok) {
    throw new Error(`Codex OAuth refresh failed (HTTP ${res.status}). Run "codex login" again.`);
  }
  const payload = await res.json();
  if (typeof payload?.access_token !== 'string' || !payload.access_token) {
    throw new Error('Codex OAuth refresh returned no access_token.');
  }
  const updatedDoc = {
    ...current.document,
    tokens: {
      ...current.document.tokens,
      access_token: payload.access_token,
      refresh_token: payload.refresh_token || current.refreshToken,
      id_token: payload.id_token || current.idToken
    },
    last_refresh: new Date().toISOString()
  };
  mkdirSync(dirname(current.path), { recursive: true });
  const tmp = `${current.path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(updatedDoc, null, 2)}\n`, 'utf8');
  renameSync(tmp, current.path);
  return loadCodexCredentials();
}

/**
 * Direct Codex Responses transport (`https://chatgpt.com/backend-api/codex/responses`)
 * using the local ChatGPT/Codex login session, supporting multi-step tool execution!
 */
export async function runCodexDirectTurn({
  prompt,
  instructions = 'You are an autonomous coding teammate orchestrated by BotAutoTask.',
  model = 'gpt-5.4',
  tools = [],
  executeTool = null,
  maxSteps = 6,
  fetchImpl = fetch
}) {
  let creds = loadCodexCredentials();
  if (!creds) {
    throw new Error('Codex is not signed in with ChatGPT. Run `codex login` first.');
  }

  const authedFetch = async (url, init) => {
    const send = () => {
      const headers = new Headers(init?.headers || {});
      headers.set('authorization', `Bearer ${creds.accessToken}`);
      headers.set('ChatGPT-Account-Id', creds.accountId);
      return fetchImpl(url, { ...init, headers });
    };
    let res = await send();
    if (res.status === 401) {
      creds = await refreshCodexCredentials(creds, fetchImpl);
      res = await send();
    }
    return res;
  };

  const toolsByName = new Map(tools.map((t) => [t.name, t]));
  const wireTools =
    tools.length > 0
      ? tools.map((t) => ({
          type: 'function',
          name: t.name,
          description: t.description || '',
          parameters: t.inputSchema || t.parameters || { type: 'object', properties: {} },
          strict: false
        }))
      : undefined;

  let input = [{ role: 'user', content: prompt }];
  let finalText = '';

  for (let step = 0; step < maxSteps; step++) {
    const res = await authedFetch('https://chatgpt.com/backend-api/codex/responses', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
        'user-agent': 'botautotask-router/1'
      },
      body: JSON.stringify({
        model,
        instructions,
        input,
        ...(wireTools ? { tools: wireTools, tool_choice: 'auto', parallel_tool_calls: true } : {}),
        stream: true,
        store: false
      })
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Codex direct response failed (${res.status}): ${detail.slice(0, 500)}`);
    }

    const rawSse = await res.text();
    const observedOutput = [];
    let completed = null;

    for (const block of rawSse.split('\n\n')) {
      const dataLines = block
        .split(/\r?\n/)
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart());
      const dataStr = dataLines.join('\n').trim();
      if (!dataStr || dataStr === '[DONE]') continue;
      let evt;
      try {
        evt = JSON.parse(dataStr);
      } catch {
        continue;
      }
      if (evt.type === 'response.output_text.delta' && typeof evt.delta === 'string') {
        finalText += evt.delta;
      } else if (evt.type === 'response.output_item.done' && evt.item) {
        observedOutput.push(evt.item);
      } else if (evt.type === 'response.completed' && evt.response) {
        completed = evt.response;
      }
    }

    const outputItems =
      Array.isArray(completed?.output) && completed.output.length > 0
        ? completed.output
        : observedOutput;
    const functionCalls = outputItems.filter(
      (item) => item?.type === 'function_call' && typeof item.name === 'string'
    );

    if (functionCalls.length === 0) {
      return { text: finalText, model, provider: 'codex-direct' };
    }
    if (!executeTool) {
      return { text: finalText, model, provider: 'codex-direct', pendingToolCalls: functionCalls };
    }

    const toolOutputs = [];
    for (const call of functionCalls) {
      const def = toolsByName.get(call.name);
      if (!def) {
        toolOutputs.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify({ isError: true, error: `Unknown tool: ${call.name}` })
        });
        continue;
      }
      let parsedArgs = {};
      try {
        parsedArgs = call.arguments ? JSON.parse(call.arguments) : {};
      } catch {}
      try {
        const result = await executeTool(def, parsedArgs, call.call_id);
        toolOutputs.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify(result ?? null)
        });
      } catch (err) {
        toolOutputs.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify({ isError: true, error: err.message || String(err) })
        });
      }
    }
    input = [...input, ...outputItems, ...toolOutputs];
  }

  return { text: finalText, model, provider: 'codex-direct' };
}

/**
 * Inspects local sign-in status across all supported agent CLIs & IDEs without requiring API keys.
 */
export async function getZeroKeyAuthStatus() {
  const [hasClaudeCli, hasCodexCli, hasOpenCodeCli, hasAgyCli] = await Promise.all([
    commandExists('claude'),
    commandExists('codex'),
    commandExists('opencode'),
    commandExists('agy')
  ]);

  const codexCreds = loadCodexCredentials();
  const hasClaudeCreds =
    existsSync(getClaudeCredentialsPath()) ||
    existsSync(join(homedir(), '.claude.json')) ||
    Boolean(process.env.ANTHROPIC_API_KEY);
  const openCodeAuthPath = getOpenCodeAuthPath();
  const hasOpenCodeAuth = existsSync(openCodeAuthPath);
  const winAgyExe = join(
    process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'),
    'Programs',
    'Antigravity',
    'Antigravity.exe'
  );
  const hasAgyApp = hasAgyCli || existsSync(winAgyExe);

  return {
    codex: {
      installed: hasCodexCli || Boolean(codexCreds),
      authenticated: Boolean(codexCreds) || Boolean(process.env.OPENAI_API_KEY),
      authMode: codexCreds ? 'chatgpt-oauth-session' : process.env.OPENAI_API_KEY ? 'api-key' : 'none',
      accountId: codexCreds?.accountId || null,
      loginCommand: 'codex login'
    },
    claude: {
      installed: hasClaudeCli,
      authenticated: hasClaudeCli && hasClaudeCreds,
      authMode: existsSync(getClaudeCredentialsPath()) ? 'claude-oauth-session' : 'cli-session',
      loginCommand: 'claude login'
    },
    opencode: {
      installed: hasOpenCodeCli,
      authenticated: hasOpenCodeCli,
      authMode: hasOpenCodeAuth ? 'opencode-auth+free-zen' : 'free-models-ready',
      loginCommand: 'opencode auth login'
    },
    antigravity: {
      installed: hasAgyApp,
      authenticated: hasAgyApp,
      authMode: 'ide-built-in-session',
      loginCommand: 'Open Antigravity IDE'
    }
  };
}
