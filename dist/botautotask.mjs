#!/usr/bin/env node
/**
 * BotAutoTask — Single-File Standalone Bundle (Zero Dependencies)
 * Can be downloaded and executed directly on any machine with Node.js >= 20 or Bun.
 */
import { exec, execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync, statSync } from 'node:fs';
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
 * Claude Code (`claude -p`) and OpenAI Codex (`codex exec`) Harnesses.
 */
class ClaudeCodexHarness {
  constructor({ id = 'claude', binary = 'claude' } = {}) {
    this.id = id;
    this.binary = binary;
  }

  async isAvailable() {
    return commandExists(this.binary);
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
    const args =
      this.id === 'codex'
        ? ['exec', '--full-auto', prompt]
        : ['-p', prompt, '--dangerously-skip-permissions'];

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
    this.cloudUrl = cloudUrl.replace(/\/$/, '');
    this.apiToken = apiToken;
    this.queueFile = queueFile;
    const { config, ranker, registry } = createRuntime();
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
  return { flags, text: positional.join(' ').trim() };
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
  botautotask models                                        Discover & rank best free/idle models
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
