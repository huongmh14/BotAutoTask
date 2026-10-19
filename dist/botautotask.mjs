#!/usr/bin/env node
/**
 * BotAutoTask — Single-File Standalone Bundle (Zero Dependencies)
 * Can be downloaded and executed directly on any machine with Node.js >= 20 or Bun.
 */
import { exec, execFile, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync, statSync, lstatSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = __dirname;

// --- MODULE: src/core/types.js ---
/**
 * Core contracts and output tag parser for BotAutoTask.
 * Keeps Orchestrator completely decoupled from individual AI Harnesses.
 */

const OUTCOME = Object.freeze({
  STEP_DONE: 'STEP_DONE',
  GOAL_COMPLETED: 'GOAL_COMPLETED',
  RATE_LIMITED: 'RATE_LIMITED',
  ERROR: 'ERROR'
});

/**
 * Extracts <OMNIGOAL_STATUS> and <OMNIGOAL_SUMMARY> tags from agent CLI output.
 * Gracefully falls back to trailing non-empty lines if the agent didn't print XML tags.
 * @param {string} stdout
 * @returns {{ completed: boolean, summary: string }}
 */
function parseStepTags(stdout = '') {
  const text = String(stdout || '');
  const statusMatch = text.match(/<OMNIGOAL_STATUS>\s*(COMPLETED|DONE)\s*<\/OMNIGOAL_STATUS>/i);
  const summaryMatch = text.match(/<OMNIGOAL_SUMMARY>([\s\S]*?)<\/OMNIGOAL_SUMMARY>/i);

  const completed = Boolean(statusMatch);
  if (summaryMatch && summaryMatch[1].trim()) {
    return {
      completed,
      summary: summaryMatch[1].trim()
    };
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('<OMNIGOAL_'));

  const fallbackSummary = lines.slice(-3).join(' | ').slice(0, 500) || 'Step executed without output summary.';
  return {
    completed,
    summary: fallbackSummary
  };
}

/**
 * Builds a self-contained handover prompt so any core (OpenCode, Antigravity, Claude, Neko Core, or custom)
 * can pick up seamlessly from previous steps in the journal.
 */
function buildHandoverPrompt(goal, journal = []) {
  const historyLines =
    journal.length === 0
      ? 'No previous steps executed yet.'
      : journal
          .slice(-8)
          .map(
            (entry, idx) =>
              `Step ${entry.step_number ?? idx + 1} [${entry.core_used || entry.harnessId}/${entry.model_used || entry.modelId} -> ${entry.outcome}]: ${entry.summary}`
          )
          .join('\n');

  const acceptance = goal.acceptance_cmd
    ? `\nAcceptance Verification Command: \`${goal.acceptance_cmd}\` (run this to verify before declaring completion).`
    : '';

  return [
    `# TARGET GOAL: ${goal.title || goal.id}`,
    goal.target_prompt,
    acceptance,
    `\n## DURABLE JOURNAL (Previous Cores' Progress):`,
    historyLines,
    `\n## INSTRUCTIONS FOR THIS STEP:`,
    `1. Continue from the journal state above without redoing completed work.`,
    `2. Make concrete progress in the workspace and verify your changes.`,
    `3. At the end of your response, always output:`,
    `   <OMNIGOAL_SUMMARY>1-2 sentence summary of what you achieved in this step</OMNIGOAL_SUMMARY>`,
    `4. ONLY if the entire TARGET GOAL is 100% finished and verified, also output:`,
    `   <OMNIGOAL_STATUS>COMPLETED</OMNIGOAL_STATUS>`
  ].join('\n');
}


// --- MODULE: src/core/rate-limit-detector.js ---
/**
 * Detects rate limit, quota exhaustion, credit depletion, or model overload across CLI harnesses.
 */

const RATE_LIMIT_PATTERNS = [
  /\b429\b/i,
  /too many requests/i,
  /rate[_\s-]?limit/i,
  /quota[_\s-]?exceeded/i,
  /exceeded your (current )?quota/i,
  /usage[_\s-]?limit/i,
  /resource[_\s-]?exhausted/i,
  /credit balance is too low/i,
  /insufficient[_\s-]?quota/i,
  /tokens per minute/i,
  /requests per minute/i,
  /requests per day/i,
  /daily limit/i,
  /model is currently overloaded/i,
  /try again in \d+\s*(s|sec|m|min|h|hour)/i
];

/**
 * @param {string} output Combined stdout + stderr from the agent process
 * @param {number} [exitCode=0] Process exit code
 * @returns {boolean}
 */
function isRateLimitError(output = '', exitCode = 0) {
  const text = String(output || '');
  if (!text) return false;
  return RATE_LIMIT_PATTERNS.some((regex) => regex.test(text));
}


// --- MODULE: src/core/spawn-cli.js ---

function quoteArg(arg, isWin) {
  const s = String(arg ?? '').replace(/\r?\n/g, ' ');
  if (!/[\s"&|<>^()]/.test(s)) return s;
  if (isWin) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/**
 * Fast, zero-overhead check whether a CLI binary exists on system PATH.
 * @param {string} binary
 * @returns {boolean}
 */
function commandExists(binary) {
  if (!binary) return false;
  if (existsSync(binary)) return true;
  const isWin = process.platform === 'win32';
  const pathEnv = process.env.PATH || process.env.Path || '';
  const sep = isWin ? ';' : ':';
  const dirs = pathEnv.split(sep).filter(Boolean);
  const exts = isWin ? ['', '.cmd', '.exe', '.bat', '.ps1'] : [''];

  for (const dir of dirs) {
    for (const ext of exts) {
      if (existsSync(join(dir, binary + ext))) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Safely executes a CLI command across Windows and POSIX without Node 24 DEP0190 warnings
 * and properly resolves .cmd/.ps1/.exe shims (opencode, agy, claude, codex).
 * @param {string} binary
 * @param {string[]} args
 * @param {{ cwd?: string, timeoutMs?: number }} [options]
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number }>}
 */
function runCliProcess(binary, args = [], { cwd = process.cwd(), timeoutMs = 15 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === 'win32';
    const fullCommand = [quoteArg(binary, isWin), ...args.map((a) => quoteArg(a, isWin))].join(' ');

    const child = spawn(fullCommand, [], {
      cwd,
      shell: true,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      const err = new Error(`Command timed out after ${timeoutMs}ms`);
      err.stdout = stdout;
      err.stderr = stderr;
      err.code = 124;
      reject(err);
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      err.stdout = stdout;
      err.stderr = stderr;
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr, exitCode: 0 });
      } else {
        const err = new Error(`Command exited with code ${code}`);
        err.stdout = stdout;
        err.stderr = stderr;
        err.code = code ?? 1;
        reject(err);
      }
    });
  });
}


// --- MODULE: src/core/log-reader.js ---

/**
 * Strategy 2 & 1 Log Reader:
 * 1. Reads and parses Antigravity IDE's real-time `transcript.jsonl` logs.
 * 2. Parses `opencode run --format json` NDJSON event streams.
 * 3. Manages `.botautotask/DIRECTIVE.md` & `RESULT.md` File-Inbox Bridge for live IDE sessions.
 */

function summarizeToolCall(tc) {
  if (!tc || typeof tc !== 'object') return String(tc);
  const name = tc.name || tc.tool || tc.type || 'tool';
  const args = tc.args || tc.arguments || tc.input || {};
  const target =
    args.TargetFile ||
    args.AbsolutePath ||
    args.filePath ||
    args.path ||
    args.CommandLine ||
    args.command ||
    args.query ||
    '';
  return target ? `${name}(${String(target).slice(0, 80)})` : name;
}

/**
 * Parses Antigravity IDE's `.system_generated/logs/transcript.jsonl` content.
 * @param {string} jsonlText
 */
function parseAntigravityTranscript(jsonlText = '') {
  const lines = String(jsonlText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let lastStatus = 'UNKNOWN';
  let lastUserPrompt = '';
  let lastAgentResponse = '';
  let lastThinking = '';
  const toolCalls = [];
  let hasError = false;

  for (const line of lines) {
    let step;
    try {
      step = JSON.parse(line);
    } catch {
      continue;
    }

    if (step.status) {
      lastStatus = step.status;
    }
    if (step.status === 'ERROR') {
      hasError = true;
    }

    if (step.type === 'USER_INPUT' && step.content) {
      lastUserPrompt = String(step.content).trim();
      // Reset per-turn tool calls when a new user input starts
      toolCalls.length = 0;
    }

    if (step.type === 'PLANNER_RESPONSE') {
      if (step.content) {
        lastAgentResponse = String(step.content).trim();
      }
      if (step.thinking) {
        lastThinking = String(step.thinking).trim();
      }
      if (Array.isArray(step.tool_calls)) {
        for (const tc of step.tool_calls) {
          toolCalls.push(summarizeToolCall(tc));
        }
      }
    }
  }

  return {
    stepCount: lines.length,
    lastStatus,
    lastUserPrompt,
    lastAgentResponse,
    lastThinking,
    toolCalls,
    hasError
  };
}

/**
 * Finds the most recent (or specified) Antigravity conversation transcript.jsonl on disk.
 */
function findLatestAntigravityTranscript({
  brainDir = join(homedir(), '.gemini', 'antigravity', 'brain'),
  conversationId = null
} = {}) {
  if (!existsSync(brainDir)) return null;

  if (conversationId) {
    const directPath = join(brainDir, conversationId, '.system_generated', 'logs', 'transcript.jsonl');
    if (existsSync(directPath)) {
      const content = readFileSync(directPath, 'utf8');
      return {
        conversationId,
        transcriptPath: directPath,
        summary: parseAntigravityTranscript(content)
      };
    }
    return null;
  }

  const entries = readdirSync(brainDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  let latest = null;

  for (const dir of entries) {
    const candidate = join(brainDir, dir.name, '.system_generated', 'logs', 'transcript.jsonl');
    if (!existsSync(candidate)) continue;
    try {
      const st = statSync(candidate);
      if (!latest || st.mtimeMs > latest.mtimeMs) {
        latest = { conversationId: dir.name, transcriptPath: candidate, mtimeMs: st.mtimeMs };
      }
    } catch {}
  }

  if (!latest) return null;
  const content = readFileSync(latest.transcriptPath, 'utf8');
  return {
    conversationId: latest.conversationId,
    transcriptPath: latest.transcriptPath,
    summary: parseAntigravityTranscript(content)
  };
}

/**
 * Parses NDJSON output from `opencode run --format json`.
 * @param {string} ndjsonText
 */
function parseOpenCodeJsonStream(ndjsonText = '') {
  const lines = String(ndjsonText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let sessionId = null;
  const toolCalls = [];
  const textChunks = [];
  const rawLines = [];
  let hasError = false;

  for (const line of lines) {
    if (!line.startsWith('{')) {
      rawLines.push(line);
      continue;
    }
    try {
      const evt = JSON.parse(line);
      if (evt.sessionID || evt.sessionId || evt.session_id) {
        sessionId = evt.sessionID || evt.sessionId || evt.session_id;
      }
      if (evt.type === 'error' || evt.error) {
        hasError = true;
        textChunks.push(String(evt.error?.message || evt.message || JSON.stringify(evt)));
      }
      if (evt.type?.includes('tool') || evt.tool || evt.name) {
        toolCalls.push(summarizeToolCall(evt));
      }
      if (typeof evt.text === 'string') {
        textChunks.push(evt.text);
      } else if (typeof evt.content === 'string') {
        textChunks.push(evt.content);
      } else if (typeof evt.part?.text === 'string') {
        textChunks.push(evt.part.text);
      }
    } catch {
      rawLines.push(line);
    }
  }

  const textOutput = (textChunks.length > 0 ? textChunks.join('') : rawLines.join('\n')).trim();
  return {
    sessionId,
    toolCalls,
    textOutput,
    hasError
  };
}

/**
 * Writes `.botautotask/DIRECTIVE.md` so an active IDE session (Antigravity / Cursor / VS Code)
 * can pick up the Supervisor's next instruction automatically.
 */
function writeIdeDirectiveBridge(workspaceDir, { goalId, stepNumber, directive, reasoning = '' }) {
  const bridgeDir = join(workspaceDir, '.botautotask');
  if (!existsSync(bridgeDir)) {
    mkdirSync(bridgeDir, { recursive: true });
  }
  const mdPath = join(bridgeDir, 'DIRECTIVE.md');
  const content = [
    `# BotAutoTask Supervisor Directive (Step #${stepNumber})`,
    `- **Goal ID:** \`${goalId}\``,
    `- **Timestamp:** ${new Date().toISOString()}`,
    reasoning ? `- **Supervisor Analysis:** ${reasoning}` : '',
    '',
    '## Action Required by IDE Agent',
    directive,
    '',
    '---',
    '*When finished, update `.botautotask/RESULT.md` or output `<OMNIGOAL_SUMMARY>...</OMNIGOAL_SUMMARY>`.*'
  ]
    .filter(Boolean)
    .join('\n');

  writeFileSync(mdPath, content, 'utf8');
  return mdPath;
}


// --- MODULE: src/core/auth-bridge.js ---

/**
 * Zero-API-Key Local Auth & Direct Session Router
 * Inspired by Grok Bot 0.18 (`provider-session.ts`, `codex-direct-responses.ts`,
 * `inference-router-local.ts`) and Neko-Bot (`chatgpt-auth.ts`, `opencode-auth.ts`).
 *
 * Reuses existing local CLI logins (`codex login`, `claude login`, `opencode auth login`, `Antigravity`)
 * so the user NEVER needs to buy or paste separate metered API keys.
 */

function getCodexAuthPath() {
  const codexHome = process.env.CODEX_HOME?.trim() || join(homedir(), '.codex');
  return join(codexHome, 'auth.json');
}

function getClaudeCredentialsPath() {
  return join(homedir(), '.claude', '.credentials.json');
}

function getOpenCodeAuthPath() {
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
function loadCodexCredentials() {
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
async function refreshCodexCredentials(current, fetchImpl = fetch) {
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
async function runCodexDirectTurn({
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
async function getZeroKeyAuthStatus() {
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


// --- MODULE: src/core/model-discovery.js ---

/**
 * Dynamic Free-Model Discovery & Ranker.
 * Discovers free/idle models from OpenCode CLI (`opencode models`), OpenRouter public API,
 * and registered harnesses, then scores them so the strongest free models (e.g. deepseek-v4.1-flash-free,
 * gpt-6-luna, freemodel/claude-opus-4-8, freemodel/gpt-5.3-codex, gemini-2.5-pro) are always chosen first.
 */
class FreeModelRanker {
  constructor(config = {}, options = {}) {
    this.priorityModels = config.priorityModels || [
      'deepseek-v4.1-flash-free',
      'gpt-6-luna',
      'gpt-5.6-luna',
      'gpt-luna',
      'freemodel/claude-opus-4-8',
      'freemodel/claude-sonnet-4-6',
      'freemodel/gpt-5.3-codex',
      'opencode/glm-5.3-flash-free',
      'opencode/nemotron-3-ultra-free',
      'google/gemini-2.5-pro',
      'google/gemini-2.5-flash'
    ];
    this.defaultCooldownMs = config.cooldownMs ?? 30 * 60 * 1000;
    this.cooldowns = new Map(); // key: `${harnessId}:${modelId}` -> expiresAtMs
    this.runCliFn = options.runCliFn || runCliProcess;
    this.fetchFn = options.fetchFn || globalThis.fetch;
  }

  _key(harnessId, modelId) {
    return `${harnessId}:${modelId}`;
  }

  markCooldown(harnessId, modelId, durationMs = this.defaultCooldownMs, nowMs = Date.now()) {
    this.cooldowns.set(this._key(harnessId, modelId), nowMs + durationMs);
  }

  isCoolingDown(harnessId, modelId, nowMs = Date.now()) {
    const expires = this.cooldowns.get(this._key(harnessId, modelId));
    if (!expires) return false;
    if (nowMs >= expires) {
      this.cooldowns.delete(this._key(harnessId, modelId));
      return false;
    }
    return true;
  }

  /**
   * Computes a priority score for a model ID. Higher = preferred earlier.
   * @param {string} modelId
   * @param {boolean} [isFree=true]
   * @returns {number}
   */
  scoreModelId(modelId = '', isFree = true) {
    const id = String(modelId).toLowerCase();
    let score = isFree ? 100 : 20;

    for (let i = 0; i < this.priorityModels.length; i++) {
      const target = this.priorityModels[i].toLowerCase();
      if (id === target || id.endsWith('/' + target) || id.includes(target)) {
        score += 1000 - i * 40;
        break;
      }
    }

    if (id.includes('deepseek') && id.includes('v4')) score += 300;
    if (id.includes('luna')) score += 280;
    if (id.includes('freemodel/')) score += 260;
    if (id.includes('free')) score += 150;
    if (id.includes('coder') || id.includes('codex') || id.includes('claude')) score += 100;
    if (id.includes('gemini-2.5-pro')) score += 90;
    if (id.includes('r1') || id.includes('flash')) score += 60;

    return score;
  }

  /**
   * Filters out cooling-down models and ranks available candidates highest-first.
   */
  rankCandidates(candidates = [], nowMs = Date.now()) {
    return candidates
      .filter((c) => !this.isCoolingDown(c.harnessId, c.modelId, nowMs))
      .map((c) => ({
        ...c,
        score: this.scoreModelId(c.modelId, c.isFree ?? true)
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Queries `opencode models` CLI to discover locally available free/configured models.
   */
  async discoverOpenCodeCliModels(binary = 'opencode') {
    try {
      const { stdout } = await this.runCliFn(binary, ['models'], { timeoutMs: 8000 });
      const lines = String(stdout || '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && /^[a-z0-9_.-]+\/[a-z0-9_./:-]+$/i.test(l));

      if (lines.length === 0) throw new Error('No model lines parsed');

      return lines.map((modelId) => ({
        harnessId: 'opencode',
        modelId,
        isFree: /free|freemodel\/|opencode\/|luna|pickle|grok|gemini/i.test(modelId)
      }));
    } catch {
      return [
        { harnessId: 'opencode', modelId: 'opencode/deepseek-v4.1-flash-free', isFree: true },
        { harnessId: 'opencode', modelId: 'openai/gpt-6-luna', isFree: true },
        { harnessId: 'opencode', modelId: 'freemodel/claude-opus-4-8', isFree: true },
        { harnessId: 'opencode', modelId: 'freemodel/gpt-5.3-codex', isFree: true }
      ];
    }
  }

  /**
   * Queries OpenRouter public catalog for 100% free models (pricing.prompt === "0").
   */
  async discoverOpenRouterFreeModels() {
    if (!this.fetchFn) return [];
    try {
      const res = await this.fetchFn('https://openrouter.ai/api/v1/models', {
        signal: AbortSignal.timeout(6000)
      });
      if (!res.ok) return [];
      const data = await res.json();
      const models = Array.isArray(data?.data) ? data.data : [];
      return models
        .filter(
          (m) =>
            String(m?.pricing?.prompt) === '0' &&
            String(m?.pricing?.completion) === '0' &&
            (m?.context_length ?? 0) >= 32000
        )
        .slice(0, 15)
        .map((m) => ({
          harnessId: 'opencode',
          modelId: `openrouter/${m.id}`,
          isFree: true
        }));
    } catch {
      return [];
    }
  }
}


// --- MODULE: src/harnesses/custom-cmd-harness.js ---



/**
 * Pluggable Custom Command Harness.
 * Allows swapping Neko Core or adding any future self-developed AI core purely via JSON configuration
 * (`commandTemplate`: e.g. `my-core run --model {{model}} --prompt-file {{prompt_file}}`).
 */
class CustomCmdHarness {
  constructor(def = {}) {
    this.id = def.id || 'custom-cmd';
    this.models = def.models || [`${this.id}-default`];
    this.commandTemplate = def.commandTemplate || '';
    this.checkCommand = def.checkCommand || null;
  }

  async isAvailable() {
    if (!this.commandTemplate) return false;
    if (!this.checkCommand) return true;
    try {
      await execAsync(this.checkCommand, { timeout: 4000, windowsHide: true });
      return true;
    } catch {
      return false;
    }
  }

  async discoverModels() {
    return this.models.map((m) => ({
      harnessId: this.id,
      modelId: m,
      isFree: true
    }));
  }

  async executeStep({ goal, journal = [], workspaceDir = process.cwd(), modelId }) {
    const prompt = buildHandoverPrompt(goal, journal);
    const tempFile = join(tmpdir(), `botautotask-${goal.id || 'step'}-${Date.now()}.txt`);
    writeFileSync(tempFile, prompt, 'utf8');

    const cmd = this.commandTemplate
      .replaceAll('{{model}}', modelId || this.models[0] || '')
      .replaceAll('{{prompt_file}}', tempFile)
      .replaceAll('{{workspace}}', workspaceDir);

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: workspaceDir,
        timeout: 10 * 60 * 1000,
        windowsHide: true
      });
      const combined = `${stdout || ''}\n${stderr || ''}`;
      if (isRateLimitError(combined, 0)) {
        return {
          outcome: OUTCOME.RATE_LIMITED,
          summary: `Rate limit on ${this.id}/${modelId}`,
          harnessId: this.id,
          modelId
        };
      }
      const parsed = parseStepTags(stdout || stderr);
      return {
        outcome: parsed.completed ? OUTCOME.GOAL_COMPLETED : OUTCOME.STEP_DONE,
        summary: parsed.summary,
        harnessId: this.id,
        modelId
      };
    } catch (err) {
      const combined = `${err.stdout || ''}\n${err.stderr || ''}\n${err.message || ''}`;
      if (isRateLimitError(combined, err.code ?? 1)) {
        return {
          outcome: OUTCOME.RATE_LIMITED,
          summary: `Rate limit hit on ${this.id}/${modelId}`,
          harnessId: this.id,
          modelId
        };
      }
      return {
        outcome: OUTCOME.ERROR,
        summary: combined.slice(-400).trim() || `Execution failed on ${this.id}`,
        harnessId: this.id,
        modelId
      };
    } finally {
      try {
        unlinkSync(tempFile);
      } catch {}
    }
  }
}


// --- MODULE: src/harnesses/opencode-harness.js ---

/**
 * OpenCode CLI Harness (`opencode run --format json --auto -m <model> <prompt>`).
 * Supports Strategy 1: structured NDJSON event stream parsing, session continuation (`--session`),
 * and optional attachment to a headless `opencode serve` instance (`--attach`).
 */
class OpenCodeHarness {
  constructor({
    binary = 'opencode',
    ranker = null,
    useJsonFormat = true,
    attachUrl = process.env.OPENCODE_ATTACH_URL || null
  } = {}) {
    this.id = 'opencode';
    this.binary = binary;
    this.ranker = ranker;
    this.useJsonFormat = useJsonFormat;
    this.attachUrl = attachUrl;
    this.lastSessionId = null;
  }

  async isAvailable() {
    return commandExists(this.binary);
  }

  async discoverModels() {
    if (!this.ranker) {
      return [
        { harnessId: this.id, modelId: 'opencode/deepseek-v4.1-flash-free', isFree: true },
        { harnessId: this.id, modelId: 'freemodel/claude-sonnet-4-6', isFree: true }
      ];
    }
    const [cliModels, orModels] = await Promise.all([
      this.ranker.discoverOpenCodeCliModels(this.binary),
      this.ranker.discoverOpenRouterFreeModels()
    ]);
    const seen = new Set();
    const merged = [];
    for (const item of [...cliModels, ...orModels]) {
      if (!seen.has(item.modelId)) {
        seen.add(item.modelId);
        merged.push({ ...item, harnessId: this.id });
      }
    }
    return merged;
  }

  async executeStep({ goal, journal = [], workspaceDir = process.cwd(), modelId }) {
    const prompt = buildHandoverPrompt(goal, journal);
    const args = ['run'];
    if (this.useJsonFormat) {
      args.push('--format', 'json');
    }
    if (this.attachUrl) {
      args.push('--attach', this.attachUrl);
    }
    if (this.lastSessionId && goal.reuse_session) {
      args.push('--session', this.lastSessionId);
    }
    if (modelId) {
      args.push('-m', modelId);
    }
    args.push(prompt);

    try {
      const { stdout, stderr } = await runCliProcess(this.binary, args, {
        cwd: workspaceDir,
        timeoutMs: 15 * 60 * 1000
      });
      const combined = `${stdout || ''}\n${stderr || ''}`;
      if (isRateLimitError(combined, 0)) {
        return {
          outcome: OUTCOME.RATE_LIMITED,
          summary: `Rate limit on opencode (${modelId})`,
          harnessId: this.id,
          modelId,
          rawLog: combined.slice(-1000)
        };
      }

      const streamParsed = this.useJsonFormat
        ? parseOpenCodeJsonStream(stdout || stderr)
        : { textOutput: stdout || stderr, toolCalls: [], sessionId: null };

      if (streamParsed.sessionId) {
        this.lastSessionId = streamParsed.sessionId;
      }

      const parsed = parseStepTags(streamParsed.textOutput || stdout || stderr);
      const rawLog = [
        streamParsed.toolCalls.length ? `Tools: ${streamParsed.toolCalls.join(', ')}` : '',
        (streamParsed.textOutput || stdout || '').slice(-800)
      ]
        .filter(Boolean)
        .join('\n');

      return {
        outcome: parsed.completed ? OUTCOME.GOAL_COMPLETED : OUTCOME.STEP_DONE,
        summary: parsed.summary,
        harnessId: this.id,
        modelId,
        sessionId: this.lastSessionId,
        rawLog
      };
    } catch (err) {
      const combined = `${err.stdout || ''}\n${err.stderr || ''}\n${err.message || ''}`;
      if (isRateLimitError(combined, err.code ?? 1)) {
        return {
          outcome: OUTCOME.RATE_LIMITED,
          summary: `Rate limit hit on opencode (${modelId})`,
          harnessId: this.id,
          modelId,
          rawLog: combined.slice(-1000)
        };
      }
      return {
        outcome: OUTCOME.ERROR,
        summary: combined.slice(-400).trim() || `OpenCode failed on ${modelId}`,
        harnessId: this.id,
        modelId,
        rawLog: combined.slice(-1000)
      };
    }
  }
}


// --- MODULE: src/harnesses/antigravity-harness.js ---

/**
 * Antigravity Harness (`agy` / `antigravity` / `agentapi new-conversation` + `transcript.jsonl` reader).
 * Supports Strategy 2: writes directives to `.botautotask/DIRECTIVE.md` and reads real-time execution
 * logs from `~/.gemini/antigravity/brain/<conv-id>/.system_generated/logs/transcript.jsonl`.
 */
class AntigravityHarness {
  constructor({ binary = 'agy' } = {}) {
    this.id = 'antigravity';
    this.binary = binary;
  }

  async isAvailable() {
    const localAppData = process.env.LOCALAPPDATA || '';
    const candidates = [
      this.binary,
      'agentapi',
      'antigravity',
      localAppData ? join(localAppData, 'Programs', 'Antigravity', 'bin', 'antigravity.cmd') : '',
      localAppData ? join(localAppData, 'Programs', 'Antigravity', 'Antigravity.exe') : ''
    ].filter(Boolean);

    for (const cmd of candidates) {
      if (commandExists(cmd)) {
        this.activeBinary = cmd;
        return true;
      }
    }
    return false;
  }

  async discoverModels() {
    return [{ harnessId: this.id, modelId: 'agy-default', isFree: true }];
  }

  async executeStep({ goal, journal = [], workspaceDir = process.cwd(), modelId = 'agy-default' }) {
    const prompt = buildHandoverPrompt(goal, journal);
    writeIdeDirectiveBridge(workspaceDir, {
      goalId: goal.id || 'goal',
      stepNumber: (journal?.length || 0) + 1,
      directive: prompt,
      reasoning: 'Dispatched to Antigravity IDE / CLI'
    });

    const bin = this.activeBinary || this.binary;
    const args = bin === 'agentapi' ? ['new-conversation', '--', prompt] : ['--', prompt];

    try {
      const { stdout, stderr } = await runCliProcess(bin, args, {
        cwd: workspaceDir,
        timeoutMs: 15 * 60 * 1000
      });
      const combined = `${stdout || ''}\n${stderr || ''}`;
      const latestTranscript = findLatestAntigravityTranscript();
      const rawLog = latestTranscript
        ? `Tools: ${latestTranscript.summary.toolCalls.join(', ')}\nResponse: ${latestTranscript.summary.lastAgentResponse}`
        : combined.slice(-800);

      if (isRateLimitError(combined, 0)) {
        return {
          outcome: OUTCOME.RATE_LIMITED,
          summary: 'Antigravity quota/rate limit reached',
          harnessId: this.id,
          modelId,
          rawLog
        };
      }
      const parsed = parseStepTags(stdout || latestTranscript?.summary?.lastAgentResponse || stderr);
      return {
        outcome: parsed.completed ? OUTCOME.GOAL_COMPLETED : OUTCOME.STEP_DONE,
        summary: parsed.summary,
        harnessId: this.id,
        modelId,
        rawLog
      };
    } catch (err) {
      const combined = `${err.stdout || ''}\n${err.stderr || ''}\n${err.message || ''}`;
      if (isRateLimitError(combined, err.code ?? 1)) {
        return {
          outcome: OUTCOME.RATE_LIMITED,
          summary: 'Antigravity rate limit reached',
          harnessId: this.id,
          modelId,
          rawLog: combined.slice(-800)
        };
      }
      return {
        outcome: OUTCOME.ERROR,
        summary: combined.slice(-400).trim() || 'Antigravity execution error',
        harnessId: this.id,
        modelId,
        rawLog: combined.slice(-800)
      };
    }
  }
}


// --- MODULE: src/harnesses/claude-codex-harness.js ---

/**
 * Claude Code (`claude -p`) and OpenAI Codex (`codex exec` + Direct ChatGPT Responses OAuth) Harnesses.
 * Supports Zero-API-Key local session routing inspired by Grok Bot 0.18 (`provider-session.ts`)
 * and Neko-Bot (`chatgpt-auth.ts`).
 */
class ClaudeCodexHarness {
  constructor({ id = 'claude', binary = 'claude', mcpServerUrl = null } = {}) {
    this.id = id;
    this.binary = binary;
    this.mcpServerUrl = mcpServerUrl;
  }

  async isAvailable() {
    if (await commandExists(this.binary)) return true;
    if (this.id === 'codex' && loadCodexCredentials() !== null) return true;
    return false;
  }

  async discoverModels() {
    return [
      {
        harnessId: this.id,
        modelId: this.id === 'codex' ? 'codex-default' : 'claude-sonnet',
        isFree: true
      }
    ];
  }

  async executeStep({ goal, journal = [], workspaceDir = process.cwd(), modelId }) {
    const prompt = buildHandoverPrompt(goal, journal);

    // If Codex is signed in via ~/.codex/auth.json and CLI binary is absent (or direct mode is used),
    // route directly over ChatGPT's Codex Responses SSE endpoint (Grok Bot 0.18 pattern).
    if (this.id === 'codex' && !(await commandExists(this.binary)) && loadCodexCredentials()) {
      try {
        const directRes = await runCodexDirectTurn({
          prompt,
          model: modelId && modelId !== 'codex-default' ? modelId : 'gpt-5.4'
        });
        const parsed = parseStepTags(directRes.text || '');
        return {
          outcome: parsed.completed ? OUTCOME.GOAL_COMPLETED : OUTCOME.STEP_DONE,
          summary: parsed.summary,
          rawOutput: directRes.text || '',
          harnessId: this.id,
          modelId
        };
      } catch (err) {
        const msg = err.message || String(err);
        if (isRateLimitError(msg, 1)) {
          return {
            outcome: OUTCOME.RATE_LIMITED,
            summary: 'codex direct OAuth session rate/usage limit reached',
            harnessId: this.id,
            modelId
          };
        }
        return {
          outcome: OUTCOME.ERROR,
          summary: msg.slice(-400),
          harnessId: this.id,
          modelId
        };
      }
    }

    const args =
      this.id === 'codex'
        ? ['exec', '--full-auto', prompt]
        : [
            '-p',
            prompt,
            '--dangerously-skip-permissions',
            ...(this.mcpServerUrl
              ? [
                  '--mcp-config',
                  JSON.stringify({
                    mcpServers: {
                      botautotask_mesh: { type: 'http', url: this.mcpServerUrl }
                    }
                  })
                ]
              : [])
          ];

    try {
      const { stdout, stderr } = await runCliProcess(this.binary, args, {
        cwd: workspaceDir,
        timeoutMs: 15 * 60 * 1000
      });
      const combined = `${stdout || ''}\n${stderr || ''}`;
      if (isRateLimitError(combined, 0)) {
        return {
          outcome: OUTCOME.RATE_LIMITED,
          summary: `${this.id} rate/usage limit reached`,
          harnessId: this.id,
          modelId
        };
      }
      const parsed = parseStepTags(stdout || stderr);
      return {
        outcome: parsed.completed ? OUTCOME.GOAL_COMPLETED : OUTCOME.STEP_DONE,
        summary: parsed.summary,
        rawOutput: combined,
        harnessId: this.id,
        modelId
      };
    } catch (err) {
      const combined = `${err.stdout || ''}\n${err.stderr || ''}\n${err.message || ''}`;
      if (isRateLimitError(combined, err.code ?? 1)) {
        return {
          outcome: OUTCOME.RATE_LIMITED,
          summary: `${this.id} rate/usage limit reached`,
          harnessId: this.id,
          modelId
        };
      }
      return {
        outcome: OUTCOME.ERROR,
        summary: combined.slice(-400).trim() || `${this.id} execution failed`,
        harnessId: this.id,
        modelId
      };
    }
  }
}


// --- MODULE: src/harnesses/neko-core-harness.js ---

/**
 * Pluggable Neko Core Runtime Harness (meiiie/neko-bot compatible HTTP/SSE local control plane).
 * Completely isolated in this adapter so you can swap or replace Neko Core with any future core at any time.
 */
class NekoCoreHarness {
  constructor({ endpoint = 'http://127.0.0.1:19820/api/run', fetchFn = globalThis.fetch } = {}) {
    this.id = 'neko-core';
    this.endpoint = endpoint;
    this.fetchFn = fetchFn;
  }

  async isAvailable() {
    if (!this.fetchFn) return false;
    try {
      const healthUrl = this.endpoint.replace(/\/api\/run$/, '/api/health');
      const res = await this.fetchFn(healthUrl, { signal: AbortSignal.timeout(2500) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async discoverModels() {
    return [{ harnessId: this.id, modelId: 'neko-core-default', isFree: true }];
  }

  async executeStep({ goal, journal = [], workspaceDir = process.cwd(), modelId = 'neko-core-default' }) {
    const prompt = buildHandoverPrompt(goal, journal);
    try {
      const res = await this.fetchFn(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId: goal.id,
          prompt,
          workspaceDir,
          model: modelId
        }),
        signal: AbortSignal.timeout(10 * 60 * 1000)
      });
      const text = await res.text();
      if (!res.ok || isRateLimitError(text, res.status)) {
        return {
          outcome: res.status === 429 || isRateLimitError(text, res.status) ? OUTCOME.RATE_LIMITED : OUTCOME.ERROR,
          summary: text.slice(0, 400) || `Neko Core returned HTTP ${res.status}`,
          harnessId: this.id,
          modelId
        };
      }
      const parsed = parseStepTags(text);
      return {
        outcome: parsed.completed ? OUTCOME.GOAL_COMPLETED : OUTCOME.STEP_DONE,
        summary: parsed.summary,
        harnessId: this.id,
        modelId
      };
    } catch (err) {
      return {
        outcome: OUTCOME.ERROR,
        summary: err.message || 'Neko Core unreachable',
        harnessId: this.id,
        modelId
      };
    }
  }
}


// --- MODULE: src/core/harness-registry.js ---

/**
 * Hexagonal Registry of AI Harnesses (Cores).
 * Decouples the Orchestrator from specific AI implementations:
 * You can register, unregister, or hot-swap Neko Core, OpenCode, Antigravity, Claude,
 * or any future custom AI core via code or JSON config.
 */
class HarnessRegistry {
  constructor() {
    this.harnesses = new Map();
  }

  register(harness) {
    if (!harness || !harness.id) {
      throw new Error('Harness must have an id property');
    }
    this.harnesses.set(harness.id, harness);
  }

  unregister(harnessId) {
    this.harnesses.delete(harnessId);
  }

  get(harnessId) {
    return this.harnesses.get(harnessId);
  }

  list() {
    return Array.from(this.harnesses.values());
  }

  /**
   * Registers or replaces harnesses defined in JSON config (`customHarnesses`).
   */
  registerFromConfig(customConfigs = []) {
    for (const def of customConfigs) {
      if (def.enabled === false) continue;
      this.register(new CustomCmdHarness(def));
    }
  }

  /**
   * Queries all available harnesses, collects their free/idle models, and ranks them
   * via FreeModelRanker. If `preferredSpec` (e.g. "opencode:gpt-luna" or "claude") is given,
   * boosts matching candidates to the top.
   */
  async getCandidates(ranker, preferredSpec = 'auto') {
    const rawCandidates = [];

    for (const harness of this.harnesses.values()) {
      let available = false;
      try {
        available = await harness.isAvailable();
      } catch {
        available = false;
      }
      if (!available) continue;

      let models = [];
      try {
        models = await harness.discoverModels();
      } catch {
        models = [];
      }

      for (const m of models) {
        rawCandidates.push({
          harness,
          harnessId: harness.id,
          modelId: m.modelId,
          isFree: m.isFree ?? true
        });
      }
    }

    const ranked = ranker.rankCandidates(rawCandidates);

    if (preferredSpec && preferredSpec !== 'auto') {
      const specLower = preferredSpec.toLowerCase();
      ranked.sort((a, b) => {
        const aMatch =
          a.harnessId.toLowerCase() === specLower ||
          a.modelId.toLowerCase().includes(specLower) ||
          `${a.harnessId}:${a.modelId}`.toLowerCase().includes(specLower);
        const bMatch =
          b.harnessId.toLowerCase() === specLower ||
          b.modelId.toLowerCase().includes(specLower) ||
          `${b.harnessId}:${b.modelId}`.toLowerCase().includes(specLower);
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return b.score - a.score;
      });
    }

    return ranked;
  }
}


// --- MODULE: src/core/orchestrator.js ---



/**
 * Target-driven Goal Orchestrator.
 * Executes a goal across steps, automatically failing over to the next best free model/core
 * when rate limits hit, and persisting a durable journal of every step.
 */
class GoalOrchestrator {
  constructor({ registry, ranker, onJournalEntry = null, onNotify = null, gitCheckpoint = false } = {}) {
    this.registry = registry;
    this.ranker = ranker;
    this.onJournalEntry = onJournalEntry;
    this.onNotify = onNotify;
    this.gitCheckpoint = gitCheckpoint;
  }

  async _notify(msg) {
    if (this.onNotify) {
      await this.onNotify(msg);
    }
  }

  async _tryGitCheckpoint(workspaceDir, message) {
    if (!this.gitCheckpoint || !workspaceDir) return null;
    try {
      await execFileAsync('git', ['add', '-A'], { cwd: workspaceDir, windowsHide: true });
      await execFileAsync('git', ['commit', '-m', message], { cwd: workspaceDir, windowsHide: true });
      const { stdout } = await execFileAsync('git', ['rev-parse', '--short', 'HEAD'], {
        cwd: workspaceDir,
        windowsHide: true
      });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  async _verifyAcceptance(goal, workspaceDir) {
    if (!goal.acceptance_cmd) return { ok: true, output: '' };
    try {
      const { stdout, stderr } = await execFileAsync(goal.acceptance_cmd, [], {
        cwd: workspaceDir || process.cwd(),
        shell: true,
        timeout: 5 * 60 * 1000,
        windowsHide: true
      });
      return { ok: true, output: `${stdout || ''}\n${stderr || ''}`.trim() };
    } catch (err) {
      return {
        ok: false,
        output: `${err.stdout || ''}\n${err.stderr || ''}\n${err.message || ''}`.slice(-400).trim()
      };
    }
  }

  /**
   * Runs a Goal until GOAL_COMPLETED, max_steps reached, or all cores exhausted.
   */
  async runGoal(goal, existingJournal = []) {
    const journal = [...existingJournal];
    const maxSteps = goal.max_steps ?? 15;
    const workspaceDir = goal.repo_path || process.cwd();
    let stepNumber = goal.current_step ?? journal.length;

    while (stepNumber < maxSteps) {
      stepNumber += 1;
      const candidates = await this.registry.getCandidates(this.ranker, goal.preferred_core || 'auto');

      if (candidates.length === 0) {
        await this._notify(`⚠️ [${goal.title || goal.id}] All AI cores/models are currently on cooldown or unavailable.`);
        return { status: 'PAUSED_LIMIT', stepsRun: stepNumber - 1, journal };
      }

      let stepSucceeded = false;

      for (const candidate of candidates) {
        const { harness, modelId } = candidate;
        const receipt = await harness.executeStep({
          goal,
          journal,
          workspaceDir,
          modelId
        });

        const commitSha = await this._tryGitCheckpoint(
          workspaceDir,
          `chore(botautotask): step ${stepNumber} via ${harness.id}/${modelId}`
        );

        const entry = {
          goal_id: goal.id,
          step_number: stepNumber,
          core_used: harness.id,
          model_used: modelId,
          outcome: receipt.outcome,
          summary: receipt.summary,
          git_commit: commitSha,
          created_at: Date.now()
        };
        journal.push(entry);

        if (this.onJournalEntry) {
          await this.onJournalEntry(entry);
        }

        if (receipt.outcome === OUTCOME.RATE_LIMITED) {
          this.ranker.markCooldown(harness.id, modelId);
          await this._notify(
            `🔄 [${goal.title || goal.id}] Rate limit on ${harness.id}/${modelId}. Switching to next best free model...`
          );
          continue; // Immediately try next ranked candidate in the same step
        }

        if (receipt.outcome === OUTCOME.ERROR) {
          this.ranker.markCooldown(harness.id, modelId, 5 * 60 * 1000);
          await this._notify(
            `⚠️ [${goal.title || goal.id}] Error on ${harness.id}/${modelId}: ${receipt.summary}. Failing over...`
          );
          continue;
        }

        stepSucceeded = true;

        if (receipt.outcome === OUTCOME.GOAL_COMPLETED) {
          const check = await this._verifyAcceptance(goal, workspaceDir);
          if (check.ok) {
            await this._notify(
              `✅ [${goal.title || goal.id}] COMPLETED using ${harness.id}/${modelId}: ${receipt.summary}`
            );
            return { status: 'COMPLETED', stepsRun: stepNumber, journal };
          } else {
            journal.push({
              goal_id: goal.id,
              step_number: stepNumber,
              core_used: 'verifier',
              model_used: 'acceptance_cmd',
              outcome: OUTCOME.STEP_DONE,
              summary: `Acceptance check failed: ${check.output}`,
              created_at: Date.now()
            });
          }
        }

        break; // Move to next step
      }

      if (!stepSucceeded) {
        return { status: 'PAUSED_LIMIT', stepsRun: stepNumber, journal };
      }
    }

    return { status: 'MAX_STEPS_REACHED', stepsRun: stepNumber, journal };
  }
}


// --- MODULE: src/core/supervisor.js ---



/**
 * Strategy 1 + 2 + 4: Supervisor <-> IDE Worker Loop.
 * - Uses a fast, free Supervisor model (e.g. `opencode/deepseek-v4.1-flash-free` or `openai/gpt-5.6-luna`)
 *   to read the IDE Worker's logs (`transcript.jsonl`, JSON event stream, `git diff`, test output).
 * - Evaluates whether the goal is met or generates a concise, surgical next directive for the IDE Worker,
 *   saving ~80% of the IDE's context tokens.
 */
class SupervisorLoop {
  constructor({
    workerHarness,
    workerModelId = 'auto',
    supervisorModelId = 'opencode/deepseek-v4.1-flash-free',
    supervisorBinary = 'opencode',
    supervisorDecideFn = null,
    writeDirectiveBridge = true,
    onNotify = null
  } = {}) {
    this.workerHarness = workerHarness;
    this.workerModelId = workerModelId;
    this.supervisorModelId = supervisorModelId;
    this.supervisorBinary = supervisorBinary;
    this.supervisorDecideFn = supervisorDecideFn;
    this.writeDirectiveBridge = writeDirectiveBridge;
    this.onNotify = onNotify;
  }

  async _notify(msg) {
    if (this.onNotify) await this.onNotify(msg);
  }

  async _collectWorkspaceEvidence(workspaceDir, acceptanceCmd = null) {
    let gitStatus = '';
    let gitDiffStat = '';
    let testOutput = '';
    let testPassed = null;

    try {
      const { stdout: st } = await execFileAsync('git', ['status', '--short'], {
        cwd: workspaceDir,
        windowsHide: true
      });
      gitStatus = st.trim();
      const { stdout: df } = await execFileAsync('git', ['diff', '--stat'], {
        cwd: workspaceDir,
        windowsHide: true
      });
      gitDiffStat = df.trim();
    } catch {}

    if (acceptanceCmd) {
      try {
        const { stdout, stderr } = await execFileAsync(acceptanceCmd, [], {
          cwd: workspaceDir,
          shell: true,
          timeout: 120_000,
          windowsHide: true
        });
        testPassed = true;
        testOutput = `${stdout || ''}\n${stderr || ''}`.slice(-600).trim();
      } catch (err) {
        testPassed = false;
        testOutput = `${err.stdout || ''}\n${err.stderr || ''}\n${err.message || ''}`.slice(-600).trim();
      }
    }

    const agyTranscript = findLatestAntigravityTranscript();
    return {
      gitStatus,
      gitDiffStat,
      testPassed,
      testOutput,
      antigravityLatest: agyTranscript?.summary || null
    };
  }

  /**
   * Calls the lightweight free Supervisor model to analyze Worker logs & evidence
   * and formulate the exact next directive for the IDE Worker.
   */
  async _defaultSupervisorDecide({ originalGoal, lastWorkerReceipt, evidence, journal, stepNumber }) {
    // If the Worker already declared completion AND acceptance test passed (or no acceptance test), we're done!
    if (
      lastWorkerReceipt.outcome === OUTCOME.GOAL_COMPLETED &&
      (evidence.testPassed === true || evidence.testPassed === null)
    ) {
      return {
        completed: true,
        nextDirective: '',
        reasoning: 'Worker declared completion and acceptance check passed.'
      };
    }

    const supervisorPrompt = [
      `You are the Supervisor Agent controlling a coding IDE Worker.`,
      `ORIGINAL TARGET GOAL: ${originalGoal.target_prompt}`,
      `STEP NUMBER JUST FINISHED: ${stepNumber}`,
      `WORKER SUMMARY: ${lastWorkerReceipt.summary}`,
      `WORKER LOG / TOOL CALLS: ${(lastWorkerReceipt.rawLog || '').slice(-800)}`,
      evidence.gitStatus ? `GIT STATUS:\n${evidence.gitStatus}` : '',
      evidence.testOutput
        ? `VERIFICATION / TEST OUTPUT (passed=${evidence.testPassed}):\n${evidence.testOutput}`
        : '',
      evidence.antigravityLatest?.lastAgentResponse
        ? `LATEST ANTIGRAVITY IDE TRANSCRIPT:\n${evidence.antigravityLatest.lastAgentResponse.slice(-400)}`
        : '',
      '',
      `Decide the next action:`,
      `- If the ORIGINAL TARGET GOAL is 100% complete and verified, output <SUPERVISOR_DECISION>COMPLETED</SUPERVISOR_DECISION>.`,
      `- Otherwise, output a concise, surgical instruction for the IDE Worker's next step inside <NEXT_DIRECTIVE>...</NEXT_DIRECTIVE> and brief reason inside <REASONING>...</REASONING>.`
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const { stdout } = await runCliProcess(
        this.supervisorBinary,
        ['run', '-m', this.supervisorModelId, supervisorPrompt],
        { timeoutMs: 90_000 }
      );
      const isDone = /<SUPERVISOR_DECISION>\s*COMPLETED\s*<\/SUPERVISOR_DECISION>/i.test(stdout);
      const dirMatch = stdout.match(/<NEXT_DIRECTIVE>([\s\S]*?)<\/NEXT_DIRECTIVE>/i);
      const reasonMatch = stdout.match(/<REASONING>([\s\S]*?)<\/REASONING>/i);

      return {
        completed: isDone,
        nextDirective: dirMatch ? dirMatch[1].trim() : `Continue working on: ${originalGoal.target_prompt}`,
        reasoning: reasonMatch ? reasonMatch[1].trim() : parseStepTags(stdout).summary
      };
    } catch {
      // Deterministic fallback if supervisor CLI is busy/offline
      const fallbackDirective =
        evidence.testPassed === false
          ? `Fix the failing verification check:\n${evidence.testOutput}\nWhile completing: ${originalGoal.target_prompt}`
          : `Continue from previous step (${lastWorkerReceipt.summary}) to finish: ${originalGoal.target_prompt}`;
      return {
        completed: false,
        nextDirective: fallbackDirective,
        reasoning: 'Generated via deterministic log/test analyzer fallback.'
      };
    }
  }

  /**
   * Executes the closed-loop Supervisor <-> IDE Worker cycle until goal completion.
   */
  async runSupervisedGoal(goal) {
    const workspaceDir = goal.repo_path || process.cwd();
    const maxSteps = goal.max_steps ?? 10;
    const journal = [];
    let currentDirective = goal.target_prompt;

    for (let stepNumber = 1; stepNumber <= maxSteps; stepNumber++) {
      if (this.writeDirectiveBridge) {
        writeIdeDirectiveBridge(workspaceDir, {
          goalId: goal.id,
          stepNumber,
          directive: currentDirective,
          reasoning: stepNumber === 1 ? 'Initial target goal' : 'Supervisor follow-up directive'
        });
      }

      await this._notify(`🎯 [Step ${stepNumber}] Sending directive to IDE Worker (${this.workerHarness.id}): ${currentDirective}`);

      const stepGoal = {
        ...goal,
        target_prompt: currentDirective
      };

      const receipt = await this.workerHarness.executeStep({
        goal: stepGoal,
        journal,
        workspaceDir,
        modelId: this.workerModelId
      });

      const evidence = await this._collectWorkspaceEvidence(workspaceDir, goal.acceptance_cmd);

      // If Worker already completed and acceptance check passed, finish immediately
      if (
        receipt.outcome === OUTCOME.GOAL_COMPLETED &&
        (evidence.testPassed === true || evidence.testPassed === null)
      ) {
        journal.push({
          goal_id: goal.id,
          step_number: stepNumber,
          core_used: this.workerHarness.id,
          model_used: this.workerModelId,
          outcome: OUTCOME.GOAL_COMPLETED,
          summary: receipt.summary,
          directive_sent: currentDirective
        });
        await this._notify(`✅ [Supervisor] Goal completed in ${stepNumber} step(s): ${receipt.summary}`);
        return { status: 'COMPLETED', stepsRun: stepNumber, journal };
      }

      const decideFn = this.supervisorDecideFn || this._defaultSupervisorDecide.bind(this);
      const decision = await decideFn({
        originalGoal: goal,
        lastWorkerReceipt: receipt,
        evidence,
        journal,
        stepNumber
      });

      journal.push({
        goal_id: goal.id,
        step_number: stepNumber,
        core_used: this.workerHarness.id,
        model_used: this.workerModelId,
        outcome: decision.completed ? OUTCOME.GOAL_COMPLETED : receipt.outcome,
        summary: receipt.summary,
        supervisor_reasoning: decision.reasoning,
        next_directive: decision.nextDirective
      });

      if (decision.completed) {
        await this._notify(`✅ [Supervisor] Verified goal completion at step ${stepNumber}.`);
        return { status: 'COMPLETED', stepsRun: stepNumber, journal };
      }

      currentDirective = decision.nextDirective;
      await this._notify(`🧠 [Supervisor Analysis] ${decision.reasoning}\n👉 Next Directive: ${currentDirective}`);
    }

    return { status: 'MAX_STEPS_REACHED', stepsRun: maxSteps, journal };
  }
}


// --- MODULE: src/core/agent-mesh.js ---

/**
 * Multi-Agent Mesh & Routed Loopback MCP Bridge
 * Combines:
 * 1. Grok Bot 0.18 (`routed-mcp-bridge.ts`, `sand-agent-management-tools.ts`, `sand-subagent-management-tools.ts`)
 *    - Loopback HTTP MCP Server (`http://127.0.0.1:<port>/mcp/<secret>`)
 *    - Inter-agent tools: `CreateAgent`, `ListAgents`, `SendToAgent`, `CheckSubagent`, `MessageSubagent`, `StopSubagent`
 * 2. Neko-Bot (`REQ-PB-006 Autonomous coworkers` + `session-handoff.ts`)
 *    - Multi-bot persona roster, durable handoff envelopes, and priority steering under human commander control.
 */

const MESH_TOOLS = [
  {
    name: 'CreateAgent',
    description:
      'Create a new specialist teammate agent with a name, persona/description, and optional preferred core (claude, codex, opencode, antigravity, or auto). Returns the new agent id.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Optional short slug id (e.g. "architect", "coder", "qa").' },
        name: { type: 'string', description: 'Human-readable name for the teammate agent.' },
        description: { type: 'string', description: 'Persona and instructions for this teammate.' },
        preferred_core: {
          type: 'string',
          description: 'Optional preferred runtime: "claude", "codex", "opencode", "antigravity", or "auto".'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'ListAgents',
    description:
      'List all teammate agents in the mesh, including their id, name, role, preferred core, live status, and recent activity.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'SendToAgent',
    description:
      'Send a task or message to another teammate agent by its target_id (or "all" for group broadcast). Pass priority=true to interrupt/steer its current work immediately.',
    inputSchema: {
      type: 'object',
      properties: {
        target_id: { type: 'string', description: 'Target agent id from ListAgents.' },
        message: { type: 'string', description: 'Actionable instruction or handoff message for the teammate.' },
        priority: {
          type: 'boolean',
          description: 'When true, interrupts/steers the target agent immediately.'
        },
        wait: {
          type: 'boolean',
          description: 'When true (default), runs the target agent turn and returns its reply.'
        }
      },
      required: ['target_id', 'message']
    }
  },
  {
    name: 'CheckSubagent',
    description:
      'Check how a running or completed teammate/subagent is doing, including elapsed time, tool call count, recent activity, and live IDE transcript.',
    inputSchema: {
      type: 'object',
      properties: {
        subagent_id: {
          type: 'string',
          description: 'Agent ID to inspect. Omit to list all agents and their current status.'
        }
      }
    }
  },
  {
    name: 'MessageSubagent',
    description:
      'Inject a mid-run steering instruction into an agent without losing its context. The agent incorporates your message on its current/next step.',
    inputSchema: {
      type: 'object',
      properties: {
        subagent_id: { type: 'string', description: 'Agent ID to steer.' },
        message: { type: 'string', description: 'Course-correction instruction to inject.' }
      },
      required: ['subagent_id', 'message']
    }
  },
  {
    name: 'StopSubagent',
    description: 'Abort a running agent that is stuck, looping, or no longer needed.',
    inputSchema: {
      type: 'object',
      properties: {
        subagent_id: { type: 'string', description: 'Agent ID to stop.' }
      },
      required: ['subagent_id']
    }
  }
];

function slugifyId(text) {
  return (
    String(text || 'agent')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || `agent-${randomUUID().slice(0, 6)}`
  );
}

/**
 * Parses inline agent tool directives emitted by CLI models that don't use HTTP MCP directly, e.g.:
 * [AGENT_TOOL: {"tool":"SendToAgent","args":{"target_id":"coder","message":"..."}}]
 */
function parseInlineAgentToolCalls(outputText = '') {
  const calls = [];
  const regex = /\[AGENT_TOOL:\s*(\{[\s\S]*?\})\s*\]/g;
  let match;
  while ((match = regex.exec(outputText)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed.tool === 'string') {
        calls.push({
          name: parsed.tool,
          args: parsed.args || {}
        });
      }
    } catch {
      // Ignore malformed inline JSON
    }
  }
  return calls;
}

class AgentMesh {
  constructor({
    registry,
    ranker,
    workspaceDir = process.cwd(),
    stateFile = join(homedir(), '.botautotask', 'mesh-state.json'),
    onEvent = () => {}
  } = {}) {
    this.registry = registry;
    this.ranker = ranker;
    this.workspaceDir = workspaceDir;
    this.stateFile = stateFile;
    this.onEvent = onEvent;
    this.agents = new Map();
    this.handoffs = [];
    this.mcpBridge = null;

    this._seedDefaultTeam();
  }

  _seedDefaultTeam() {
    this.createAgent({
      id: 'lead',
      name: 'Team Lead (Orchestrator)',
      description:
        'Coordinates tasks under the human commander, decomposes goals, delegates to coder/reviewer, and verifies completion.',
      preferredCore: 'auto'
    });
    this.createAgent({
      id: 'coder',
      name: 'Senior Implementation Engineer',
      description:
        'Writes clean, minimal, production-ready code and unit tests in the workspace using Codex / Claude / OpenCode.',
      preferredCore: 'auto'
    });
    this.createAgent({
      id: 'reviewer',
      name: 'Adversarial Reviewer & QA',
      description:
        'Reviews git diff, runs verification checks, inspects IDE logs, and sends surgical fix requests back to coder.',
      preferredCore: 'auto'
    });
  }

  createAgent({ id, name, description = '', preferredCore = 'auto' }) {
    const cleanId = id ? slugifyId(id) : slugifyId(name);
    const existing = this.agents.get(cleanId);
    if (existing) {
      if (name) existing.name = name;
      if (description) existing.description = description;
      if (preferredCore) existing.preferredCore = preferredCore;
      this._persistState();
      return existing;
    }

    const agent = {
      id: cleanId,
      name: name || cleanId,
      description,
      preferredCore: preferredCore || 'auto',
      status: 'idle',
      startedAtMs: null,
      toolCallCount: 0,
      recentActivity: [],
      pendingSteers: [],
      inbox: [],
      transcript: [],
      aborted: false
    };
    this.agents.set(cleanId, agent);
    this._persistState();
    this.onEvent({ type: 'agent_created', agentId: cleanId, name: agent.name });
    return agent;
  }

  listAgents() {
    return Array.from(this.agents.values()).map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      preferredCore: a.preferredCore,
      status: a.status,
      elapsedMs: a.startedAtMs ? Date.now() - a.startedAtMs : 0,
      toolCallCount: a.toolCallCount,
      recentActivity: a.recentActivity.slice(-5),
      pendingSteers: a.pendingSteers.length,
      inboxCount: a.inbox.length
    }));
  }

  steerAgent(agentId, message, from = 'commander') {
    const agent = this.agents.get(agentId);
    if (!agent) return { ok: false, reason: `No agent "${agentId}" found.` };
    const steerNote = `[PRIORITY STEER from ${from}]: ${message}`;
    agent.pendingSteers.push(steerNote);
    agent.recentActivity.push(`Steered by ${from}: ${message.slice(0, 80)}`);
    this._persistState();
    this.onEvent({ type: 'agent_steered', agentId, from, message });
    return {
      ok: true,
      status: agent.status,
      message: `Delivered priority steer to ${agent.name} (${agent.id}). Context preserved.`
    };
  }

  stopAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return { ok: false, reason: `No agent "${agentId}" found.` };
    agent.aborted = true;
    agent.status = 'aborted';
    agent.recentActivity.push('Aborted by StopSubagent.');
    this._persistState();
    this.onEvent({ type: 'agent_stopped', agentId });
    return { ok: true, message: `Stopped agent ${agent.name} (${agent.id}).` };
  }

  checkAgent(agentId) {
    if (!agentId) {
      return {
        agents: this.listAgents(),
        latestIdeLog: this._readLatestIdeSummary()
      };
    }
    const agent = this.agents.get(agentId);
    if (!agent) {
      return { error: `No agent "${agentId}" found.`, available: this.listAgents().map((a) => a.id) };
    }
    return {
      id: agent.id,
      name: agent.name,
      status: agent.status,
      preferredCore: agent.preferredCore,
      elapsedMs: agent.startedAtMs ? Date.now() - agent.startedAtMs : 0,
      toolCallCount: agent.toolCallCount,
      recentActivity: agent.recentActivity.slice(-10),
      pendingSteers: agent.pendingSteers,
      lastTranscriptEntry: agent.transcript.slice(-1)[0] || null,
      latestIdeLog: this._readLatestIdeSummary()
    };
  }

  _readLatestIdeSummary() {
    try {
      const info = findLatestAntigravityTranscript();
      if (!info) return null;
      return {
        conversationId: info.conversationId,
        status: info.summary.lastStatus,
        toolCalls: info.summary.toolCalls.slice(-5),
        lastResponse: (info.summary.lastAgentResponse || '').slice(0, 300)
      };
    } catch {
      return null;
    }
  }

  /**
   * Selects the best execution harness & model for a given agent based on its `preferredCore`
   * and the live `FreeModelRanker`.
   */
  async _resolveAgentHarness(agent) {
    const candidates = await this.registry.getCandidates(this.ranker, agent.preferredCore || 'auto');
    if (candidates.length > 0) {
      return { harness: candidates[0].harness, modelId: candidates[0].modelId };
    }
    throw new Error('No available AI core found for AgentMesh execution.');
  }

  /**
   * Sends a message from one agent (or the user commander) to another agent,
   * creating a durable Neko-style SessionHandoff envelope and optionally running the target's turn.
   */
  async sendToAgent({ fromId = 'commander', targetId, message, priority = false, wait = true, depth = 0 }) {
    if (targetId === 'all') {
      const targets = Array.from(this.agents.keys()).filter((id) => id !== fromId);
      const replies = [];
      for (const id of targets) {
        const res = await this.sendToAgent({
          fromId,
          targetId: id,
          message,
          priority,
          wait,
          depth
        });
        replies.push({ targetId: id, ...res });
      }
      return { delivered: true, broadcast: replies };
    }

    const target = this.agents.get(targetId);
    if (!target) {
      return {
        delivered: false,
        error: `Unknown target_id "${targetId}". Known agents: ${Array.from(this.agents.keys()).join(', ')}`
      };
    }

    if (fromId === targetId) {
      return {
        delivered: false,
        error: 'An agent cannot SendToAgent to itself. Pick a teammate id.'
      };
    }

    const handoff = {
      schema: 'neko.session-handoff/v1',
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      fromAgentId: fromId,
      targetAgentId: targetId,
      priority: Boolean(priority),
      summary: message
    };
    this.handoffs.push(handoff);

    if (priority) {
      target.pendingSteers.push(`[PRIORITY from ${fromId}]: ${message}`);
    } else {
      target.inbox.push({ fromId, message, timestamp: handoff.createdAt });
    }
    target.recentActivity.push(`Received message from ${fromId}: ${message.slice(0, 80)}`);
    this._persistState();
    this.onEvent({ type: 'agent_message', fromId, targetId, priority, message });

    if (!wait) {
      return {
        delivered: true,
        handoffId: handoff.id,
        status: 'queued',
        message: `Message queued for ${target.name} (${target.id}).`
      };
    }

    const turnResult = await this.runAgentTurn(targetId, message, { fromId, depth });
    return {
      delivered: true,
      handoffId: handoff.id,
      status: turnResult.outcome,
      reply: turnResult.summary,
      harnessId: turnResult.harnessId,
      modelId: turnResult.modelId
    };
  }

  /**
   * Executes a single turn for `agentId` using its resolved CLI/IDE harness,
   * injecting teammate roster, pending steers, and processing any inter-agent tool calls.
   */
  async runAgentTurn(agentId, incomingPrompt, { fromId = 'commander', depth = 0, maxDepth = 3 } = {}) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent "${agentId}" does not exist.`);

    agent.aborted = false;
    agent.status = 'running';
    agent.startedAtMs = Date.now();
    agent.toolCallCount += 1;

    const steers = agent.pendingSteers.splice(0, agent.pendingSteers.length);
    const inboxItems = agent.inbox.splice(0, agent.inbox.length);

    const teammatesList = this.listAgents()
      .filter((a) => a.id !== agentId)
      .map((a) => `- id: "${a.id}" | name: "${a.name}" | role: ${a.description}`)
      .join('\n');

    const promptLines = [
      `# AGENT IDENTITY`,
      `You are "${agent.name}" (id: "${agent.id}").`,
      `Role & Instructions: ${agent.description}`,
      ``,
      `# TEAMMATES IN MESH (You can control/delegate to them)`,
      teammatesList || '(No other teammates yet)',
      ``,
      `# INTER-AGENT CONTROL PROTOCOL`,
      `If you need to create a teammate, delegate a task to another agent, or steer/check a subagent, you may either call the MCP tool directly OR output an inline directive on its own line:`,
      `[AGENT_TOOL: {"tool":"SendToAgent","args":{"target_id":"coder","message":"Implement X"}}]`,
      `[AGENT_TOOL: {"tool":"CreateAgent","args":{"id":"security","name":"Security Auditor","description":"Audits auth code"}}]`,
      `[AGENT_TOOL: {"tool":"MessageSubagent","args":{"subagent_id":"coder","message":"Use node:crypto instead"}}]`,
      ``
    ];

    if (steers.length > 0) {
      promptLines.push(`# URGENT STEERING DIRECTIVES (HIGHEST PRIORITY — APPLY IMMEDIATELY)`);
      promptLines.push(...steers);
      promptLines.push(``);
    }

    if (inboxItems.length > 0) {
      promptLines.push(`# PENDING TEAMMATE MESSAGES`);
      for (const item of inboxItems) {
        promptLines.push(`- From ${item.fromId}: ${item.message}`);
      }
      promptLines.push(``);
    }

    promptLines.push(`# CURRENT DIRECTIVE (from ${fromId})`);
    promptLines.push(incomingPrompt);

    const fullPrompt = promptLines.join('\n');
    const { harness, modelId } = await this._resolveAgentHarness(agent);

    agent.recentActivity.push(`Running turn on ${harness.id}:${modelId}`);
    this._persistState();

    const stepResult = await harness.executeStep({
      goal: fullPrompt,
      journal: agent.transcript.slice(-5),
      workspaceDir: this.workspaceDir,
      modelId
    });

    if (agent.aborted) {
      return {
        outcome: OUTCOME.ERROR,
        summary: `Agent ${agent.id} was aborted mid-turn.`,
        harnessId: harness.id,
        modelId
      };
    }

    const rawOutput = stepResult.rawOutput || stepResult.summary || '';
    const inlineCalls = depth < maxDepth ? parseInlineAgentToolCalls(rawOutput) : [];
    const subResults = [];

    for (const call of inlineCalls) {
      agent.toolCallCount += 1;
      const toolOut = await this.executeMeshTool(call.name, call.args, {
        callerAgentId: agentId,
        depth: depth + 1
      });
      subResults.push(`[Tool ${call.name} -> ${JSON.stringify(toolOut).slice(0, 300)}]`);
    }

    const combinedSummary =
      subResults.length > 0
        ? `${stepResult.summary}\n${subResults.join('\n')}`
        : stepResult.summary;

    const entry = {
      step: agent.transcript.length + 1,
      fromId,
      harnessId: harness.id,
      modelId,
      outcome: stepResult.outcome,
      summary: combinedSummary,
      timestamp: new Date().toISOString()
    };
    agent.transcript.push(entry);
    agent.status = stepResult.outcome === OUTCOME.ERROR ? 'error' : 'idle';
    agent.recentActivity.push(`Completed turn (${stepResult.outcome})`);
    this._persistState();

    return {
      ...stepResult,
      summary: combinedSummary,
      harnessId: harness.id,
      modelId
    };
  }

  /**
   * Executes one of the 6 GrokBot/NekoBot inter-agent tools (`CreateAgent`, `ListAgents`,
   * `SendToAgent`, `CheckSubagent`, `MessageSubagent`, `StopSubagent`).
   */
  async executeMeshTool(toolName, args = {}, { callerAgentId = 'commander', depth = 0 } = {}) {
    switch (toolName) {
      case 'CreateAgent': {
        const created = this.createAgent({
          id: args.id,
          name: args.name,
          description: args.description || '',
          preferredCore: args.preferred_core || 'auto'
        });
        return {
          created: true,
          id: created.id,
          name: created.name,
          message: `Created agent "${created.name}" (id: ${created.id}). Message it with SendToAgent.`
        };
      }
      case 'ListAgents': {
        return { agents: this.listAgents() };
      }
      case 'SendToAgent': {
        return await this.sendToAgent({
          fromId: callerAgentId,
          targetId: args.target_id,
          message: args.message,
          priority: Boolean(args.priority),
          wait: args.wait !== false,
          depth
        });
      }
      case 'CheckSubagent': {
        return this.checkAgent(args.subagent_id);
      }
      case 'MessageSubagent': {
        return this.steerAgent(args.subagent_id, args.message, callerAgentId);
      }
      case 'StopSubagent': {
        return this.stopAgent(args.subagent_id);
      }
      default:
        throw new Error(`Unknown AgentMesh tool: ${toolName}`);
    }
  }

  /**
   * Starts a local loopback HTTP MCP Server (`http://127.0.0.1:<port>/mcp/<secret>`)
   * modeled after Grok Bot's `createRoutedMcpBridge` (`routed-mcp-bridge.ts`).
   * Any local agent (Claude Code, Codex, OpenCode, Antigravity) can connect and invoke
   * the 6 inter-agent orchestration tools over standard MCP JSON-RPC 2.0.
   */
  async startMcpBridgeServer() {
    if (this.mcpBridge) return this.mcpBridge;
    const secret = randomUUID();

    const server = createServer(async (req, res) => {
      if (req.method !== 'POST' || !req.url?.startsWith(`/mcp/${secret}`)) {
        res.writeHead(404).end();
        return;
      }

      let body = '';
      for await (const chunk of req) {
        body += String(chunk);
        if (body.length > 1_048_576) {
          res.writeHead(413).end();
          return;
        }
      }

      let msg;
      try {
        msg = JSON.parse(body);
      } catch {
        res.writeHead(400).end();
        return;
      }

      if (msg.method === 'notifications/initialized') {
        res.writeHead(202).end();
        return;
      }

      const reply = (result) => {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }));
      };

      try {
        if (msg.method === 'initialize') {
          reply({
            protocolVersion: '2025-03-26',
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: 'botautotask-agent-mesh', version: '1.0.0' }
          });
          return;
        }
        if (msg.method === 'tools/list') {
          reply({ tools: MESH_TOOLS });
          return;
        }
        if (msg.method === 'tools/call') {
          const name = msg.params?.name;
          const toolArgs = msg.params?.arguments || {};
          const callerId = req.headers['x-agent-id'] || 'mcp-peer';
          const out = await this.executeMeshTool(name, toolArgs, {
            callerAgentId: String(callerId)
          });
          reply({
            isError: false,
            content: [{ type: 'text', text: JSON.stringify(out, null, 2) }]
          });
          return;
        }
        reply({});
      } catch (err) {
        reply({
          isError: true,
          content: [{ type: 'text', text: err.message || String(err) }]
        });
      }
    });

    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    const addr = server.address();
    const url = `http://127.0.0.1:${addr.port}/mcp/${secret}`;
    this.mcpBridge = {
      url,
      port: addr.port,
      close: () =>
        new Promise((resolve) => {
          server.closeAllConnections?.();
          server.close(() => resolve());
          this.mcpBridge = null;
        })
    };
    return this.mcpBridge;
  }

  _persistState() {
    try {
      mkdirSync(dirname(this.stateFile), { recursive: true });
      const snapshot = {
        updatedAt: new Date().toISOString(),
        workspaceDir: this.workspaceDir,
        agents: Array.from(this.agents.values()),
        handoffs: this.handoffs.slice(-50)
      };
      writeFileSync(this.stateFile, JSON.stringify(snapshot, null, 2), 'utf8');
    } catch {
      // Non-fatal in read-only environments
    }
  }

  loadPersistedState() {
    try {
      if (!existsSync(this.stateFile)) return false;
      const raw = JSON.parse(readFileSync(this.stateFile, 'utf8'));
      if (Array.isArray(raw?.agents)) {
        for (const a of raw.agents) {
          if (a && typeof a.id === 'string') {
            this.agents.set(a.id, {
              ...a,
              pendingSteers: Array.isArray(a.pendingSteers) ? a.pendingSteers : [],
              inbox: Array.isArray(a.inbox) ? a.inbox : [],
              transcript: Array.isArray(a.transcript) ? a.transcript : [],
              recentActivity: Array.isArray(a.recentActivity) ? a.recentActivity : []
            });
          }
        }
      }
      if (Array.isArray(raw?.handoffs)) {
        this.handoffs = raw.handoffs;
      }
      return true;
    } catch {
      return false;
    }
  }
}


// --- MODULE: src/daemon/network-monitor.js ---
/**
 * Network availability gate.
 * Waits until internet / Cloud Core is reachable before starting or resuming agent steps.
 */

async function checkNetworkOnline(checkUrls = ['https://1.1.1.1', 'https://api.github.com'], fetchFn = globalThis.fetch) {
  for (const url of checkUrls) {
    try {
      const res = await fetchFn(url, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
      if (res.ok || res.status < 500) return true;
    } catch {}
  }
  return false;
}

async function waitForNetwork({
  intervalMs = 10_000,
  maxWaitMs = Infinity,
  checkUrls,
  fetchFn = globalThis.fetch,
  onOffline = null
} = {}) {
  const start = Date.now();
  while (true) {
    const online = await checkNetworkOnline(checkUrls, fetchFn);
    if (online) return true;
    if (Date.now() - start >= maxWaitMs) return false;
    if (onOffline) onOffline();
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}


// --- MODULE: src/daemon/local-daemon.js ---



const USER_HOME_DIR = join(homedir(), '.botautotask');

const BUILTIN_DEFAULT_CONFIG = {
  priorityModels: [
    'deepseek-v4.1-flash-free',
    'opencode/deepseek-v4.1-flash-free',
    'gpt-luna',
    'opencode/gpt-luna',
    'opencode/grok-code',
    'opencode/big-pickle',
    'openrouter/deepseek/deepseek-r1:free',
    'openrouter/qwen/qwen-2.5-coder-32b-instruct:free',
    'google/gemini-2.5-pro',
    'google/gemini-2.5-flash',
    'claude-sonnet',
    'codex-default',
    'agy-default',
    'neko-core-default'
  ],
  cooldownMs: 1800000,
  leaseDurationMs: 90000,
  heartbeatIntervalMs: 30000,
  networkPollIntervalMs: 15000,
  harnesses: {
    opencode: { enabled: true, binary: 'opencode', discoverFromCli: true, discoverFromOpenRouterFree: true },
    antigravity: { enabled: true, binary: 'agy' },
    claude: { enabled: true, binary: 'claude' },
    codex: { enabled: true, binary: 'codex' },
    'neko-core': { enabled: true, endpoint: 'http://127.0.0.1:19820/api/run', binary: 'neko-core' }
  },
  customHarnesses: []
};

function loadConfig(customPath = null) {
  const candidates = [
    customPath,
    join(process.cwd(), '.botautotask.json'),
    join(USER_HOME_DIR, 'config.json'),
    join(ROOT_DIR, 'config', 'default-config.json')
  ].filter(Boolean);

  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        return { ...BUILTIN_DEFAULT_CONFIG, ...JSON.parse(readFileSync(p, 'utf8')) };
      } catch {}
    }
  }
  return BUILTIN_DEFAULT_CONFIG;
}

/**
 * Builds the default HarnessRegistry & FreeModelRanker from config.
 * Any core (OpenCode, Antigravity, Claude, Codex, Neko Core, or Custom) can be toggled or swapped in config.
 */
function createRuntime(config = loadConfig()) {
  const ranker = new FreeModelRanker(config);
  const registry = new HarnessRegistry();
  const hCfg = config.harnesses || {};

  if (hCfg.opencode?.enabled !== false) {
    registry.register(new OpenCodeHarness({ binary: hCfg.opencode?.binary || 'opencode', ranker }));
  }
  if (hCfg.antigravity?.enabled !== false) {
    registry.register(new AntigravityHarness({ binary: hCfg.antigravity?.binary || 'agy' }));
  }
  if (hCfg.claude?.enabled !== false) {
    registry.register(new ClaudeCodexHarness({ id: 'claude', binary: hCfg.claude?.binary || 'claude' }));
  }
  if (hCfg.codex?.enabled !== false) {
    registry.register(new ClaudeCodexHarness({ id: 'codex', binary: hCfg.codex?.binary || 'codex' }));
  }
  if (hCfg['neko-core']?.enabled !== false) {
    registry.register(new NekoCoreHarness({ endpoint: hCfg['neko-core']?.endpoint }));
  }

  if (Array.isArray(config.customHarnesses)) {
    registry.registerFromConfig(config.customHarnesses);
  }

  return { config, ranker, registry };
}

function resolveDefaultQueueFile() {
  try {
    mkdirSync(USER_HOME_DIR, { recursive: true });
    return join(USER_HOME_DIR, 'queue.json');
  } catch {
    return join(ROOT_DIR, '.botautotask-queue.json');
  }
}

/**
 * Local & Cloud Worker Daemon.
 * Connects to Cloud Core (or runs local persistent queue `~/.botautotask/queue.json`),
 * waits for internet connection, and executes goals across pluggable cores.
 */
class LocalDaemon {
  constructor({
    workerId = 'local-pc',
    cloudUrl = process.env.BOTAUTOTASK_CLOUD_URL || '',
    apiToken = process.env.BOTAUTOTASK_API_TOKEN || '',
    queueFile = resolveDefaultQueueFile()
  } = {}) {
    this.workerId = workerId;
    this.queueFile = queueFile;
    const { config, ranker, registry } = createRuntime();
    this.cloudUrl = (cloudUrl || config.cloud?.url || '').replace(/\/$/, '');
    this.apiToken = apiToken || config.cloud?.apiToken || '';
    this.config = config;
    this.ranker = ranker;
    this.registry = registry;
  }

  _headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.apiToken) h.Authorization = `Bearer ${this.apiToken}`;
    return h;
  }

  loadLocalQueue() {
    if (!existsSync(this.queueFile)) return [];
    try {
      return JSON.parse(readFileSync(this.queueFile, 'utf8'));
    } catch {
      return [];
    }
  }

  saveLocalQueue(goals) {
    writeFileSync(this.queueFile, JSON.stringify(goals, null, 2), 'utf8');
  }

  enqueueLocalGoal(goalInput) {
    const queue = this.loadLocalQueue();
    const goal = {
      id: goalInput.id || `goal-${Date.now().toString(36)}`,
      title: goalInput.title || goalInput.target_prompt.slice(0, 70),
      target_prompt: goalInput.target_prompt,
      repo_path: goalInput.repo_path || process.cwd(),
      acceptance_cmd: goalInput.acceptance_cmd || null,
      preferred_core: goalInput.preferred_core || 'auto',
      status: 'QUEUED',
      current_step: 0,
      max_steps: goalInput.max_steps || 15,
      journal: [],
      created_at: Date.now()
    };
    queue.push(goal);
    this.saveLocalQueue(queue);
    return goal;
  }

  async runOnce(specificGoalId = null) {
    await waitForNetwork({
      onOffline: () => console.log('[BotAutoTask] Waiting for internet connection...')
    });

    // 1. Check Cloud Core if configured
    if (this.cloudUrl) {
      try {
        const res = await fetch(`${this.cloudUrl}/api/lease/acquire`, {
          method: 'POST',
          headers: this._headers(),
          body: JSON.stringify({ workerId: this.workerId, goalId: specificGoalId })
        });
        if (res.ok) {
          const { goal, journal } = await res.json();
          if (goal) {
            console.log(`[BotAutoTask] Acquired Cloud Goal ${goal.id}: ${goal.title}`);
            const orchestrator = new GoalOrchestrator({
              registry: this.registry,
              ranker: this.ranker,
              gitCheckpoint: true,
              onNotify: (msg) => console.log(msg),
              onJournalEntry: async (entry) => {
                await fetch(`${this.cloudUrl}/api/lease/step`, {
                  method: 'POST',
                  headers: this._headers(),
                  body: JSON.stringify({ ...entry, worker_id: this.workerId })
                }).catch(() => {});
              }
            });
            return await orchestrator.runGoal(goal, journal || []);
          }
        }
      } catch (err) {
        console.warn(`[BotAutoTask] Cloud Core unreachable (${err.message}), checking local queue...`);
      }
    }

    // 2. Process Local Persistent Queue (survives reboot / power off)
    const queue = this.loadLocalQueue();
    const nextGoal = queue.find((g) =>
      specificGoalId ? g.id === specificGoalId : ['QUEUED', 'RUNNING_LOCAL', 'PAUSED_LIMIT'].includes(g.status)
    );
    if (!nextGoal) return null;

    nextGoal.status = 'RUNNING_LOCAL';
    this.saveLocalQueue(queue);

    const orchestrator = new GoalOrchestrator({
      registry: this.registry,
      ranker: this.ranker,
      gitCheckpoint: true,
      onNotify: (msg) => console.log(msg),
      onJournalEntry: async (entry) => {
        nextGoal.journal = nextGoal.journal || [];
        nextGoal.journal.push(entry);
        nextGoal.current_step = entry.step_number;
        this.saveLocalQueue(queue);
      }
    });

    const result = await orchestrator.runGoal(nextGoal, nextGoal.journal || []);
    nextGoal.status = result.status;
    this.saveLocalQueue(queue);
    return result;
  }
}


// --- MODULE: src/daemon/cli.js ---

const [, , subcommand = 'help', ...rest] = process.argv;

function parseCliFlags(tokens) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith('--')) {
      const key = t.slice(2);
      const val = tokens[i + 1] && !tokens[i + 1].startsWith('--') ? tokens[++i] : 'true';
      flags[key] = val;
    } else {
      positional.push(t);
    }
  }
  return { flags, text: positional.join(' ').trim(), positional };
}

async function main() {
  const { ranker, registry } = createRuntime();

  if (subcommand === 'cores') {
    console.log('=== Registered Pluggable AI Cores (Harnesses) ===');
    for (const h of registry.list()) {
      const ok = await h.isAvailable();
      console.log(`- ${h.id.padEnd(15)} : ${ok ? 'READY (Available)' : 'OFFLINE / NOT INSTALLED'}`);
    }
    return;
  }

  if (subcommand === 'auth' || subcommand === 'login') {
    console.log('=== Zero-API-Key Local Session Status (GrokBot + Neko-Bot Bridge) ===');
    const auth = await getZeroKeyAuthStatus();
    for (const [provider, info] of Object.entries(auth)) {
      const state = info.authenticated
        ? `SIGNED IN (${info.authMode})`
        : info.installed
          ? `INSTALLED — Run: ${info.loginCommand}`
          : `NOT INSTALLED — Run: ${info.loginCommand}`;
      console.log(`- ${provider.padEnd(14)} : ${state}`);
    }
    return;
  }

  if (subcommand === 'models') {
    console.log('=== Best Available Free / Idle Models (Ranked) ===');
    const candidates = await registry.getCandidates(ranker);
    if (candidates.length === 0) {
      console.log('No active CLI harnesses detected on PATH. Static priority list:');
      for (const m of ranker.priorityModels) {
        console.log(`  * ${m} (score: ${ranker.scoreModelId(m, true)})`);
      }
      return;
    }
    for (const c of candidates.slice(0, 15)) {
      console.log(`- [${c.harnessId}] ${c.modelId.padEnd(42)} (score: ${c.score})`);
    }
    return;
  }

  if (subcommand === 'agents') {
    const mesh = new AgentMesh({ registry, ranker });
    mesh.loadPersistedState();
    console.log('=== Multi-Agent Mesh Roster (GrokBot + Neko-Bot Coworkers) ===');
    for (const a of mesh.listAgents()) {
      console.log(
        `- [${a.id.padEnd(10)}] ${a.name.padEnd(32)} | core: ${a.preferredCore.padEnd(10)} | status: ${a.status.padEnd(8)} | steers: ${a.pendingSteers}`
      );
    }
    return;
  }

  if (subcommand === 'steer') {
    const { positional } = parseCliFlags(rest);
    const [targetId, ...msgParts] = positional;
    const message = msgParts.join(' ').trim();
    if (!targetId || !message) {
      console.error('Usage: botautotask steer <agentId> "<steering instruction>"');
      process.exit(1);
    }
    const mesh = new AgentMesh({ registry, ranker });
    mesh.loadPersistedState();
    const res = mesh.steerAgent(targetId, message, 'commander');
    console.log(res.ok ? `[Steer] ${res.message}` : `[Steer Error] ${res.reason}`);
    return;
  }

  if (subcommand === 'team') {
    const { flags, text } = parseCliFlags(rest);
    if (!text) {
      console.error(
        'Usage: botautotask team "<goal>" [--path D:\\repo] [--lead opencode] [--coder codex] [--reviewer claude]'
      );
      process.exit(1);
    }
    const mesh = new AgentMesh({
      registry,
      ranker,
      workspaceDir: flags.path || process.cwd(),
      onEvent: (evt) => {
        if (evt.type === 'agent_message') {
          console.log(`[Mesh] ${evt.fromId} -> ${evt.targetId}: ${evt.message.slice(0, 120)}`);
        } else if (evt.type === 'agent_steered') {
          console.log(`[Mesh Steer] ${evt.from} -> ${evt.agentId}: ${evt.message}`);
        } else if (evt.type === 'agent_created') {
          console.log(`[Mesh] Created agent "${evt.name}" (${evt.agentId})`);
        }
      }
    });
    mesh.loadPersistedState();
    if (flags.lead) mesh.createAgent({ id: 'lead', preferredCore: flags.lead });
    if (flags.coder) mesh.createAgent({ id: 'coder', preferredCore: flags.coder });
    if (flags.reviewer) mesh.createAgent({ id: 'reviewer', preferredCore: flags.reviewer });

    const bridge = await mesh.startMcpBridgeServer();
    console.log(`[Mesh] Routed Loopback MCP Bridge active at ${bridge.url}`);
    try {
      const res = await mesh.sendToAgent({
        fromId: 'commander',
        targetId: 'lead',
        message: text,
        priority: true,
        wait: true
      });
      console.log(`[Mesh Lead Reply (${res.harnessId}:${res.modelId})]:\n${res.reply}`);
    } finally {
      await bridge.close();
    }
    return;
  }

  if (subcommand === 'logs') {
    const { flags } = parseCliFlags(rest);
    const info = findLatestAntigravityTranscript({ conversationId: flags.conv || null });
    if (!info) {
      console.log('No Antigravity transcript.jsonl found.');
      return;
    }
    console.log(`=== Antigravity IDE Real-Time Log (${info.conversationId}) ===`);
    console.log(`File         : ${info.transcriptPath}`);
    console.log(`Total Steps  : ${info.summary.stepCount} | Latest Status: ${info.summary.lastStatus}`);
    console.log(`Last Prompt  : ${info.summary.lastUserPrompt.slice(0, 200)}`);
    console.log(`Tools Called : ${info.summary.toolCalls.slice(-8).join(', ') || 'none'}`);
    console.log(`Last Response: ${info.summary.lastAgentResponse.slice(0, 400)}`);
    return;
  }

  if (subcommand === 'supervise') {
    const { flags, text } = parseCliFlags(rest);
    if (!text) {
      console.error(
        'Usage: botautotask supervise "<goal>" [--path D:\\repo] [--supervisor opencode/deepseek-v4.1-flash-free] [--worker opencode:freemodel/claude-sonnet-4-6] [--check "npm test"]'
      );
      process.exit(1);
    }
    const candidates = await registry.getCandidates(ranker, flags.worker || 'auto');
    if (candidates.length === 0) {
      console.error('No available worker harness found.');
      process.exit(1);
    }
    const chosen = candidates[0];
    const loop = new SupervisorLoop({
      workerHarness: chosen.harness,
      workerModelId: chosen.modelId,
      supervisorModelId: flags.supervisor || 'opencode/deepseek-v4.1-flash-free',
      onNotify: (msg) => console.log(msg)
    });
    const res = await loop.runSupervisedGoal({
      id: `sup-${Date.now().toString(36)}`,
      title: text.slice(0, 70),
      target_prompt: text,
      repo_path: flags.path || process.cwd(),
      acceptance_cmd: flags.check || null,
      max_steps: Number(flags.steps || 8)
    });
    console.log(`[SupervisorLoop] Result: ${res.status} (${res.stepsRun} steps)`);
    return;
  }

  if (subcommand === 'submit' || subcommand === 'run') {
    const { flags, text } = parseCliFlags(rest);
    if (!text) {
      console.error('Usage: botautotask run "<target prompt>" [--path D:\\repo] [--core opencode:deepseek-v4.1-flash-free] [--check "npm test"]');
      process.exit(1);
    }
    const daemon = new LocalDaemon({ workerId: flags.worker || 'local-pc' });
    const goal = daemon.enqueueLocalGoal({
      target_prompt: text,
      repo_path: flags.path || process.cwd(),
      preferred_core: flags.core || 'auto',
      acceptance_cmd: flags.check || null
    });
    console.log(`[BotAutoTask] Queued Goal ${goal.id}: "${goal.title}" (preferred core: ${goal.preferred_core})`);

    if (subcommand === 'run') {
      const res = await daemon.runOnce(goal.id);
      console.log(`[BotAutoTask] Finished with status: ${res?.status} (${res?.stepsRun} steps)`);
    }
    return;
  }

  if (subcommand === 'daemon') {
    const { flags } = parseCliFlags(rest);
    const daemon = new LocalDaemon({ workerId: flags.worker || 'local-pc' });
    if (flags.once === 'true') {
      await daemon.runOnce(flags['goal-id'] || null);
      return;
    }
    console.log('[BotAutoTask] Starting continuous network-aware daemon...');
    while (true) {
      await daemon.runOnce();
      await new Promise((r) => setTimeout(r, 15_000));
    }
  }

  console.log(`BotAutoTask CLI — Pluggable Multi-Core & Free-Model Orchestrator
Commands:
  botautotask cores                                         List all pluggable AI cores & health
  botautotask auth                                          Inspect Zero-API-Key local login sessions
  botautotask models                                        Discover & rank best free/idle models
  botautotask agents                                        List Multi-Agent Mesh coworkers & status
  botautotask team "<goal>" [--path <dir>]                  Run GrokBot+NekoBot multi-agent coworker mesh
  botautotask steer <agentId> "<instruction>"               Inject priority mid-run steer into an agent
  botautotask logs [--conv <id>]                            Read latest Antigravity IDE transcript.jsonl
  botautotask supervise "<goal>" [--worker <id>] [--check]  Supervisor reads IDE logs & issues directives
  botautotask submit "<goal>" [--core <id>]                 Queue a goal persistently (runs when online)
  botautotask run "<goal>" [--core <id>]                    Queue and immediately execute a goal
  botautotask daemon [--once] [--goal-id <id>]              Run background daemon / Cloud Worker
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
