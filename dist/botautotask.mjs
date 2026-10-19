#!/usr/bin/env node
/**
 * BotAutoTask — Single-File Standalone Bundle (Zero Dependencies)
 * Can be downloaded and executed directly on any machine with Node.js >= 20 or Bun.
 */
import { exec, execFile, spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync, statSync, lstatSync, renameSync, appendFileSync, rmSync, copyFileSync, openSync, fsyncSync, closeSync } from 'node:fs';
import { join, dirname, basename, resolve, isAbsolute, normalize } from 'node:path';
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
 * Supports both a Goal object `{ id, title, target_prompt, acceptance_cmd }` or a raw prompt string.
 */
function buildHandoverPrompt(goal, journal = []) {
  const normalizedGoal =
    typeof goal === 'string'
      ? { id: 'agent-turn', title: 'Agent Turn Directive', target_prompt: goal, acceptance_cmd: null }
      : goal || {};

  const historyLines =
    journal.length === 0
      ? 'No previous steps executed yet.'
      : journal
          .slice(-8)
          .map(
            (entry, idx) =>
              `Step ${entry.step_number ?? entry.step ?? idx + 1} [${entry.core_used || entry.harnessId}/${entry.model_used || entry.modelId} -> ${entry.outcome}]: ${entry.summary}`
          )
          .join('\n');

  const acceptance = normalizedGoal.acceptance_cmd
    ? `\nAcceptance Verification Command: \`${normalizedGoal.acceptance_cmd}\` (run this to verify before declaring completion).`
    : '';

  return [
    `# TARGET GOAL: ${normalizedGoal.title || normalizedGoal.id || 'Autonomous Task'}`,
    normalizedGoal.target_prompt || '',
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
 * Resolves a CLI binary on PATH. On Windows, inspects `.cmd` npm shims to extract the
 * underlying `.exe` or `.js` entrypoint so we can spawn with `shell: false` (avoiding
 * cmd.exe quoting/redirection bugs on `<OMNIGOAL_SUMMARY>` and multi-line prompts).
 * @param {string} binary
 * @returns {{ file: string, prefixArgs: string[], useShell: boolean } | null}
 */
function resolveCliBinary(binary) {
  if (!binary) return null;
  const isWin = process.platform === 'win32';
  const pathEnv = process.env.PATH || process.env.Path || '';
  const sep = isWin ? ';' : ':';
  const dirs = pathEnv.split(sep).filter(Boolean);
  const exts = isWin ? ['.exe', '.cmd', '.bat', '.ps1', ''] : [''];

  let foundPath = existsSync(binary) ? resolve(binary) : null;
  if (!foundPath) {
    for (const dir of dirs) {
      for (const ext of exts) {
        const candidate = join(dir, binary + ext);
        if (existsSync(candidate)) {
          foundPath = candidate;
          break;
        }
      }
      if (foundPath) break;
    }
  }

  if (!foundPath) return null;
  if (!isWin) {
    return { file: foundPath, prefixArgs: [], useShell: false };
  }

  const lower = foundPath.toLowerCase();
  if (lower.endsWith('.exe')) {
    return { file: foundPath, prefixArgs: [], useShell: false };
  }

  if (lower.endsWith('.cmd') || lower.endsWith('.bat')) {
    try {
      const content = readFileSync(foundPath, 'utf8');
      const shimDir = dirname(foundPath);
      // Case 1: Native binary wrapper like "%dp0%\node_modules\opencode-ai\bin\opencode.exe" %*
      const exeMatch = content.match(/"%dp0%\\([^"]+\.exe)"\s+%\*/i);
      if (exeMatch) {
        const targetExe = resolve(shimDir, exeMatch[1]);
        if (existsSync(targetExe)) {
          return { file: targetExe, prefixArgs: [], useShell: false };
        }
      }
      // Case 2: Node script wrapper like "%_prog%" "%dp0%\node_modules\...\cli.js" %*
      const jsMatch = content.match(/"%dp0%\\([^"]+\.m?js)"\s+%\*/i);
      if (jsMatch) {
        const targetJs = resolve(shimDir, jsMatch[1]);
        if (existsSync(targetJs)) {
          return { file: process.execPath, prefixArgs: [targetJs], useShell: false };
        }
      }
    } catch {}
    return { file: foundPath, prefixArgs: [], useShell: true };
  }

  return { file: foundPath, prefixArgs: [], useShell: true };
}

/**
 * Fast, zero-overhead check whether a CLI binary exists on system PATH.
 * @param {string} binary
 * @returns {boolean}
 */
function commandExists(binary) {
  return resolveCliBinary(binary) !== null;
}

/**
 * Kills a process and its entire descendant tree (prevents orphan MCP/CLI processes on Windows).
 */
function killProcessTree(child) {
  if (!child || !child.pid) return;
  if (process.platform === 'win32') {
    try {
      spawnSync('taskkill', ['/T', '/F', '/PID', String(child.pid)], {
        windowsHide: true,
        stdio: 'ignore',
        timeout: 4000
      });
      return;
    } catch {}
  }
  try {
    child.kill('SIGKILL');
  } catch {}
}

/**
 * Safely executes a CLI command across Windows and POSIX without Node 24 DEP0190 warnings
 * and properly resolves .cmd/.exe shims (opencode, agy, claude, codex).
 * @param {string} binary
 * @param {string[]} args
 * @param {{ cwd?: string, timeoutMs?: number, env?: Record<string, string>, signal?: AbortSignal }} [options]
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number }>}
 */
function runCliProcess(
  binary,
  args = [],
  { cwd = process.cwd(), timeoutMs = 15 * 60 * 1000, env = process.env, signal = null } = {}
) {
  return new Promise((resolvePromise, reject) => {
    const isWin = process.platform === 'win32';
    const resolved = resolveCliBinary(binary);

    let child;
    if (resolved && !resolved.useShell) {
      child = spawn(resolved.file, [...resolved.prefixArgs, ...args.map((a) => String(a ?? ''))], {
        cwd,
        env,
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
    } else {
      const targetBin = resolved ? resolved.file : binary;
      const fullCommand = [quoteArg(targetBin, isWin), ...args.map((a) => quoteArg(a, isWin))].join(' ');
      child = spawn(fullCommand, [], {
        cwd,
        env,
        shell: true,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
    }

    let stdout = '';
    let stderr = '';
    let settled = false;

    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      killProcessTree(child);
      const err = new Error('Command aborted via AbortSignal');
      err.stdout = stdout;
      err.stderr = stderr;
      err.code = 130;
      reject(err);
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (signal) signal.removeEventListener('abort', onAbort);
      killProcessTree(child);
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
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      err.stdout = stdout;
      err.stderr = stderr;
      reject(err);
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      if (code === 0) {
        resolvePromise({ stdout, stderr, exitCode: 0 });
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


// --- MODULE: src/core/atomic-write.js ---
/**
 * BotAutoTask — Atomic File Writer.
 * Writes to a temporary file in the same directory, fsyncs, and renames atomically.
 * Prevents partial writes, corrupted JSON states, and crash race conditions.
 */


function atomicWriteFileSync(filePath, content, { makeBackup = false } = {}) {
  const dir = dirname(filePath);
  const base = basename(filePath);
  const tempPath = join(dir, `.${base}.${randomBytes(6).toString('hex')}.tmp`);

  try {
    // 1. Write content to temp file with fsync
    const fd = openSync(tempPath, 'w');
    writeFileSync(fd, content, 'utf8');
    fsyncSync(fd);
    closeSync(fd);

    // 2. Optionally create backup of existing file
    if (makeBackup && existsSync(filePath)) {
      const backupPath = join(dir, `${base}.bak`);
      try {
        copyFileSync(filePath, backupPath);
      } catch {}
    }

    // 3. Atomic rename to target
    renameSync(tempPath, filePath);
    return true;
  } catch (err) {
    if (existsSync(tempPath)) {
      try { unlinkSync(tempPath); } catch {}
    }
    throw err;
  }
}

function atomicWriteJsonSync(filePath, data, options = {}) {
  const str = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return atomicWriteFileSync(filePath, str, options);
}


// --- MODULE: src/core/policy.js ---
/**
 * BotAutoTask — Permission & Security Policy Engine.
 * Implements GrokBot & Neko-Bot security policies:
 * - Hard Refuse: Always blocked even in YOLO mode (destructive system calls, credential leaks).
 * - Ask Once: Destructive workspace commands requiring explicit user or phone approval.
 * - Modes: plan (read-only), default (workspace safe), auto (autonomous), yolo (unattended).
 * - Kill-Switch: Fail-closed emergency stop.
 */

const HARD_REFUSE_PATTERNS = [
  /\brm\s+-[a-z]*r[a-z]*f\s+[\/\\]/i,
  /\brm\s+-[a-z]*r[a-z]*f\s+~[\/\\]?/i,
  /\bformat\s+[a-z]:/i,
  /\brd\s+\/s(\s+\/q)?\s+[a-z]:\\/i,
  /\bmkfs(\.[a-z0-9]+)?\s+/i,
  /\bdd\s+.*of=\/dev\/(sd[a-z]|nvme|disk)/i,
  /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, // Fork bomb
  /auth\.json/i,
  /\.credentials\.json/i,
  /\.ssh[\/\\](id_rsa|id_ed25519|known_hosts)/i
];

const ASK_ONCE_PATTERNS = [
  /\brm\s+-[a-z]*r/i,
  /\brm\s+-[a-z]*f/i,
  /\bgit\s+reset\s+--hard/i,
  /\bgit\s+clean\s+-[a-z]*f/i,
  /\bgit\s+push\s+.*--force/i,
  /\bcurl\s+.*\|\s*(ba)?sh/i,
  /\bwget\s+.*\|\s*(ba)?sh/i,
  /\bsudo\s+/i,
  /\.git[\/\\](hooks|config)/i
];

function isHardRefuseCommand(command = '', path = '') {
  const target = `${command} ${path}`.trim();
  return HARD_REFUSE_PATTERNS.some((regex) => regex.test(target));
}

function isAskOnceCommand(command = '', path = '') {
  const target = `${command} ${path}`.trim();
  return ASK_ONCE_PATTERNS.some((regex) => regex.test(target));
}

/**
 * Evaluates whether an agent action should be allowed, asked, or refused.
 * Returns: 'allow' | 'ask' | 'refused'
 */
function decide({
  mode = 'default',
  yolo = false,
  action = 'exec',
  command = '',
  path = '',
  grants = [],
  killSwitch = false
} = {}) {
  // 1. Kill-Switch: If triggered or invalid, fail-closed
  if (killSwitch === true || (typeof killSwitch === 'object' && killSwitch !== null && killSwitch.isOn === false)) {
    return 'refused';
  }

  // 2. Hard Refuse: NEVER allowed under any circumstances, even with YOLO
  if (isHardRefuseCommand(command, path)) {
    return 'refused';
  }

  // Check standing user grants
  if (grants.includes(command) || grants.includes(path)) {
    return 'allow';
  }

  // 3. Ask Once: Destructive workspace actions
  if (isAskOnceCommand(command, path)) {
    if (yolo && mode === 'auto') {
      return 'allow';
    }
    return 'ask';
  }

  // 4. Mode-based evaluation
  if (mode === 'plan') {
    // Plan mode is strictly read-only
    if (action === 'read') return 'allow';
    return 'ask';
  }

  if (mode === 'default') {
    // Default mode permits read and workspace file edits, but asks for shell execution
    if (action === 'read' || action === 'write') return 'allow';
    return 'ask';
  }

  if (mode === 'auto') {
    // Auto mode executes autonomously within safety boundaries
    return 'allow';
  }

  return 'ask';
}


// --- MODULE: src/core/completion-contract.js ---
/**
 * BotAutoTask — Closed-Loop Completion Contract & Independent Validator.
 * Implements Neko-Bot & GrokBot formal verification:
 * - Up to 16 append-only criteria (no silent deletion or alteration of specs).
 * - mutation_epoch binding (validations are only valid for the exact code state they tested).
 * - gap_signature anti-looping (detects 2 consecutive identical failures -> swap core, 3 -> STALLED).
 * - No silent self-passing (goals without contracts or acceptance checks conclude as "outcome_unverified").
 */


class CompletionContract {
  constructor({ goalId, initialCriteria = [] } = {}) {
    this.goalId = goalId;
    this.criteria = [];
    this.historySignatures = [];

    for (const c of initialCriteria.slice(0, 16)) {
      this.addCriterion(c);
    }
  }

  /**
   * Appends a new criterion. Append-only: cannot modify or delete existing criteria.
   */
  addCriterion({ id, requirement, check = null }) {
    if (this.criteria.length >= 16) {
      throw new Error('Contract criteria limit reached (max 16 criteria per goal).');
    }
    const cleanId = String(id || `c-${this.criteria.length + 1}`).trim();
    if (this.criteria.some((c) => c.id === cleanId)) {
      throw new Error(`Criterion "${cleanId}" already exists in contract.`);
    }
    this.criteria.push({
      id: cleanId,
      requirement: String(requirement || '').trim(),
      check: check || null,
      addedAtEpoch: null
    });
  }

  static calculateMutationEpoch(diffOrCommitSha = '') {
    return createHash('sha256')
      .update(String(diffOrCommitSha || 'empty'))
      .digest('hex')
      .slice(0, 16);
  }

  static calculateGapSignature(failingCriteriaIds = [], mutationEpoch = '') {
    const sorted = failingCriteriaIds.slice().sort().join(',');
    return createHash('sha256')
      .update(`${sorted}:${mutationEpoch}`)
      .digest('hex')
      .slice(0, 16);
  }

  recordStepGap(failingCriteriaIds, mutationEpoch) {
    const sig = CompletionContract.calculateGapSignature(failingCriteriaIds, mutationEpoch);
    this.historySignatures.push(sig);

    const len = this.historySignatures.length;
    if (len >= 3 && this.historySignatures[len - 1] === this.historySignatures[len - 2] && this.historySignatures[len - 2] === this.historySignatures[len - 3]) {
      return { status: 'STALLED', signature: sig };
    }
    if (len >= 2 && this.historySignatures[len - 1] === this.historySignatures[len - 2]) {
      return { status: 'SWAP_CORE', signature: sig };
    }
    return { status: 'PROGRESSING', signature: sig };
  }

  /**
   * Evaluates overall contract status.
   * Returns: 'complete' | 'validation_missing' | 'validation_failed' | 'outcome_unverified'
   */
  evaluate({
    results = {}, // { [criterionId]: { passed: boolean, epoch: string } }
    currentMutationEpoch = '',
    hasAcceptanceCmd = false,
    acceptancePassed = false
  } = {}) {
    // If no contract criteria exist and no acceptance command exists -> outcome_unverified
    if (this.criteria.length === 0 && !hasAcceptanceCmd) {
      return {
        verdict: 'outcome_unverified',
        passed: false,
        summary: 'Goal completed turn without an independent verification contract or test command.'
      };
    }

    // If only acceptanceCmd exists without granular contract criteria
    if (this.criteria.length === 0 && hasAcceptanceCmd) {
      return {
        verdict: acceptancePassed ? 'complete' : 'validation_failed',
        passed: Boolean(acceptancePassed),
        summary: acceptancePassed ? 'Acceptance command passed.' : 'Acceptance command failed.'
      };
    }

    const failingIds = [];
    const missingEpochIds = [];

    for (const c of this.criteria) {
      const res = results[c.id];
      if (!res) {
        failingIds.push(c.id);
        continue;
      }
      if (res.epoch !== currentMutationEpoch) {
        missingEpochIds.push(c.id);
      } else if (!res.passed) {
        failingIds.push(c.id);
      }
    }

    if (missingEpochIds.length > 0) {
      return {
        verdict: 'validation_missing',
        passed: false,
        missingEpochIds,
        summary: 'Code was modified after validation; re-validation required for current mutation epoch.'
      };
    }

    if (failingIds.length > 0) {
      return {
        verdict: 'validation_failed',
        passed: false,
        failingIds,
        summary: `Failed criteria: ${failingIds.join(', ')}`
      };
    }

    if (hasAcceptanceCmd && !acceptancePassed) {
      return {
        verdict: 'validation_failed',
        passed: false,
        summary: 'All criteria passed but acceptance command failed.'
      };
    }

    return {
      verdict: 'complete',
      passed: true,
      summary: 'All contract criteria verified successfully on current mutation epoch.'
    };
  }
}


// --- MODULE: src/core/harness2-engine.js ---
/**
 * BotAutoTask — Google Research Harness² Engine.
 * Implements "Harness²: Recursive Agent Harnessing for an Open World" (arXiv:2610.14224).
 * Features:
 * 1. 8-Component Surface Tree (c1..c8): system prompt, guardrails, memory, tools, subagents, skills, verifiers, hooks.
 * 2. Autotrigger discovery: Automatically registers discovered skills into guardrails.
 * 3. Two-Level Recursion:
 *    - Task-Level: Propose -> Probe (Invariant & Domain worktrees) -> Compose
 *    - System-Level: Experience Library R with { cue, lesson, evidence } triples
 * 4. Context Budget & Path Validation: Rejects path escapes (..) and enforces always_on limits.
 */


const SURFACE_COMPONENTS = {
  C1_SYSTEM_PROMPT: 'c1_system_prompt',
  C2_GUARDRAILS: 'c2_guardrails',
  C3_LONG_TERM_MEMORY: 'c3_long_term_memory',
  C4_TOOL_GUIDANCE: 'c4_tool_guidance',
  C5_SUBAGENTS: 'c5_subagents',
  C6_SKILLS: 'c6_skills',
  C7_VERIFIERS: 'c7_verifiers',
  C8_HOOKS: 'c8_hooks'
};

class Harness2Engine {
  constructor({ workspaceDir = process.cwd(), alwaysOnMaxChars = 24000 } = {}) {
    this.workspaceDir = resolve(workspaceDir);
    this.alwaysOnMaxChars = alwaysOnMaxChars;
    this.libraryDir = join(this.workspaceDir, '.botautotask', 'library');
  }

  /**
   * Validates relative file paths within the surface tree.
   * Prevents directory escape (..) and unauthorized paths across Windows and POSIX.
   */
  validatePath(relativePath) {
    if (!relativePath || typeof relativePath !== 'string') return false;
    const str = String(relativePath).trim();
    if (str.startsWith('/') || str.startsWith('\\') || /^[a-zA-Z]:/.test(str)) {
      return false; // Absolute or root-relative path
    }
    const norm = normalize(str);
    if (isAbsolute(norm) || norm.startsWith('..') || norm.startsWith(`..${normalize('/')}`)) {
      return false;
    }
    return true;
  }

  /**
   * Scans discovered skills and builds auto-trigger lines for guardrails (c2).
   */
  generateAutotriggers(skills = []) {
    const lines = [];
    for (const skill of skills) {
      if (skill.name && skill.description) {
        lines.push(`- When ${skill.description}, load the ${skill.name} skill.`);
      }
    }
    return lines.join('\n');
  }

  /**
   * Validates that total always-on components (c1 + c2 + c3) do not exceed context window limits.
   */
  validateContextBudget(components = {}) {
    let totalChars = 0;
    for (const [key, content] of Object.entries(components)) {
      if ([SURFACE_COMPONENTS.C1_SYSTEM_PROMPT, SURFACE_COMPONENTS.C2_GUARDRAILS, SURFACE_COMPONENTS.C3_LONG_TERM_MEMORY].includes(key)) {
        totalChars += String(content || '').length;
      }
    }
    return {
      valid: totalChars <= this.alwaysOnMaxChars,
      totalChars,
      maxChars: this.alwaysOnMaxChars
    };
  }

  /**
   * Composes Invariant Probe and Domain Probe outputs into a unified refined Harness H*.
   */
  composeProbes({ invariantProbe = {}, domainProbe = {} } = {}) {
    const verified = invariantProbe.testPassed === true;
    return {
      success: verified,
      harness: {
        codeChanges: domainProbe.codeChanges || [],
        verifiers: invariantProbe.verifiers || [],
        guardrails: [
          ...(domainProbe.guardrails || []),
          ...(invariantProbe.guardrails || [])
        ],
        skills: domainProbe.skills || []
      },
      summary: verified
        ? 'Domain implementation verified against Invariant Probe verifiers.'
        : 'Invariant verification failed. Refinements required.'
    };
  }

  /**
   * Saves an experience entry triple: { cue, lesson, evidence }
   */
  saveExperience({ domain = 'general', name, cue, lesson, evidence }) {
    if (!cue || !lesson || !evidence) {
      throw new Error('Experience entry must contain cue, lesson, and evidence.');
    }
    const cleanDomain = String(domain).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const cleanName = String(name || `exp-${Date.now().toString(36)}`).replace(/[^a-z0-9_-]/g, '-');
    const targetDir = join(this.libraryDir, cleanDomain);
    mkdirSync(targetDir, { recursive: true });

    const content = `# EXPERIENCE ENTRY: ${cleanName}
- **Cue:** ${cue}
- **Lesson:** ${lesson}
- **Evidence:** ${evidence}
`;
    const targetFile = join(targetDir, `${cleanName}.md`);
    writeFileSync(targetFile, content, 'utf8');
    return { saved: true, file: targetFile };
  }

  /**
   * Loads all experiences for a given domain into a prompt-ready format.
   */
  loadExperiences(domain = 'general') {
    const cleanDomain = String(domain).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const targetDir = join(this.libraryDir, cleanDomain);
    if (!existsSync(targetDir)) return [];

    const entries = [];
    try {
      const files = readdirSync(targetDir).filter((f) => f.endsWith('.md'));
      for (const f of files) {
        const text = readFileSync(join(targetDir, f), 'utf8');
        entries.push(text);
      }
    } catch {}
    return entries;
  }
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
 * Default lightweight OpenCode runtime override that disables heavy external MCP servers
 * (e.g. 200-tool REA or Playwright headless servers) and duplicate global skills that
 * otherwise overflow context and trigger infinite compaction loops during automated runs.
 */
const FAST_OPENCODE_CONFIG = JSON.stringify({
  mcp: {
    playwright: { enabled: false },
    'code-review-graph': { enabled: false },
    rea: { enabled: false }
  },
  tools: {
    skill: false
  }
});

/**
 * OpenCode CLI Harness (`opencode run --pure --auto --format json -m <model> <prompt>`).
 * Supports structured NDJSON event stream parsing, session continuation (`--session`),
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
        { harnessId: this.id, modelId: 'opencode/big-pickle', isFree: true },
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

  async executeStep({ goal, journal = [], workspaceDir = process.cwd(), modelId, signal = null }) {
    const prompt = buildHandoverPrompt(goal, journal);
    const args = ['run', '--pure', '--auto'];
    if (this.useJsonFormat) {
      args.push('--format', 'json');
    }
    if (this.attachUrl) {
      args.push('--attach', this.attachUrl);
    }
    if (this.lastSessionId && goal?.reuse_session) {
      args.push('--session', this.lastSessionId);
    }
    if (modelId) {
      args.push('-m', modelId);
    }
    args.push(prompt);

    const env = {
      ...process.env,
      OPENCODE_CONFIG_CONTENT: process.env.OPENCODE_CONFIG_CONTENT || FAST_OPENCODE_CONFIG
    };

    try {
      const { stdout, stderr } = await runCliProcess(this.binary, args, {
        cwd: workspaceDir,
        timeoutMs: 10 * 60 * 1000,
        env,
        signal
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

      const fullText = streamParsed.textOutput || stdout || stderr || '';
      const parsed = parseStepTags(fullText);
      const rawLog = [
        streamParsed.toolCalls.length ? `Tools: ${streamParsed.toolCalls.join(', ')}` : '',
        fullText.slice(-800)
      ]
        .filter(Boolean)
        .join('\n');

      return {
        outcome: parsed.completed ? OUTCOME.GOAL_COMPLETED : OUTCOME.STEP_DONE,
        summary: parsed.summary,
        rawOutput: fullText,
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


// --- MODULE: src/core/worktree-manager.js ---
/**
 * BotAutoTask — Git Worktree Manager per Agent.
 * Enables multiple autonomous AI agent writers to modify code in parallel isolated git worktrees
 * without stepping on each other's files, followed by isolated verification and atomic merges.
 */


function slugifyAgentId(id = '') {
  return String(id || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'worker';
}

class WorktreeManager {
  constructor({ repoPath = process.cwd(), baseBranch = 'HEAD' } = {}) {
    this.repoPath = resolve(repoPath);
    this.baseBranch = baseBranch;
    this.worktreesRoot = join(this.repoPath, '.botautotask', 'worktrees');
    this.isGitRepo = this._checkIsGitRepo();
    if (this.isGitRepo) {
      this._ensureGitExcluded();
    }
  }

  _ensureGitExcluded() {
    try {
      const excludeFile = join(this.repoPath, '.git', 'info', 'exclude');
      if (existsSync(excludeFile)) {
        const content = readFileSync(excludeFile, 'utf8');
        if (!content.includes('.botautotask/')) {
          appendFileSync(excludeFile, '\n.botautotask/\n', 'utf8');
        }
      }
    } catch {}
  }

  _runGit(args, cwd = this.repoPath, timeoutMs = 60000) {
    const res = spawnSync('git', args, {
      cwd,
      encoding: 'utf8',
      timeout: timeoutMs,
      shell: false
    });
    return {
      status: res.status ?? 1,
      stdout: (res.stdout || '').trim(),
      stderr: (res.stderr || '').trim()
    };
  }

  _checkIsGitRepo() {
    try {
      const res = this._runGit(['rev-parse', '--is-inside-work-tree'], this.repoPath, 5000);
      return res.status === 0 && res.stdout === 'true';
    } catch {
      return false;
    }
  }

  getWorktreePath(agentId) {
    const slug = slugifyAgentId(agentId);
    return join(this.worktreesRoot, slug);
  }

  getBranchName(agentId) {
    const slug = slugifyAgentId(agentId);
    return `botautotask/agent-${slug}`;
  }

  /**
   * Ensures an isolated git worktree exists for the given agent.
   * Falls back to repoPath if the workspace is not a git repository.
   */
  ensure(agentId, baseRef = this.baseBranch) {
    if (!this.isGitRepo) {
      return {
        path: this.repoPath,
        isWorktree: false,
        warning: 'NOT_A_GIT_REPOSITORY'
      };
    }

    const wtPath = this.getWorktreePath(agentId);
    const branchName = this.getBranchName(agentId);

    // Ensure parent directory exists
    mkdirSync(this.worktreesRoot, { recursive: true });

    if (existsSync(wtPath)) {
      return { path: wtPath, branch: branchName, isWorktree: true };
    }

    // Create branch and worktree
    const addRes = this._runGit(['worktree', 'add', '-B', branchName, wtPath, baseRef]);
    if (addRes.status !== 0) {
      // Fallback: try creating without -B if branch already exists
      const fallbackRes = this._runGit(['worktree', 'add', wtPath, branchName]);
      if (fallbackRes.status !== 0) {
        throw new Error(`Failed to create worktree for agent ${agentId}: ${addRes.stderr || fallbackRes.stderr}`);
      }
    }

    return { path: wtPath, branch: branchName, isWorktree: true };
  }

  /**
   * Commits all changes in the agent's worktree.
   */
  commit(agentId, message = 'Auto-commit from agent turn') {
    const wtPath = this.getWorktreePath(agentId);
    const cwd = existsSync(wtPath) ? wtPath : this.repoPath;

    if (!this.isGitRepo) {
      return { committed: false, reason: 'NOT_A_GIT_REPOSITORY' };
    }

    // Check status
    const statusRes = this._runGit(['status', '--porcelain'], cwd);
    if (!statusRes.stdout) {
      return { committed: false, reason: 'CLEAN_WORKING_TREE' };
    }

    // Stage all changes
    this._runGit(['add', '-A'], cwd);

    // Commit
    const commitRes = this._runGit(['commit', '-m', message], cwd);
    if (commitRes.status !== 0) {
      throw new Error(`Git commit failed in worktree: ${commitRes.stderr}`);
    }

    const shaRes = this._runGit(['rev-parse', 'HEAD'], cwd);
    const statRes = this._runGit(['diff', '--stat', 'HEAD~1', 'HEAD'], cwd);

    return {
      committed: true,
      sha: shaRes.stdout,
      diffStat: statRes.stdout
    };
  }

  /**
   * Runs acceptance / test command inside the agent's worktree (or a specified cwd).
   */
  verify(agentId, cmd, timeoutMs = 300000, customCwd = null) {
    const wtPath = this.getWorktreePath(agentId);
    const cwd = customCwd || (existsSync(wtPath) ? wtPath : this.repoPath);
    const start = Date.now();

    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'powershell.exe' : '/bin/sh';
    const shellArgs = isWindows ? ['-NoProfile', '-Command', cmd] : ['-c', cmd];

    const res = spawnSync(shell, shellArgs, {
      cwd,
      encoding: 'utf8',
      timeout: timeoutMs
    });

    const durationMs = Date.now() - start;
    const passed = (res.status === 0);
    return {
      passed,
      exitCode: res.status ?? 1,
      stdout: (res.stdout || '').trim(),
      stderr: (res.stderr || '').trim(),
      durationMs
    };
  }

  /**
   * Merges the agent's worktree branch into the base branch with verification.
   */
  merge(agentId, { verifyCmd = null } = {}) {
    if (!this.isGitRepo) {
      return { success: true, isWorktree: false };
    }

    const branchName = this.getBranchName(agentId);

    // 0. Auto-commit any uncommitted edits left by the writer agent in its worktree
    try {
      this.commit(agentId, `feat(${agentId}): auto-commit agent worktree changes`);
    } catch {}

    // 1. Verify in worktree first
    if (verifyCmd) {
      const wtVerify = this.verify(agentId, verifyCmd);
      if (!wtVerify.passed) {
        return {
          success: false,
          reason: 'VERIFY_FAILED_IN_WORKTREE',
          error: wtVerify.stderr || wtVerify.stdout
        };
      }
    }

    // 2. Merge into main repository working tree
    const mergeRes = this._runGit(['merge', '--no-ff', branchName, '-m', `Merge worktree of agent ${agentId}`]);
    if (mergeRes.status !== 0) {
      // Collect conflict files
      const conflictRes = this._runGit(['diff', '--name-only', '--diff-filter=U']);
      const conflicts = conflictRes.stdout ? conflictRes.stdout.split('\n').filter(Boolean) : [];

      // Abort merge cleanly
      this._runGit(['merge', '--abort']);
      return {
        success: false,
        reason: 'MERGE_CONFLICT',
        conflicts
      };
    }

    // 3. Verify on main branch after merge
    if (verifyCmd) {
      const mainVerify = this.verify(agentId, verifyCmd, 300000, this.repoPath);
      if (!mainVerify.passed) {
        // Revert merge commit cleanly
        this._runGit(['reset', '--hard', 'HEAD~1']);
        return {
          success: false,
          reason: 'VERIFY_FAILED_ON_MAIN',
          error: mainVerify.stderr || mainVerify.stdout
        };
      }
    }

    const headShaRes = this._runGit(['rev-parse', 'HEAD']);
    return {
      success: true,
      sha: headShaRes.stdout
    };
  }

  /**
   * Cleans up worktrees and branches.
   */
  cleanup(agentId = null) {
    if (!this.isGitRepo) return;

    if (agentId) {
      const wtPath = this.getWorktreePath(agentId);
      const branchName = this.getBranchName(agentId);
      if (existsSync(wtPath)) {
        this._runGit(['worktree', 'remove', '--force', wtPath]);
      }
      this._runGit(['branch', '-D', branchName]);
    } else {
      this._runGit(['worktree', 'prune']);
      if (existsSync(this.worktreesRoot)) {
        try { rmSync(this.worktreesRoot, { recursive: true, force: true }); } catch {}
      }
    }
  }
}


// --- MODULE: src/core/agent-mesh.js ---

/**
 * Multi-Agent Mesh & Routed Loopback MCP Bridge (v2)
 * Features:
 * 1. Grok Bot & Neko-Bot schema:
 *    - 3 Delivery Modes: "send" | "interrupt" | "queue"
 *    - Subagent timeout & status: complete | still_running | not_found | error
 *    - Loop guard (detects 3 identical repeated calls)
 * 2. Parallel Isolated Git Worktrees per Writer Agent:
 *    - Writers get dedicated `.botautotask/worktrees/<agentId>`
 *    - Readers/reviewers inspect shared workspace
 *    - Verified isolated merge back into base branch
 * 3. Crash-safe atomic state writes via `atomicWriteJsonSync`
 */

const MESH_TOOLS = [
  {
    name: 'CreateAgent',
    description:
      'Create a new specialist teammate agent with a name, role ("writer" | "reader"), persona/description, and optional preferred core. Returns the new agent id.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Optional short slug id (e.g. "architect", "coder", "qa").' },
        name: { type: 'string', description: 'Human-readable name for the teammate agent.' },
        description: { type: 'string', description: 'Persona and instructions for this teammate.' },
        role: {
          type: 'string',
          enum: ['writer', 'reader'],
          description: 'Role of agent: "writer" gets an isolated git worktree; "reader" inspects shared repo.'
        },
        preferred_core: {
          type: 'string',
          description: 'Optional preferred runtime: "claude", "codex", "opencode", "antigravity", or "auto".'
        },
        base_branch: { type: 'string', description: 'Base git branch to fork worktree from.' }
      },
      required: ['name']
    }
  },
  {
    name: 'ListAgents',
    description:
      'List all teammate agents in the mesh, including their id, name, role, worktree path, live status, and recent activity.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'SendToAgent',
    description:
      'Send a task or message to another teammate agent. Supports 3 delivery modes: "send" (normal turn), "interrupt" (abort running turn and steer immediately), or "queue" (append to pending queue).',
    inputSchema: {
      type: 'object',
      properties: {
        target_id: { type: 'string', description: 'Target agent id from ListAgents (or "all" for broadcast).' },
        message: { type: 'string', description: 'Actionable instruction or handoff message for the teammate.' },
        delivery: {
          type: 'string',
          enum: ['send', 'interrupt', 'queue'],
          description: 'Delivery mode: "send" (default), "interrupt" (steer/stop current turn), or "queue" (enqueue for later).'
        },
        priority: {
          type: 'boolean',
          description: 'Legacy alias: when true, maps to delivery="interrupt".'
        },
        wait: {
          type: 'boolean',
          description: 'When true (default for "send"), awaits the target agent turn and returns reply.'
        }
      },
      required: ['target_id', 'message']
    }
  },
  {
    name: 'CheckSubagent',
    description:
      'Check how a running or completed subagent is doing. Supports timeout_ms to await completion or return still_running.',
    inputSchema: {
      type: 'object',
      properties: {
        subagent_id: {
          type: 'string',
          description: 'Agent ID to inspect. Omit to list all agents and their status.'
        },
        timeout_ms: {
          type: 'number',
          description: 'Optional milliseconds to wait for subagent to complete before returning still_running.'
        }
      }
    }
  },
  {
    name: 'MessageSubagent',
    description:
      'Inject a mid-run steering instruction into an agent without losing its context (alias for SendToAgent with delivery="queue" or "send").',
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
  },
  {
    name: 'MergeAgentWorktree',
    description: 'Atomically verifies and merges a writer agent isolated git worktree back into the main branch.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Agent ID whose worktree branch should be merged.' },
        verify_cmd: { type: 'string', description: 'Optional test/acceptance command to verify in worktree before merge.' }
      },
      required: ['agent_id']
    }
  }
];

function slugifyId(text) {
  return (
    String(text || 'agent')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || `agent-${randomUUID().slice(0, 6)}`
  );
}

function parseInlineAgentToolCalls(rawText = '') {
  const calls = [];
  const regex = /\[AGENT_TOOL:\s*(\{.+?\})\]/gs;
  let match;
  while ((match = regex.exec(rawText)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.tool) {
        calls.push({
          name: parsed.tool,
          args: parsed.args || {}
        });
      }
    } catch {}
  }
  return calls;
}

class AgentMesh {
  constructor({
    registry,
    ranker,
    workspaceDir = process.cwd(),
    stateFile = null,
    onEvent = () => {}
  } = {}) {
    this.registry = registry;
    this.ranker = ranker;
    this.workspaceDir = workspaceDir;
    this.stateFile = stateFile || `${workspaceDir}/.botautotask/mesh-state.json`;
    this.onEvent = onEvent;
    this.agents = new Map();
    this.handoffs = [];
    this.mcpBridge = null;
    this.worktreeManager = new WorktreeManager({ repoPath: workspaceDir });
    this.loopGuardCounts = new Map();

    this._seedDefaultTeam();
  }

  _seedDefaultTeam() {
    this.createAgent({
      id: 'lead',
      name: 'Team Lead (Orchestrator)',
      description:
        'Coordinates tasks under the human commander, decomposes goals, delegates to coder/reviewer, and verifies completion.',
      role: 'reader',
      preferredCore: 'auto'
    });
    this.createAgent({
      id: 'coder',
      name: 'Senior Implementation Engineer',
      description:
        'Writes clean, minimal, production-ready code and unit tests in isolated worktree using Codex / Claude / OpenCode.',
      role: 'writer',
      preferredCore: 'auto'
    });
    this.createAgent({
      id: 'reviewer',
      name: 'Adversarial Reviewer & QA',
      description:
        'Reviews git diff, runs verification checks, inspects IDE logs, and sends surgical fix requests back to coder.',
      role: 'reader',
      preferredCore: 'auto'
    });
  }

  createAgent({ id, name, description = '', role = null, preferredCore = 'auto', baseBranch = null }) {
    const cleanId = id ? slugifyId(id) : slugifyId(name);
    const existing = this.agents.get(cleanId);
    if (existing) {
      if (name) existing.name = name;
      if (description) existing.description = description;
      if (role) existing.role = role;
      if (preferredCore) existing.preferredCore = preferredCore;
      this._persistState();
      return existing;
    }

    const agent = {
      id: cleanId,
      name: name || cleanId,
      description,
      role: role === 'reader' ? 'reader' : 'writer',
      preferredCore: preferredCore || 'auto',
      baseBranch: baseBranch || null,
      worktreePath: null,
      status: 'idle',
      startedAtMs: null,
      toolCallCount: 0,
      recentActivity: [],
      pendingSteers: [],
      inbox: [],
      transcript: [],
      aborted: false,
      _abortController: null
    };
    this.agents.set(cleanId, agent);
    this._persistState();
    this.onEvent({ type: 'agent_created', agentId: cleanId, name: agent.name, role: agent.role });
    return agent;
  }

  listAgents() {
    return Array.from(this.agents.values()).map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      description: a.description,
      preferredCore: a.preferredCore,
      status: a.status,
      worktreePath: a.worktreePath,
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
    if (agent._abortController) {
      try { agent._abortController.abort(); } catch {}
    }
    agent.recentActivity.push('Aborted by StopSubagent.');
    this._persistState();
    this.onEvent({ type: 'agent_stopped', agentId });
    return { ok: true, message: `Stopped agent ${agent.name} (${agent.id}).` };
  }

  _checkAgentSync(agentId) {
    if (!agentId) {
      return {
        agents: this.listAgents(),
        latestIdeLog: this._readLatestIdeSummary()
      };
    }
    const agent = this.agents.get(agentId);
    if (!agent) {
      return { status: 'not_found', error: `No agent "${agentId}" found.`, available: this.listAgents().map((a) => a.id) };
    }

    return {
      status: agent.status === 'running' ? 'still_running' : agent.aborted ? 'error' : 'complete',
      id: agent.id,
      name: agent.name,
      role: agent.role,
      worktreePath: agent.worktreePath,
      elapsedMs: agent.startedAtMs ? Date.now() - agent.startedAtMs : 0,
      toolCallCount: agent.toolCallCount,
      recentActivity: agent.recentActivity.slice(-10),
      pendingSteers: agent.pendingSteers,
      inboxCount: agent.inbox.length,
      lastTranscriptEntry: agent.transcript.slice(-1)[0] || null,
      latestIdeLog: this._readLatestIdeSummary()
    };
  }

  async _checkAgentAsync(agentId, timeoutMs) {
    const agent = this.agents.get(agentId);
    if (!agent) return this._checkAgentSync(agentId);

    if (agent.status === 'running') {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (agent.status !== 'running') break;
        await new Promise((r) => setTimeout(r, 50));
      }
      if (agent.status === 'running') {
        return {
          status: 'still_running',
          agent_id: agentId,
          elapsedMs: agent.startedAtMs ? Date.now() - agent.startedAtMs : 0,
          toolCallCount: agent.toolCallCount
        };
      }
    }
    return this._checkAgentSync(agentId);
  }

  checkAgent(agentId, timeoutMs = 0) {
    if (timeoutMs > 0) {
      return this._checkAgentAsync(agentId, timeoutMs);
    }
    return this._checkAgentSync(agentId);
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

  async _resolveAgentHarness(agent) {
    const candidates = await this.registry.getCandidates(this.ranker, agent.preferredCore || 'auto');
    if (candidates.length > 0) {
      return { harness: candidates[0].harness, modelId: candidates[0].modelId };
    }
    throw new Error('No available AI core found for AgentMesh execution.');
  }

  /**
   * Sends a message to another agent with support for 3 delivery modes:
   * - "send": runs turn normally or queues if waiting is false.
   * - "interrupt": aborts ongoing turn and steers immediately.
   * - "queue": queues message without interrupting active work.
   */
  async sendToAgent({
    fromId = 'commander',
    targetId,
    message,
    delivery = null,
    priority = false,
    wait = true,
    depth = 0
  }) {
    if (targetId === 'all') {
      const targets = Array.from(this.agents.keys()).filter((id) => id !== fromId);
      const replies = [];
      for (const id of targets) {
        const res = await this.sendToAgent({
          fromId,
          targetId: id,
          message,
          delivery,
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

    // Loop Guard: detect identical (target, sha256(message)) repeated >= 3 times
    const msgHash = createHash('sha256').update(message).digest('hex').slice(0, 16);
    const loopKey = `${fromId}->${targetId}:${msgHash}`;
    const seenCount = (this.loopGuardCounts.get(loopKey) || 0) + 1;
    this.loopGuardCounts.set(loopKey, seenCount);
    if (seenCount >= 3) {
      return {
        delivered: false,
        error: `Loop detected: same message sent to "${targetId}" 3 times. Operation rejected.`
      };
    }

    // Resolve delivery mode
    const resolvedDelivery = delivery || (priority ? 'interrupt' : 'send');

    const handoff = {
      schema: 'neko.session-handoff/v1',
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      fromAgentId: fromId,
      targetAgentId: targetId,
      delivery: resolvedDelivery,
      priority: resolvedDelivery === 'interrupt',
      summary: message
    };
    this.handoffs.push(handoff);

    if (resolvedDelivery === 'interrupt') {
      if (target.status === 'running' && target._abortController) {
        try { target._abortController.abort(); } catch {}
        target.status = 'interrupted';
      }
      target.pendingSteers.push(`[INTERRUPT STEER from ${fromId}]: ${message}`);
      target.recentActivity.push(`Interrupted by ${fromId}: ${message.slice(0, 80)}`);
    } else if (resolvedDelivery === 'queue') {
      target.inbox.push({ fromId, message, timestamp: handoff.createdAt });
      target.recentActivity.push(`Queued message from ${fromId}: ${message.slice(0, 80)}`);
    } else {
      target.inbox.push({ fromId, message, timestamp: handoff.createdAt });
      target.recentActivity.push(`Received task from ${fromId}: ${message.slice(0, 80)}`);
    }

    this._persistState();
    this.onEvent({
      type: 'agent_message',
      id: handoff.id,
      fromId,
      targetId,
      delivery: resolvedDelivery,
      message
    });

    if (!wait || resolvedDelivery === 'queue') {
      return {
        delivered: true,
        handoffId: handoff.id,
        status: 'queued',
        delivery: resolvedDelivery,
        message: `Message ${resolvedDelivery}ed for ${target.name} (${target.id}).`
      };
    }

    const turnResult = await this.runAgentTurn(targetId, message, { fromId, depth });
    const replyText = turnResult.summary || `Completed turn (${turnResult.outcome})`;
    const replyHandoff = {
      schema: 'neko.session-handoff/v1',
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      fromAgentId: targetId,
      targetAgentId: fromId,
      delivery: 'send',
      priority: false,
      core: turnResult.harnessId ? `${turnResult.harnessId}:${turnResult.modelId || ''}` : null,
      summary: replyText
    };
    this.handoffs.push(replyHandoff);
    this._persistState();
    this.onEvent({
      type: 'team_step',
      id: replyHandoff.id,
      fromId: targetId,
      targetId: fromId,
      delivery: 'send',
      message: replyText,
      harnessId: turnResult.harnessId,
      modelId: turnResult.modelId
    });

    return {
      delivered: true,
      handoffId: handoff.id,
      replyHandoffId: replyHandoff.id,
      status: turnResult.outcome,
      reply: replyText,
      harnessId: turnResult.harnessId,
      modelId: turnResult.modelId
    };
  }

  /**
   * Orchestrates a full multi-agent squad mission across @lead -> @coder -> @reviewer -> merge,
   * streaming every inter-agent handoff in real time to the Messenger feed.
   */
  async runTeamMission({ goal, check = null } = {}) {
    const coderBefore = this.agents.get('coder')?.toolCallCount || 0;
    const reviewerBefore = this.agents.get('reviewer')?.toolCallCount || 0;
    const checkNote = check ? `\nVerification command: \`${check}\`` : '';

    // 1. Commander -> @lead (Architecture & Spec Decomposition)
    const leadRes = await this.sendToAgent({
      fromId: 'commander',
      targetId: 'lead',
      message: `${goal}${checkNote}\nInspect the project briefly and write a clear, actionable implementation specification for @coder.`,
      delivery: 'send',
      wait: true
    });

    // 2. @lead -> @coder (Isolated Git Worktree Implementation) if @lead didn't already invoke @coder inline
    const coderAfterLead = this.agents.get('coder')?.toolCallCount || 0;
    let coderRes = null;
    if (coderAfterLead === coderBefore && this.agents.has('coder')) {
      coderRes = await this.sendToAgent({
        fromId: 'lead',
        targetId: 'coder',
        message: `Task Goal: ${goal}${checkNote}\n\nLead Specification:\n${leadRes.reply}\n\nImplement the requested changes and unit tests inside your isolated worktree.`,
        delivery: 'send',
        wait: true
      });
    }

    // 3. @coder -> @reviewer (QA Verification & Diff Review)
    const reviewerAfterCoder = this.agents.get('reviewer')?.toolCallCount || 0;
    let verifyReport = '';
    if (check) {
      const vRes = this.worktreeManager.verify('coder', check);
      verifyReport = `\n\nAutomated Worktree Check (\`${check}\`): ${vRes.passed ? 'PASSED (exit 0)' : 'FAILED (exit ' + vRes.exitCode + ')'}\nOutput:\n${(vRes.stdout || vRes.stderr || '').slice(-600)}`;
    }
    if (reviewerAfterCoder === reviewerBefore && this.agents.has('reviewer')) {
      await this.sendToAgent({
        fromId: 'coder',
        targetId: 'reviewer',
        message: `Implemented changes on branch \`botautotask/agent-coder\`.\nSummary:\n${coderRes ? coderRes.reply : leadRes.reply}${verifyReport}\n\nPlease review the implementation and confirm readiness to merge.`,
        delivery: 'send',
        wait: true
      });
    }

    // 4. Auto-verify & merge @coder worktree into main branch
    const mergeOut = this.worktreeManager.merge('coder', { verifyCmd: check || null });
    const finalMsg = mergeOut.success
      ? `[MISSION COMPLETE & MERGED] Branch \`botautotask/agent-coder\` passed verification and merged into main (commit: ${(mergeOut.sha || 'HEAD').slice(0, 7)}).`
      : `[MISSION VERIFICATION NOTE] Worktree merge status: ${mergeOut.reason || 'skipped'} ${mergeOut.error ? '— ' + mergeOut.error.slice(0, 240) : ''}`;

    const finalHandoff = {
      schema: 'neko.session-handoff/v1',
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      fromAgentId: 'lead',
      targetAgentId: 'commander',
      delivery: 'send',
      priority: false,
      core: 'worktree:merger',
      summary: finalMsg
    };
    this.handoffs.push(finalHandoff);
    this._persistState();
    this.onEvent({
      type: 'team_step',
      id: finalHandoff.id,
      fromId: 'lead',
      targetId: 'commander',
      delivery: 'send',
      message: finalMsg,
      harnessId: 'worktree',
      modelId: 'merger'
    });

    return { ok: mergeOut.success, mergeOut, leadRes, coderRes };
  }

  /**
   * Executes a single turn for `agentId`, isolating writers into git worktrees.
   */
  async runAgentTurn(agentId, incomingPrompt, { fromId = 'commander', depth = 0, maxDepth = 3 } = {}) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent "${agentId}" does not exist.`);

    agent.aborted = false;
    agent.status = 'running';
    agent.startedAtMs = Date.now();
    agent.toolCallCount += 1;
    agent._abortController = new AbortController();
    this._persistState();
    this.onEvent({ type: 'agent_status', agentId, status: 'running' });

    // Isolated Worktree for writers
    let runDir = this.workspaceDir;
    if (agent.role === 'writer') {
      try {
        const wtInfo = this.worktreeManager.ensure(agent.id, agent.baseBranch || undefined);
        runDir = wtInfo.path;
        agent.worktreePath = wtInfo.path;
      } catch (err) {
        agent.recentActivity.push(`Worktree ensure warning: ${err.message}`);
      }
    }

    const steers = agent.pendingSteers.splice(0, agent.pendingSteers.length);
    const inboxItems = agent.inbox.splice(0, agent.inbox.length);

    const teammatesList = this.listAgents()
      .filter((a) => a.id !== agentId)
      .map((a) => `- id: "${a.id}" | name: "${a.name}" | role: ${a.role} | instructions: ${a.description}`)
      .join('\n');

    const promptLines = [
      `# AGENT IDENTITY`,
      `You are "${agent.name}" (id: "${agent.id}", role: "${agent.role}").`,
      `Role & Instructions: ${agent.description}`,
      agent.worktreePath ? `Isolated Worktree: ${agent.worktreePath}` : `Workspace: ${runDir}`,
      ``,
      `# TEAMMATES IN MESH (You can control/delegate to them)`,
      teammatesList || '(No other teammates yet)',
      ``,
      `# INTER-AGENT CONTROL PROTOCOL`,
      `You may delegate to other agents by calling MCP tools or outputting an inline directive:`,
      `[AGENT_TOOL: {"tool":"SendToAgent","args":{"target_id":"coder","message":"Implement X","delivery":"send"}}]`,
      `[AGENT_TOOL: {"tool":"CreateAgent","args":{"id":"qa","name":"QA Tester","role":"reader","description":"Runs unit tests"}}]`,
      `[AGENT_TOOL: {"tool":"MessageSubagent","args":{"subagent_id":"coder","message":"Switch to node:crypto"}}]`,
      ``
    ];

    if (steers.length > 0) {
      promptLines.push(`# URGENT STEERING DIRECTIVES (APPLY IMMEDIATELY)`);
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
    const primary = await this._resolveAgentHarness(agent);
    let fallbackCandidates = [];
    try {
      if (this.registry && this.ranker) {
        const allCands = await this.registry.getCandidates(this.ranker, agent.preferredCore || 'auto');
        fallbackCandidates = allCands.filter(
          (c) => !(c.harness.id === primary.harness.id && c.modelId === primary.modelId)
        );
      }
    } catch {}

    const candidates = [primary, ...fallbackCandidates];
    let stepResult = null;
    let activeHarnessId = primary.harness.id;
    let activeModelId = primary.modelId;

    for (let i = 0; i < candidates.length; i++) {
      const { harness, modelId } = candidates[i];
      activeHarnessId = harness.id;
      activeModelId = modelId;

      agent.recentActivity.push(`Running turn on ${harness.id}:${modelId} in ${runDir}`);
      this._persistState();

      try {
        stepResult = await harness.executeStep({
          goal: fullPrompt,
          journal: agent.transcript.slice(-5),
          workspaceDir: runDir,
          modelId,
          signal: agent._abortController.signal
        });
      } catch (err) {
        stepResult = {
          outcome: OUTCOME.ERROR,
          summary: `Harness execution error: ${err.message}`,
          harnessId: harness.id,
          modelId
        };
      }

      if (agent.aborted) break;

      if (stepResult.outcome === OUTCOME.RATE_LIMITED && i + 1 < candidates.length) {
        this.ranker?.markCooldown?.(harness.id, modelId);
        agent.recentActivity.push(`Rate limited on ${harness.id}:${modelId}, failing over...`);
        continue;
      }

      if (stepResult.outcome === OUTCOME.ERROR && i + 1 < candidates.length) {
        this.ranker?.markCooldown?.(harness.id, modelId, 5 * 60 * 1000);
        agent.recentActivity.push(`Error on ${harness.id}:${modelId}, failing over...`);
        continue;
      }

      break;
    }

    agent._abortController = null;

    if (agent.aborted) {
      return {
        outcome: OUTCOME.ERROR,
        summary: `Agent ${agent.id} was aborted mid-turn.`,
        harnessId: activeHarnessId,
        modelId: activeModelId
      };
    }

    // Auto-commit any edits made by a writer agent in its isolated worktree
    if (agent.role === 'writer' && agent.worktreePath) {
      try {
        const commitRes = this.worktreeManager.commit(
          agent.id,
          `feat(${agent.id}): turn ${agent.toolCallCount} via ${activeHarnessId}/${activeModelId}`
        );
        if (commitRes.committed) {
          agent.recentActivity.push(`Committed worktree (${commitRes.sha.slice(0, 7)})`);
        }
      } catch {}
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
      harnessId: activeHarnessId,
      modelId: activeModelId,
      outcome: stepResult.outcome,
      summary: combinedSummary,
      timestamp: new Date().toISOString()
    };
    agent.transcript.push(entry);
    agent.status = stepResult.outcome === OUTCOME.ERROR ? 'error' : 'idle';
    agent.recentActivity.push(`Completed turn (${stepResult.outcome})`);
    this._persistState();
    this.onEvent({ type: 'agent_status', agentId, status: agent.status });

    return {
      ...stepResult,
      summary: combinedSummary,
      harnessId: activeHarnessId,
      modelId: activeModelId
    };
  }

  async executeMeshTool(toolName, args = {}, { callerAgentId = 'commander', depth = 0 } = {}) {
    switch (toolName) {
      case 'CreateAgent': {
        const created = this.createAgent({
          id: args.id,
          name: args.name,
          description: args.description || '',
          role: args.role || 'writer',
          preferredCore: args.preferred_core || 'auto',
          baseBranch: args.base_branch || null
        });
        return {
          created: true,
          id: created.id,
          name: created.name,
          role: created.role,
          message: `Created agent "${created.name}" (id: ${created.id}, role: ${created.role}). Message it with SendToAgent.`
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
          delivery: args.delivery || null,
          priority: Boolean(args.priority),
          wait: args.wait !== false,
          depth
        });
      }
      case 'CheckSubagent': {
        return await this.checkAgent(args.subagent_id, Number(args.timeout_ms || 0));
      }
      case 'MessageSubagent': {
        return this.steerAgent(args.subagent_id, args.message, callerAgentId);
      }
      case 'StopSubagent': {
        return this.stopAgent(args.subagent_id);
      }
      case 'MergeAgentWorktree': {
        return this.worktreeManager.merge(args.agent_id, { verifyCmd: args.verify_cmd });
      }
      default:
        throw new Error(`Unknown AgentMesh tool: ${toolName}`);
    }
  }

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
            serverInfo: { name: 'botautotask-agent-mesh', version: '2.0.0' }
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
        agents: Array.from(this.agents.values()).map((a) => {
          const { _abortController, ...clean } = a;
          return clean;
        }),
        handoffs: this.handoffs.slice(-50)
      };
      atomicWriteJsonSync(this.stateFile, snapshot);
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


// --- MODULE: src/daemon/mobile-notify.js ---
/**
 * BotAutoTask — Mobile Push Notifications (ntfy.sh zero-API-key push).
 * Sends real-time alerts to phone/watch with zero setup and zero external dependencies.
 * Rule: Never send proprietary code in notification bodies; only summaries and dashboard links.
 */


function resolveNtfyConfig(override = {}) {
  const envTopic = process.env.NTFY_TOPIC || '';
  const envServer = process.env.NTFY_SERVER || 'https://ntfy.sh';

  let fileConfig = {};
  const configPath = join(homedir(), '.botautotask', 'config.json');
  if (existsSync(configPath)) {
    try {
      const parsed = JSON.parse(readFileSync(configPath, 'utf8'));
      fileConfig = parsed.ntfy || {};
    } catch {}
  }

  return {
    server: (override.server || fileConfig.server || envServer || 'https://ntfy.sh').replace(/\/$/, ''),
    topic: override.topic || fileConfig.topic || envTopic || '',
    token: override.token || fileConfig.token || process.env.NTFY_TOKEN || ''
  };
}

/**
 * Sends a notification to ntfy.sh (or self-hosted ntfy server).
 */
async function sendMobileNotification({
  title = 'BotAutoTask Alert',
  message = '',
  priority = 3,
  tags = ['robot'],
  clickUrl = '',
  actions = [],
  config = {}
} = {}) {
  const resolved = resolveNtfyConfig(config);
  if (!resolved.topic) {
    return { sent: false, reason: 'NO_TOPIC_CONFIGURED' };
  }

  const headers = {
    Title: title,
    Priority: String(priority)
  };

  if (Array.isArray(tags) && tags.length > 0) {
    headers.Tags = tags.join(',');
  } else if (typeof tags === 'string' && tags) {
    headers.Tags = tags;
  }

  if (clickUrl) {
    headers.Click = clickUrl;
  }

  if (resolved.token) {
    headers.Authorization = `Bearer ${resolved.token}`;
  }

  if (Array.isArray(actions) && actions.length > 0) {
    // Format ntfy Actions header: action=view, label=..., url=...; action=...
    headers.Actions = actions
      .map((a) => {
        if (a.action === 'view' && a.url) {
          return `view, ${a.label || 'Open'}, ${a.url}`;
        }
        return null;
      })
      .filter(Boolean)
      .join('; ');
  }

  const targetUrl = `${resolved.server}/${encodeURIComponent(resolved.topic)}`;
  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: String(message || title)
    });
    return { sent: res.ok, status: res.status };
  } catch (err) {
    return { sent: false, error: err.message };
  }
}

/**
 * Formats a notification payload for goal events (started, step completed, rate limited, finished).
 */
function formatGoalNotification({ goal, entry = null, dashboardUrl = '' }) {
  if (!goal) return null;
  const click = dashboardUrl || (goal.id ? `#goal=${goal.id}` : '');

  if (entry) {
    if (entry.outcome === 'GOAL_COMPLETED') {
      return {
        title: `✅ Goal Completed: ${goal.id}`,
        message: entry.summary || `Step ${entry.step_number} successfully finished task.`,
        priority: 4,
        tags: ['white_check_mark', 'tada', 'robot'],
        clickUrl: click
      };
    }

    if (entry.outcome === 'RATE_LIMITED') {
      return {
        title: `🔄 Rate Limit (429): Swapping Model`,
        message: `Step ${entry.step_number} hit quota with ${entry.core_used}:${entry.model_used}. Cooldown applied, auto-swapping to next free model.`,
        priority: 3,
        tags: ['warning', 'arrows_counterclockwise'],
        clickUrl: click
      };
    }

    return {
      title: `Step ${entry.step_number} (${entry.core_used}:${entry.model_used})`,
      message: entry.summary || `Finished step with outcome ${entry.outcome}.`,
      priority: 3,
      tags: ['gear'],
      clickUrl: click
    };
  }

  return {
    title: `🎯 Goal Started: ${goal.id}`,
    message: goal.target_prompt || goal.title || 'New autonomous goal dispatched.',
    priority: 3,
    tags: ['rocket'],
    clickUrl: click
  };
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


// --- MODULE: src/ui/dashboard-html.js ---
/**
 * BotAutoTask — Coworker Mesh Console (GrokBot-style edition).
 * Chat-first monochrome control surface: roster sidebar, live transcript thread,
 * contextual composer (mission dispatch / 3-mode steer), collapsible telemetry rail.
 * Zero external runtime dependencies — pure embedded HTML5/CSS3/ES2022, system fonts only.
 */

function renderDashboardHtml(sessionToken = '', { mode = 'local', cloudUrl = '' } = {}) {
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>BotAutoTask — Tactical Coworker Mesh</title>
<style>
  :root {
    color-scheme: dark;
    --bg: #000000;
    --panel: #0a0a0a;
    --panel-2: #101010;
    --panel-3: #161616;
    --line: #1f1f1f;
    --line-2: #2c2c2c;
    --fg: #ededed;
    --fg-2: #9a9a9a;
    --fg-3: #5f5f5f;
    --ok: #22c55e;
    --warn: #e5b113;
    --err: #ef4444;
    --idle: #4d4d4d;
    --mono: ui-monospace, 'Cascadia Code', 'SF Mono', Consolas, Menlo, monospace;
    --sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Roboto, 'Helvetica Neue', Arial, sans-serif;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    height: 100%;
    background: var(--bg);
    color: var(--fg);
    font-family: var(--sans);
    font-size: 14px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
    user-select: none;
  }
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #232323; border-radius: 999px; }
  ::-webkit-scrollbar-thumb:hover { background: #333; }

  .mono { font-family: var(--mono); }
  button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; }
  input, textarea, select {
    font-family: inherit; color: var(--fg); background: transparent; border: none; outline: none;
  }
  textarea { resize: none; }

  .ico { width: 15px; height: 15px; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; fill: none; flex-shrink: 0; }
  .ico-sm { width: 12px; height: 12px; }
  .ico-lg { width: 18px; height: 18px; }

  /* ─── APP SHELL ─── */
  .app { display: flex; height: 100%; }

  /* ─── SIDEBAR (roster) ─── */
  .sb {
    width: 264px; flex-shrink: 0; display: flex; flex-direction: column;
    background: var(--panel); border-right: 1px solid var(--line);
  }
  .sb-brand {
    display: flex; align-items: baseline; gap: 8px;
    padding: 18px 16px 14px;
  }
  .sb-brand b { font-size: 0.95rem; font-weight: 650; letter-spacing: -0.01em; }
  .sb-brand span { font-family: var(--mono); font-size: 0.6rem; color: var(--fg-3); letter-spacing: 0.08em; }

  .new-mission {
    margin: 0 12px 14px; padding: 9px 12px; border-radius: 8px;
    background: var(--fg); color: #000; font-size: 0.82rem; font-weight: 600;
    display: flex; align-items: center; justify-content: center; gap: 7px;
    transition: background 0.12s;
  }
  .new-mission:hover { background: #d6d6d6; }

  .sb-label {
    padding: 4px 16px 8px;
    font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.1em;
    color: var(--fg-3); display: flex; justify-content: space-between; align-items: center;
  }
  .sb-scroll { flex: 1; overflow-y: auto; padding: 0 8px; }

  .chan {
    display: flex; align-items: center; gap: 9px;
    padding: 8px 9px; border-radius: 8px; cursor: pointer;
    color: var(--fg-2); transition: background 0.1s, color 0.1s;
    position: relative;
  }
  .chan:hover { background: var(--panel-2); color: var(--fg); }
  .chan.active { background: var(--panel-3); color: var(--fg); }
  .chan.active::before {
    content: ''; position: absolute; left: -8px; top: 8px; bottom: 8px;
    width: 2px; background: var(--fg); border-radius: 2px;
  }
  .chan-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .chan-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .chan .hash { font-family: var(--mono); font-size: 0.78rem; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chan .sub { font-size: 0.66rem; color: var(--fg-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .role-pill {
    font-family: var(--mono); font-size: 0.54rem; letter-spacing: 0.06em; text-transform: uppercase;
    padding: 0 4px; border-radius: 3px; border: 1px solid var(--line-2); color: var(--fg-3); flex-shrink: 0;
  }

  .dot { width: 7px; height: 7px; border-radius: 999px; background: var(--idle); flex-shrink: 0; position: relative; }
  .dot.running { background: var(--ok); }
  .dot.running::after {
    content: ''; position: absolute; inset: -3px; border-radius: 999px;
    border: 1px solid var(--ok); opacity: 0.5; animation: pulse 1.6s ease-out infinite;
  }
  .dot.queued, .dot.composing { background: var(--warn); }
  .dot.stale { background: #8a8a8a; }
  .dot.error, .dot.aborted { background: var(--err); }
  @keyframes pulse { 0% { transform: scale(0.6); opacity: 0.7; } 100% { transform: scale(1.6); opacity: 0; } }

  .badge {
    font-family: var(--mono); font-size: 0.6rem; min-width: 17px; height: 17px;
    border-radius: 999px; background: var(--fg); color: #000;
    display: inline-flex; align-items: center; justify-content: center;
    padding: 0 5px; font-weight: 600;
  }
  .badge.hidden { display: none; }

  .sb-spawn {
    margin: 8px 12px; padding: 7px 10px; border-radius: 8px;
    border: 1px dashed var(--line-2); color: var(--fg-2);
    font-size: 0.76rem; display: flex; align-items: center; justify-content: center; gap: 6px;
    transition: border-color 0.12s, color 0.12s;
  }
  .sb-spawn:hover { border-color: var(--fg-2); color: var(--fg); }

  .sb-foot {
    padding: 10px 16px 14px; border-top: 1px solid var(--line);
    display: flex; align-items: center; justify-content: space-between;
    font-family: var(--mono); font-size: 0.6rem; color: var(--fg-3); letter-spacing: 0.05em;
  }
  .conn { display: inline-flex; align-items: center; gap: 6px; }
  .conn-dot { width: 6px; height: 6px; border-radius: 999px; background: var(--err); }
  .conn.LIVE .conn-dot { background: var(--ok); }
  .conn.POLLING .conn-dot { background: var(--warn); }
  .conn.CONNECTING .conn-dot, .conn.DISCONNECTED .conn-dot { background: var(--err); }

  /* ─── CHAT COLUMN ─── */
  .chat { flex: 1; display: flex; flex-direction: column; min-width: 0; }

  .chat-head {
    height: 54px; flex-shrink: 0; display: flex; align-items: center; gap: 12px;
    padding: 0 18px; border-bottom: 1px solid var(--line);
  }
  .ch-id { display: flex; align-items: center; gap: 11px; min-width: 0; flex: 1; }
  .ch-title { font-weight: 650; font-size: 0.9rem; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ch-sub { font-family: var(--mono); font-size: 0.62rem; color: var(--fg-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ch-actions { display: flex; align-items: center; gap: 8px; }

  .core-sel {
    font-family: var(--mono); font-size: 0.68rem; color: var(--fg-2);
    background: var(--panel-2); border: 1px solid var(--line);
    border-radius: 6px; padding: 5px 8px; max-width: 190px; cursor: pointer;
  }
  .core-sel:hover { border-color: var(--line-2); color: var(--fg); }
  .core-sel option { background: var(--panel-2); }

  .gbtn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 11px; border-radius: 7px; font-size: 0.74rem; font-weight: 550;
    border: 1px solid var(--line); color: var(--fg-2); background: transparent;
    transition: all 0.12s; white-space: nowrap;
  }
  .gbtn:hover { color: var(--fg); border-color: var(--line-2); background: var(--panel-2); }
  .gbtn.solid { background: var(--fg); color: #000; border-color: var(--fg); }
  .gbtn.solid:hover { background: #d6d6d6; }
  .gbtn.danger-armed { background: var(--err); border-color: var(--err); color: #000; }

  /* ─── THREAD (transcript) ─── */
  .thread { flex: 1; overflow-y: auto; padding: 22px 18px 12px; scroll-behavior: smooth; }

  .hero { max-width: 620px; margin: 8vh auto 0; text-align: center; }
  .hero h1 { font-size: 1.7rem; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 10px; }
  .hero p { color: var(--fg-2); font-size: 0.86rem; max-width: 460px; margin: 0 auto 26px; }
  .hero .chips { display: flex; flex-direction: column; gap: 8px; max-width: 420px; margin: 0 auto; }
  .chip {
    padding: 11px 16px; border: 1px solid var(--line); border-radius: 10px;
    color: var(--fg-2); font-size: 0.8rem; text-align: left;
    transition: border-color 0.12s, color 0.12s, background 0.12s;
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
  }
  .chip:hover { border-color: var(--line-2); color: var(--fg); background: var(--panel); }
  .chip b { color: var(--fg); font-weight: 600; }
  .chip .go { color: var(--fg-3); font-family: var(--mono); font-size: 0.7rem; }

  .day-sep { display: flex; align-items: center; gap: 12px; margin: 4px 0 18px; }
  .day-sep::before, .day-sep::after { content: ''; flex: 1; height: 1px; background: var(--line); }
  .day-sep span { font-family: var(--mono); font-size: 0.58rem; color: var(--fg-3); letter-spacing: 0.1em; }

  .msg { display: flex; flex-direction: column; margin-bottom: 16px; max-width: 78%; }
  .msg.out { margin-left: auto; align-items: flex-end; }
  .msg-meta {
    font-family: var(--mono); font-size: 0.6rem; color: var(--fg-3);
    display: flex; align-items: center; gap: 7px; margin-bottom: 5px; letter-spacing: 0.02em; flex-wrap: wrap;
  }
  .msg-meta .who { color: var(--fg-2); font-weight: 600; }
  .msg-meta .deliv { border: 1px solid var(--line); border-radius: 4px; padding: 0 4px; }
  .msg-meta .deliv.interrupt { color: var(--err); border-color: rgba(239,68,68,0.4); }
  .msg-meta .deliv.queue { color: var(--warn); border-color: rgba(229,177,19,0.35); }
  .msg-meta .core-tag { background: var(--panel-3); border: 1px solid var(--line-2); border-radius: 4px; padding: 0 5px; color: var(--fg-2); }
  .bubble {
    background: var(--panel-2); border: 1px solid var(--line);
    border-radius: 12px; padding: 10px 13px; font-size: 0.84rem; line-height: 1.55;
    white-space: pre-wrap; word-break: break-word; user-select: text; color: var(--fg);
  }
  .msg.out .bubble { background: #1c1c1c; border-color: #2b2b2b; }
  .msg.system .bubble { background: transparent; border-style: dashed; color: var(--fg-2); font-family: var(--mono); font-size: 0.72rem; }
  .bubble .quote {
    margin-top: 8px; padding: 7px 10px; border-left: 2px solid var(--line-2);
    color: var(--fg-2); font-size: 0.78rem; border-radius: 0 6px 6px 0; background: rgba(255,255,255,0.02);
  }
  .live-activity {
    display: flex; align-items: center; gap: 9px; padding: 9px 13px; margin-top: 4px;
    border: 1px dashed var(--line-2); border-radius: 10px; background: var(--panel);
    font-family: var(--mono); font-size: 0.68rem; color: var(--fg-2); max-width: 78%;
  }

  .new-pill {
    position: absolute; bottom: 108px; left: 50%; transform: translateX(-50%);
    background: var(--fg); color: #000; font-size: 0.7rem; font-weight: 600;
    border-radius: 999px; padding: 6px 13px; display: none; z-index: 5;
    box-shadow: 0 4px 18px rgba(0,0,0,0.6);
  }

  /* ─── COMPOSER ─── */
  .composer-wrap { flex-shrink: 0; padding: 12px 18px 16px; position: relative; }
  .composer {
    max-width: 780px; margin: 0 auto; border: 1px solid var(--line-2); border-radius: 14px;
    background: var(--panel); transition: border-color 0.15s;
  }
  .composer:focus-within { border-color: #3d3d3d; }
  .composer textarea {
    width: 100%; padding: 12px 14px 6px; font-size: 0.86rem; line-height: 1.5;
    max-height: 150px; color: var(--fg); user-select: text;
  }
  .composer textarea::placeholder { color: var(--fg-3); }
  .comp-row {
    display: flex; align-items: center; gap: 8px; padding: 6px 10px 9px 12px; flex-wrap: wrap;
  }
  .check-in {
    font-family: var(--mono); font-size: 0.68rem; color: var(--fg-3);
    border: 1px solid var(--line); border-radius: 6px; padding: 5px 8px; width: 168px;
  }
  .check-in:focus { color: var(--fg-2); border-color: var(--line-2); }
  .tgt-sel {
    font-family: var(--mono); font-size: 0.68rem; color: var(--fg-2);
    border: 1px solid var(--line); border-radius: 6px; padding: 5px 6px; max-width: 150px; cursor: pointer;
  }
  .tgt-sel option { background: var(--panel-2); }

  .seg { display: inline-flex; border: 1px solid var(--line); border-radius: 7px; overflow: hidden; }
  .seg button {
    font-family: var(--mono); font-size: 0.64rem; letter-spacing: 0.04em;
    padding: 5px 10px; color: var(--fg-3); transition: all 0.1s;
  }
  .seg button + button { border-left: 1px solid var(--line); }
  .seg button:hover { color: var(--fg-2); }
  .seg button.active { background: var(--fg); color: #000; font-weight: 600; }

  .sendbtn {
    margin-left: auto; width: 32px; height: 32px; border-radius: 999px;
    background: var(--fg); color: #000; display: inline-flex;
    align-items: center; justify-content: center; transition: background 0.12s, opacity 0.12s;
  }
  .sendbtn:hover { background: #d6d6d6; }
  .sendbtn:disabled { opacity: 0.3; cursor: default; }
  .comp-hint { text-align: center; font-family: var(--mono); font-size: 0.58rem; color: var(--fg-3); margin-top: 8px; letter-spacing: 0.04em; }
  .comp-hint b { color: var(--fg-2); font-weight: 500; }

  .wait-toggle { display: inline-flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 0.62rem; color: var(--fg-3); cursor: pointer; }
  .wait-toggle input { accent-color: var(--fg); cursor: pointer; }

  /* ─── TELEMETRY RAIL ─── */
  .tele {
    width: 300px; flex-shrink: 0; border-left: 1px solid var(--line);
    background: var(--panel); overflow-y: auto; display: flex; flex-direction: column;
  }
  .tele.hidden { display: none; }
  .tele-head {
    height: 54px; flex-shrink: 0; padding: 0 16px; border-bottom: 1px solid var(--line);
    display: none; align-items: center; justify-content: space-between;
    font-family: var(--mono); font-size: 0.68rem; letter-spacing: 0.08em; color: var(--fg-2);
  }
  .tsec { padding: 14px 16px; border-bottom: 1px solid var(--line); }
  .tsec h3 {
    font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.12em;
    color: var(--fg-3); font-weight: 600; margin-bottom: 11px;
    display: flex; align-items: center; gap: 7px;
  }
  .tblock {
    font-family: var(--mono); font-size: 0.66rem; color: var(--fg-2); line-height: 1.7;
    background: var(--panel-2); border: 1px solid var(--line); border-radius: 8px;
    padding: 10px 12px; white-space: pre-wrap; word-break: break-word; user-select: text;
  }
  .wt-row { border: 1px solid var(--line); border-radius: 9px; padding: 10px 11px; margin-bottom: 9px; }
  .wt-row .wt-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
  .wt-row .wt-id { font-family: var(--mono); font-size: 0.72rem; }
  .wt-row .wt-branch { font-family: var(--mono); font-size: 0.6rem; color: var(--fg-3); }
  .wt-row .wt-path { font-family: var(--mono); font-size: 0.6rem; color: var(--fg-3); margin-bottom: 8px; word-break: break-all; }
  .wt-merge {
    width: 100%; padding: 6px; border-radius: 6px; border: 1px solid var(--line-2);
    font-size: 0.7rem; color: var(--fg-2); display: flex; align-items: center; justify-content: center; gap: 6px;
    transition: all 0.12s;
  }
  .wt-merge:hover { color: var(--fg); border-color: var(--fg-2); }
  .auth-line { display: flex; align-items: center; gap: 8px; }
  .auth-line .st { font-family: var(--mono); font-size: 0.6rem; margin-left: auto; }
  .auth-line .st.ok { color: var(--ok); }
  .auth-line .st.no { color: var(--fg-3); }

  /* ─── MODAL ─── */
  .modal-bg {
    position: fixed; inset: 0; background: rgba(0,0,0,0.72); backdrop-filter: blur(3px);
    display: none; align-items: center; justify-content: center; z-index: 50;
  }
  .modal-bg.open { display: flex; }
  .modal {
    width: min(420px, calc(100vw - 40px)); background: var(--panel);
    border: 1px solid var(--line-2); border-radius: 16px; padding: 22px;
  }
  .modal h2 { font-size: 1rem; font-weight: 650; margin-bottom: 3px; }
  .modal .m-sub { font-size: 0.74rem; color: var(--fg-3); margin-bottom: 17px; }
  .field { margin-bottom: 11px; }
  .field label { display: block; font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.08em; color: var(--fg-3); margin-bottom: 5px; }
  .field input, .field select, .field textarea {
    width: 100%; background: var(--panel-2); border: 1px solid var(--line);
    border-radius: 8px; padding: 9px 11px; font-size: 0.8rem; user-select: text;
  }
  .field textarea { font-family: var(--mono); font-size: 0.72rem; }
  .field input:focus, .field select:focus, .field textarea:focus { border-color: var(--line-2); }
  .m-actions { display: flex; gap: 9px; margin-top: 16px; }
  .m-actions .gbtn { flex: 1; justify-content: center; padding: 9px; }

  /* ─── MOBILE ─── */
  .mobnav { display: none; }
  @media (max-width: 1149px) {
    .tele { position: fixed; inset: 0; width: 100%; z-index: 30; display: none; }
    .tele-head { display: flex; }
    .app.mob-insp .tele { display: flex; }
  }
  @media (max-width: 760px) {
    .sb { position: fixed; inset: 0; width: 100%; z-index: 30; display: none; }
    .app.mob-roster .sb { display: flex; }
    .app.mob-insp .tele { display: flex; }
    .mobnav {
      display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 40;
      background: rgba(10,10,10,0.92); backdrop-filter: blur(10px);
      border-top: 1px solid var(--line);
    }
    .mobnav button {
      flex: 1; padding: 11px 0 calc(11px + env(safe-area-inset-bottom));
      color: var(--fg-3); font-size: 0.66rem; font-family: var(--mono); letter-spacing: 0.06em;
      display: flex; flex-direction: column; align-items: center; gap: 3px;
    }
    .mobnav button.active { color: var(--fg); }
    .composer-wrap { padding-bottom: calc(12px + 52px); }
    .msg, .live-activity { max-width: 92%; }
    .tele-toggle { display: none; }
  }
</style>
</head>
<body>
<div class="app" id="appEl">

  <!-- ══ SIDEBAR ══ -->
  <aside class="sb" id="sbEl">
    <div class="sb-brand"><b>BotAutoTask</b><span>${mode === 'cloud' ? 'CLOUD' : 'LOCAL'}</span></div>
    <button class="new-mission" onclick="focusNewMission()">
      <svg class="ico ico-sm" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      New Mission
    </button>
    <div class="sb-label"><span>COWORKERS</span><span id="squadCount">—</span></div>
    <div class="sb-scroll">
      <div class="chan active" id="chanAll" onclick="selectChannel('all')">
        <span class="hash">#mesh-command-room</span>
        <span class="badge hidden" id="totalHandoffsBadge">0</span>
      </div>
      <div id="rosterContainer"></div>
    </div>
    <button class="sb-spawn" onclick="openSpawnModal()">
      <svg class="ico ico-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
      Add specialist
    </button>
    <div class="sb-foot">
      <span class="conn CONNECTING" id="connPill"><span class="conn-dot"></span><span id="sseText">CONNECTING</span></span>
      <span id="seqPill">—</span>
    </div>
  </aside>

  <!-- ══ CHAT COLUMN ══ -->
  <main class="chat">
    <header class="chat-head" id="chatHead"></header>
    <div class="thread" id="threadEl"></div>
    <div class="composer-wrap">
      <button class="new-pill" id="newPill" onclick="jumpToLatest()">↓ new</button>
      <div class="composer">
        <textarea id="composerInput" rows="1" placeholder="Describe the mission for the squad…"></textarea>
        <div class="comp-row" id="compRow"></div>
      </div>
      <div class="comp-hint" id="compHint"></div>
    </div>
  </main>

  <!-- ══ TELEMETRY RAIL ══ -->
  <aside class="tele" id="teleEl">
    <div class="tele-head">
      <span>TELEMETRY & WORKTREES</span>
      <button class="gbtn" onclick="closeTelemetry()">Close ×</button>
    </div>
    <div class="tsec">
      <h3><svg class="ico ico-sm" viewBox="0 0 24 24"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>WORKTREES</h3>
      <div id="worktreeList"></div>
    </div>
    <div class="tsec">
      <h3><svg class="ico ico-sm" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>ZERO-KEY SESSIONS</h3>
      <div class="tblock" id="authList">Scanning local CLI credentials…</div>
    </div>
    <div class="tsec">
      <h3><svg class="ico ico-sm" viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>IDE FEED</h3>
      <div class="tblock" id="ideTranscriptBox">No active IDE session detected.</div>
    </div>
  </aside>
</div>

<!-- ══ MOBILE NAV ══ -->
<nav class="mobnav">
  <button id="mobBtnSquad" onclick="setMobileView('roster')">
    <svg class="ico" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    Squad
  </button>
  <button id="mobBtnComms" class="active" onclick="setMobileView('comms')">
    <svg class="ico" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    Chat
  </button>
  <button id="mobBtnInsp" onclick="setMobileView('insp')">
    <svg class="ico" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/></svg>
    Telemetry
  </button>
</nav>

<!-- ══ SPAWN MODAL ══ -->
<div class="modal-bg" id="spawnModal" onclick="if(event.target===this)closeSpawnModal()">
  <div class="modal">
    <h2>Add specialist coworker</h2>
    <div class="m-sub">Spawn a new agent into the mesh with its own role and preferred AI core.</div>
    <div class="field"><label>HANDLE</label><input id="spId" placeholder="sec-audit"/></div>
    <div class="field"><label>NAME</label><input id="spName" placeholder="Security & Hardening Auditor"/></div>
    <div class="field"><label>ROLE</label>
      <select id="spRole">
        <option value="writer">writer — modifies code in isolated worktree</option>
        <option value="reader">reader — read-only analysis</option>
      </select>
    </div>
    <div class="field"><label>PREFERRED CORE</label>
      <select id="spCore">
        <option value="auto">auto (best free model)</option>
        <option value="opencode">opencode</option>
        <option value="codex">codex</option>
        <option value="claude">claude</option>
        <option value="antigravity">antigravity</option>
      </select>
    </div>
    <div class="field"><label>PERSONA</label><textarea id="spDesc" rows="3" placeholder="System persona, domain boundaries, specialized instructions…"></textarea></div>
    <div class="m-actions">
      <button class="gbtn" onclick="closeSpawnModal()">Cancel</button>
      <button class="gbtn solid" onclick="submitSpawnAgent()">Create coworker</button>
    </div>
  </div>
</div>

<script>
  // 1. Secret fragment extraction (strip #k= from address bar immediately)
  let token = '${sessionToken}';
  if (window.location.hash.startsWith('#k=')) {
    token = decodeURIComponent(window.location.hash.slice(3));
    history.replaceState(null, '', window.location.pathname);
  } else if (window.location.hash.startsWith('#token=')) {
    token = decodeURIComponent(window.location.hash.slice(7));
    history.replaceState(null, '', window.location.pathname);
  }

  let currentChannel = 'all';
  let currentDelivery = 'send';
  let currentVerifyCmd = 'npm test';
  let agentsCache = [];
  let feedItems = [];
  let unreadMap = {};
  let stopArmedTimers = {};
  let stopAllArmed = false;
  let pendingScroll = false;
  let lastStateOkTs = 0;
  let sseState = 'CONNECTING';

  const SVG = {
    send: '<svg class="ico" viewBox="0 0 24 24"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
    stop: '<svg class="ico ico-sm" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    bolt: '<svg class="ico ico-sm" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    branch: '<svg class="ico ico-sm" viewBox="0 0 24 24"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>',
    arrowRight: '<svg class="ico ico-sm" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>'
  };

  const CORE_OPTIONS = [
    { value: 'auto', label: 'auto (best free)' },
    { value: 'opencode:opencode/deepseek-v4.1-flash-free', label: 'deepseek-v4.1-free' },
    { value: 'opencode:freemodel/claude-sonnet-4-6', label: 'sonnet-4.6-free' },
    { value: 'codex', label: 'codex (OAuth)' },
    { value: 'claude', label: 'claude-code' },
    { value: 'antigravity', label: 'antigravity-ide' }
  ];

  const TEMPLATES = [
    {
      title: 'Test & refactor a module',
      goal: 'Audit module architecture, refactor brittle functions, and verify all unit tests pass',
      check: 'npm test'
    },
    {
      title: 'Parallel worktree feature',
      goal: 'Implement the feature in an isolated Git worktree, add regression tests, then run a reviewer audit',
      check: 'npm test'
    },
    {
      title: 'Security & policy audit',
      goal: 'Perform OWASP security, input boundary, and race-condition audit across all API handlers',
      check: 'npm test'
    }
  ];

  function makeNonce() {
    return 'n-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async function api(path, opts = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
      ...(opts.headers || {})
    };
    return fetch(path, { ...opts, headers });
  }

  // 2. Live SSE stream with replay & honest POLLING fallback
  function setConnState(state, seq) {
    sseState = state;
    const pill = document.getElementById('connPill');
    let label = state;
    if (state !== 'LIVE' && lastStateOkTs > 0 && Date.now() - lastStateOkTs < 9000) {
      label = 'POLLING';
    }
    document.getElementById('sseText').innerText = label;
    pill.className = 'conn ' + label;
    if (seq !== undefined) {
      document.getElementById('seqPill').innerText = '#' + seq;
    }
  }

  let esHandle = null;
  function connectStream() {
    if (esHandle) { try { esHandle.close(); } catch {} }
    const es = new EventSource('/api/events?token=' + encodeURIComponent(token));
    esHandle = es;
    es.onopen = () => setConnState('LIVE');
    es.onerror = () => setConnState('DISCONNECTED');
    es.addEventListener('frame', (evt) => {
      try {
        const frame = JSON.parse(evt.data);
        if (frame.seq) setConnState('LIVE', frame.seq);
        if (frame.t === 'hello') {
          refreshState();
          return;
        }
        handleIncomingEvent(frame);
      } catch {}
    });
  }

  function handleIncomingEvent(frame) {
    const p = frame.payload || {};
    if (frame.family === 'agent_message' || frame.family === 'agent_steered' || frame.family === 'team_step') {
      pushTimelineEvent({
        id: p.id || ('evt-' + frame.seq),
        from: p.fromId || p.from || 'commander',
        to: p.targetId || p.agentId || 'all',
        delivery: p.delivery || (p.priority ? 'interrupt' : 'send'),
        message: p.message || p.summary || '',
        reply: p.reply || null,
        core: p.harnessId ? (p.harnessId + ':' + (p.modelId || '')) : (p.core || null),
        ts: new Date().toLocaleTimeString()
      });
    }
    refreshState();
  }

  function bumpUnread(item) {
    const ch = currentChannel;
    const involves = (id) => item.from === id || item.to === id;
    if (!(ch === 'all' || involves(ch))) {
      [item.from, item.to].forEach((id) => {
        if (id && id !== 'commander' && id !== 'all') {
          unreadMap[id] = (unreadMap[id] || 0) + 1;
        }
      });
    }
  }

  function hasDuplicateItem(item) {
    if (item.id && feedItems.some((x) => x.id === item.id)) return true;
    const recent = feedItems.slice(-4);
    return recent.some((x) => x.from === item.from && x.to === item.to && x.message === item.message);
  }

  function pushTimelineEvent(item) {
    if (hasDuplicateItem(item)) return;
    feedItems.push(item);
    if (feedItems.length > 300) feedItems.shift();
    bumpUnread(item);
    document.getElementById('totalHandoffsBadge').innerText = String(feedItems.length);
    document.getElementById('totalHandoffsBadge').classList.toggle('hidden', false);
    renderRoster(agentsCache);
    renderThread();
  }

  // 3. State snapshot (merges new handoffs continuously so POLLING mode never misses messages)
  async function refreshState() {
    try {
      const res = await api('/api/state');
      if (!res.ok) return;
      const data = await res.json();
      lastStateOkTs = Date.now();
      if (sseState !== 'LIVE') setConnState(sseState);

      agentsCache = data.agents || [];
      renderRoster(agentsCache);
      renderHeader();
      renderWorktrees(agentsCache);
      renderAuthAndIde(data.auth || {}, data.latestIdeLog);

      if (Array.isArray(data.handoffs) && data.handoffs.length > 0) {
        let added = false;
        for (const h of data.handoffs) {
          const candidate = {
            id: h.id,
            from: h.fromAgentId,
            to: h.targetAgentId,
            delivery: h.delivery || (h.priority ? 'interrupt' : 'send'),
            message: h.summary,
            reply: null,
            core: h.core || null,
            ts: new Date(h.createdAt).toLocaleTimeString()
          };
          if (!hasDuplicateItem(candidate)) {
            feedItems.push(candidate);
            added = true;
          }
        }
        if (added) {
          if (feedItems.length > 300) feedItems = feedItems.slice(-300);
          document.getElementById('totalHandoffsBadge').innerText = String(feedItems.length);
          document.getElementById('totalHandoffsBadge').classList.toggle('hidden', false);
          renderThread();
        } else {
          renderThread();
        }
      } else if (feedItems.length === 0) {
        renderThread();
      }
    } catch {}
  }

  function statusOf(a) {
    if (a.status === 'running') {
      return a.elapsedMs > 90000 ? 'stale' : 'running';
    }
    if (a.status === 'error' || a.status === 'aborted') return 'error';
    if ((a.inboxCount || 0) > 0 || (a.pendingSteers || 0) > 0) return 'queued';
    return a.status || 'idle';
  }

  function renderRoster(agents) {
    document.getElementById('squadCount').innerText = agents.length + ' AGENTS';
    const container = document.getElementById('rosterContainer');
    container.innerHTML = agents.map((a) => {
      const st = statusOf(a);
      const elapsed = a.status === 'running' && a.elapsedMs ? Math.round(a.elapsedMs / 1000) + 's' : '';
      const unread = unreadMap[a.id] || 0;
      const selected = currentChannel === a.id;
      const roleLabel = a.id === 'lead' ? 'lead' : (a.role || 'writer');
      const lastAct = Array.isArray(a.recentActivity) && a.recentActivity.length > 0
        ? a.recentActivity[a.recentActivity.length - 1]
        : (a.name || a.preferredCore || 'idle');
      return \`
        <div class="chan \${selected ? 'active' : ''}" onclick="selectChannel('\${esc(a.id)}')">
          <span class="dot \${esc(st)}"></span>
          <div class="chan-body">
            <div class="chan-row">
              <span class="hash">@\${esc(a.id)}</span>
              <span class="role-pill">\${esc(roleLabel)}</span>
              \${unread ? '<span class="badge">' + unread + '</span>' : (elapsed ? '<span class="sub mono">' + elapsed + '</span>' : '')}
            </div>
            <div class="sub">\${esc(lastAct)}</div>
          </div>
        </div>\`;
    }).join('');
  }

  function renderHeader() {
    const head = document.getElementById('chatHead');
    const active = document.activeElement;
    if (active && head.contains(active) && active.tagName === 'SELECT') return;
    if (currentChannel === 'all') {
      const running = agentsCache.filter((a) => statusOf(a) === 'running').length;
      head.innerHTML = \`
        <div class="ch-id">
          <span class="dot \${running > 0 ? 'running' : ''}"></span>
          <div style="min-width:0">
            <div class="ch-title">#mesh-command-room</div>
            <div class="ch-sub">\${agentsCache.length} agents · \${running > 0 ? running + ' running now · ' : ''}all inter-agent handoffs & tool calls</div>
          </div>
        </div>
        <div class="ch-actions">
          <button class="gbtn \${stopAllArmed ? 'danger-armed' : ''}" id="stopAllBtn" onclick="triggerStopAll()">
            \${SVG.stop}<span id="stopAllText">\${stopAllArmed ? 'Confirm (3s)' : 'Stop all'}</span>
          </button>
          <button class="gbtn tele-toggle" onclick="toggleTelemetry()">Telemetry</button>
        </div>\`;
      return;
    }

    const a = agentsCache.find((x) => x.id === currentChannel);
    if (!a) { head.innerHTML = '<div class="ch-id"><div class="ch-title">@' + esc(currentChannel) + '</div></div>'; return; }
    const st = statusOf(a);
    const elapsed = a.status === 'running' && a.elapsedMs ? ' · ' + Math.round(a.elapsedMs / 1000) + 's' : '';
    const isWriter = (a.role || 'writer') === 'writer';
    const isArmed = Boolean(stopArmedTimers[a.id]);
    const coreOpts = CORE_OPTIONS.map((c) =>
      \`<option value="\${esc(c.value)}" \${a.preferredCore === c.value ? 'selected' : ''}>\${esc(c.label)}</option>\`
    ).join('');

    head.innerHTML = \`
      <div class="ch-id">
        <span class="dot \${esc(st)}"></span>
        <div style="min-width:0">
          <div class="ch-title">@\${esc(a.id)} <span style="color:var(--fg-3);font-weight:400">· \${esc(a.name)}</span></div>
          <div class="ch-sub">\${esc(st.toUpperCase())}\${elapsed} · \${a.toolCallCount || 0} calls · inbox \${a.inboxCount || 0} · steers \${a.pendingSteers || 0}</div>
        </div>
      </div>
      <div class="ch-actions">
        <select class="core-sel" onchange="changeAgentCore('\${esc(a.id)}', this.value)" title="Hot-swap AI core / model">
          \${coreOpts}
        </select>
        \${isWriter ? \`<button class="gbtn" onclick="mergeAgentWorktree('\${esc(a.id)}')" title="Verify (\${esc(currentVerifyCmd)}) & merge isolated worktree into main">\${SVG.branch} Merge</button>\` : ''}
        <button class="gbtn \${isArmed ? 'danger-armed' : ''}" onclick="armOrStopAgent('\${esc(a.id)}')">
          \${SVG.stop}<span>\${isArmed ? 'Confirm (3s)' : 'Stop'}</span>
        </button>
        <button class="gbtn tele-toggle" onclick="toggleTelemetry()">Telemetry</button>
      </div>\`;
  }

  function filteredFeed() {
    return currentChannel === 'all'
      ? feedItems
      : feedItems.filter((x) => x.from === currentChannel || x.to === currentChannel);
  }

  function renderThread() {
    const el = document.getElementById('threadEl');
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
    const items = filteredFeed();
    const runningAgents = agentsCache.filter(
      (a) => a.status === 'running' && (currentChannel === 'all' || a.id === currentChannel)
    );

    if (items.length === 0 && runningAgents.length === 0) {
      el.innerHTML = currentChannel === 'all' ? renderHero() : renderAgentEmpty();
      pendingScroll = false;
      updateNewPill(0);
      return;
    }

    const sepHtml = '<div class="day-sep"><span>SESSION TRANSCRIPT · HANDOFF PROTOCOL v1</span></div>';
    const msgsHtml = items.map((item) => {
      const mine = item.from === 'commander';
      const system = item.to === 'main-branch' || item.from === 'main-branch';
      return \`
        <div class="msg \${mine ? 'out' : ''} \${system ? 'system' : ''}">
          <div class="msg-meta">
            <span class="who">@\${esc(item.from)}</span>
            \${SVG.arrowRight}
            <span class="who">@\${esc(item.to)}</span>
            <span class="deliv \${esc(item.delivery || 'send')}">\${esc(item.delivery || 'send')}</span>
            \${item.core ? '<span class="core-tag">' + esc(item.core) + '</span>' : ''}
            <span>\${esc(item.ts)}</span>
          </div>
          <div class="bubble">\${esc(item.message)}\${item.reply ? '<div class="quote">' + esc(item.reply) + '</div>' : ''}</div>
        </div>\`;
    }).join('');

    const runningHtml = runningAgents.map((a) => {
      const sec = a.elapsedMs ? Math.round(a.elapsedMs / 1000) + 's' : '0s';
      const act = Array.isArray(a.recentActivity) && a.recentActivity.length > 0
        ? a.recentActivity[a.recentActivity.length - 1]
        : 'Executing agent turn…';
      return \`
        <div class="live-activity">
          <span class="dot running"></span>
          <span><b>@\${esc(a.id)}</b> (\${sec}) — \${esc(act)}</span>
        </div>\`;
    }).join('');

    el.innerHTML = sepHtml + msgsHtml + runningHtml;

    if (nearBottom || pendingScroll) {
      el.scrollTop = el.scrollHeight;
      pendingScroll = false;
    }
    updateNewPill(items.length);
  }

  function updateNewPill(count) {
    const el = document.getElementById('threadEl');
    const pill = document.getElementById('newPill');
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 90;
    pill.style.display = (!atBottom && count > 0) ? 'inline-flex' : 'none';
  }

  function jumpToLatest() {
    const el = document.getElementById('threadEl');
    el.scrollTop = el.scrollHeight;
  }

  function renderHero() {
    const chips = TEMPLATES.map((t, i) => \`
      <button class="chip" onclick="prefillMission(\${i})">
        <span><b>\${esc(t.title)}</b> — \${esc(t.goal.slice(0, 64))}…</span>
        <span class="go">USE ↵</span>
      </button>\`).join('');
    return \`
      <div class="hero">
        <h1>Mission ready.</h1>
        <p>Dispatch a goal to the squad — <b>@lead</b> decomposes, <b>@coder</b> implements in an isolated Git worktree, <b>@reviewer</b> verifies. Or pick a template:</p>
        <div class="chips">\${chips}</div>
      </div>\`;
  }

  function renderAgentEmpty() {
    const a = agentsCache.find((x) => x.id === currentChannel);
    const name = a ? a.name : currentChannel;
    return \`
      <div class="hero">
        <h1>@\${esc(currentChannel)}</h1>
        <p>\${esc(name || '')}. No messages in this thread yet — send the first directive with the composer below.</p>
        <div class="chips">
          <button class="chip" onclick="quickChip('Give a one-paragraph status report on current progress.')"><span><b>Status report</b> — ask for a progress summary</span><span class="go">USE ↵</span></button>
          <button class="chip" onclick="quickChip('Stay on scope. Do not touch files outside the module. Prioritize passing tests.')"><span><b>Steer scope</b> — keep the agent on target</span><span class="go">USE ↵</span></button>
        </div>
      </div>\`;
  }

  function quickChip(text) {
    const input = document.getElementById('composerInput');
    input.value = text;
    input.focus();
    autoGrow(input);
  }

  function prefillMission(idx) {
    const t = TEMPLATES[idx] || TEMPLATES[0];
    const input = document.getElementById('composerInput');
    input.value = t.goal;
    currentVerifyCmd = t.check;
    const checkEl = document.getElementById('checkInput');
    if (checkEl) checkEl.value = t.check;
    autoGrow(input);
    input.focus();
  }

  function focusNewMission() {
    selectChannel('all');
    setMobileView('comms');
    const input = document.getElementById('composerInput');
    input.focus();
    autoGrow(input);
  }

  // 4. Composer
  function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
  }

  function syncVerifyCmd(val) {
    currentVerifyCmd = String(val || '').trim();
  }

  function renderComposerRow() {
    const row = document.getElementById('compRow');
    const input = document.getElementById('composerInput');
    if (currentChannel === 'all') {
      input.placeholder = 'Describe the mission for the squad — @lead will coordinate @coder and @reviewer…';
      row.innerHTML = \`
        <input class="check-in" id="checkInput" placeholder="verify: npm test" value="\${esc(currentVerifyCmd)}" oninput="syncVerifyCmd(this.value)" title="Verification command required before completion"/>
        <button class="sendbtn" id="sendBtn" onclick="submitComposer()" title="Dispatch mission">\${SVG.send}</button>\`;
      document.getElementById('compHint').innerHTML =
        '<b>Enter</b> dispatch mission · @lead → @coder (worktree) → @reviewer · auto-failover on 429';
    } else {
      input.placeholder = 'Message @' + esc(currentChannel) + ' — direct instruction, course correction, or handoff…';
      const agents = agentsCache.length ? agentsCache : [{ id: currentChannel, name: currentChannel }];
      const opts = '<option value="all">@all (broadcast)</option>' +
        agents.map((a) => \`<option value="\${esc(a.id)}" \${a.id === currentChannel ? 'selected' : ''}>@\${esc(a.id)}</option>\`).join('');
      row.innerHTML = \`
        <select class="tgt-sel" id="dockTarget" onchange="syncChannelFromTarget()" title="Target coworker">\${opts}</select>
        <div class="seg" title="Delivery mode">
          <button id="modeSend" class="\${currentDelivery === 'send' ? 'active' : ''}" onclick="setDeliveryMode('send')">SEND</button>
          <button id="modeInterrupt" class="\${currentDelivery === 'interrupt' ? 'active' : ''}" onclick="setDeliveryMode('interrupt')">INTERRUPT</button>
          <button id="modeQueue" class="\${currentDelivery === 'queue' ? 'active' : ''}" onclick="setDeliveryMode('queue')">QUEUE</button>
        </div>
        <input class="check-in" id="checkInput" placeholder="verify cmd (optional)" value="\${esc(currentVerifyCmd)}" oninput="syncVerifyCmd(this.value)" title="Verification command used when merging worktree"/>
        <label class="wait-toggle" title="Run a full agent turn and stream the reply back"><input type="checkbox" id="dockRunTurn" checked/>run turn</label>
        <button class="sendbtn" id="sendBtn" onclick="submitComposer()" title="Transmit">\${SVG.send}</button>\`;
      document.getElementById('compHint').innerHTML =
        '<b>Enter</b> transmit · <b>Shift+Enter</b> newline · SEND delivers now · INTERRUPT kills the running turn first · QUEUE waits for turn end';
    }
  }

  function syncChannelFromTarget() {
    const sel = document.getElementById('dockTarget');
    if (!sel || sel.value === 'all') return;
    if (sel.value !== currentChannel) selectChannel(sel.value);
  }

  function setDeliveryMode(mode) {
    currentDelivery = mode;
    ['send', 'interrupt', 'queue'].forEach((m) => {
      const btn = document.getElementById('mode' + m.charAt(0).toUpperCase() + m.slice(1));
      if (btn) btn.className = m === mode ? 'active' : '';
    });
  }

  async function submitComposer() {
    const input = document.getElementById('composerInput');
    const text = input.value.trim();
    if (!text) return;

    if (currentChannel === 'all') {
      const checkEl = document.getElementById('checkInput');
      if (checkEl) currentVerifyCmd = checkEl.value.trim();
      const check = currentVerifyCmd || null;
      input.value = '';
      autoGrow(input);
      await launchTeamMission(text, check);
      return;
    }

    const target = document.getElementById('dockTarget').value;
    const wait = document.getElementById('dockRunTurn').checked;
    input.value = '';
    autoGrow(input);
    await sendDockMessage(target, text, wait);
  }

  async function sendDockMessage(target, text, wait) {
    const nonce = makeNonce();
    pendingScroll = true;
    const res = await api('/api/agents/' + encodeURIComponent(target) + '/message', {
      method: 'POST',
      body: JSON.stringify({ nonce, text, delivery: currentDelivery, wait })
    });
    const out = await res.json().catch(() => ({}));
    setHint(out.status === 'duplicate'
      ? 'Duplicate nonce ignored — nothing re-sent'
      : 'Acked · ' + (out.status || out.delivered || currentDelivery));
    refreshState();
  }

  async function launchTeamMission(goal, check) {
    const nonce = makeNonce();
    pendingScroll = true;
    const res = await api('/api/team/start', {
      method: 'POST',
      body: JSON.stringify({ nonce, goal, check: check || null })
    });
    const out = await res.json().catch(() => ({}));
    setHint(out.status === 'dispatched'
      ? 'Mission dispatched to @lead — live progress streams below'
      : 'Dispatch reply: ' + JSON.stringify(out));
    refreshState();
  }

  function setHint(html) {
    const hint = document.getElementById('compHint');
    const prev = hint.dataset.base || hint.innerHTML;
    hint.dataset.base = prev;
    hint.innerHTML = '<b>' + esc(html) + '</b>';
    setTimeout(() => { if (hint.dataset.base) hint.innerHTML = hint.dataset.base; }, 4000);
  }

  // 5. Channel & controls
  function selectChannel(chanId) {
    const checkEl = document.getElementById('checkInput');
    if (checkEl) currentVerifyCmd = checkEl.value.trim();
    currentChannel = chanId;
    unreadMap[chanId] = 0;
    document.getElementById('chanAll').className = 'chan' + (chanId === 'all' ? ' active' : '');
    renderRoster(agentsCache);
    renderHeader();
    renderComposerRow();
    pendingScroll = true;
    renderThread();
    setMobileView('comms');
  }

  async function changeAgentCore(agentId, preferredCore) {
    await api('/api/agents/' + encodeURIComponent(agentId) + '/core', {
      method: 'POST',
      body: JSON.stringify({ nonce: makeNonce(), preferredCore })
    });
    setHint('@' + agentId + ' core → ' + preferredCore);
    refreshState();
  }

  async function armOrStopAgent(agentId) {
    if (!stopArmedTimers[agentId]) {
      stopArmedTimers[agentId] = setTimeout(() => {
        delete stopArmedTimers[agentId];
        renderHeader();
      }, 3000);
      renderHeader();
      return;
    }
    clearTimeout(stopArmedTimers[agentId]);
    delete stopArmedTimers[agentId];
    await api('/api/agents/' + encodeURIComponent(agentId) + '/stop', {
      method: 'POST',
      body: JSON.stringify({ nonce: makeNonce(), confirm: true })
    });
    setHint('@' + agentId + ' stopped');
    refreshState();
  }

  async function triggerStopAll() {
    if (!stopAllArmed) {
      stopAllArmed = true;
      renderHeader();
      setTimeout(() => { stopAllArmed = false; renderHeader(); }, 3000);
      return;
    }
    stopAllArmed = false;
    renderHeader();
    await api('/api/agents/stop-all', {
      method: 'POST',
      body: JSON.stringify({ nonce: makeNonce(), confirm: true })
    });
    setHint('All agents stopped');
    refreshState();
  }

  async function mergeAgentWorktree(agentId) {
    const checkEl = document.getElementById('checkInput');
    if (checkEl) currentVerifyCmd = checkEl.value.trim();
    const verifyCmd = currentVerifyCmd || null;
    const res = await api('/api/agents/' + encodeURIComponent(agentId) + '/merge', {
      method: 'POST',
      body: JSON.stringify({ nonce: makeNonce(), verifyCmd })
    });
    const out = await res.json().catch(() => ({}));
    pendingScroll = true;
    pushTimelineEvent({
      id: 'merge-' + Date.now(),
      from: agentId,
      to: 'main-branch',
      delivery: 'send',
      message: out.success
        ? 'Worktree verified & merged into main (commit ' + (out.sha || 'HEAD') + ')'
        : 'Merge aborted (' + (out.reason || 'conflict') + '): ' + JSON.stringify(out.conflicts || out.error || ''),
      ts: new Date().toLocaleTimeString()
    });
    refreshState();
  }

  function toggleTelemetry() {
    if (window.innerWidth < 1150) {
      document.getElementById('appEl').classList.toggle('mob-insp');
      return;
    }
    const el = document.getElementById('teleEl');
    el.classList.toggle('hidden');
  }

  function closeTelemetry() {
    document.getElementById('appEl').classList.remove('mob-insp');
    if (window.innerWidth >= 1150) {
      document.getElementById('teleEl').classList.add('hidden');
    } else {
      setMobileView('comms');
    }
  }

  // 6. Telemetry rail
  function renderWorktrees(agents) {
    const wtList = document.getElementById('worktreeList');
    const writers = agents.filter((a) => (a.role || 'writer') === 'writer');
    if (writers.length === 0) {
      wtList.innerHTML = '<div class="tblock">No writer agents registered.</div>';
      return;
    }
    wtList.innerHTML = writers.map((w) => \`
      <div class="wt-row">
        <div class="wt-top">
          <span class="wt-id">@\${esc(w.id)}</span>
          <span class="dot \${esc(statusOf(w))}"></span>
        </div>
        <div class="wt-branch">botautotask/agent-\${esc(w.id)}</div>
        <div class="wt-path">\${esc(w.worktreePath || '.botautotask/worktrees/' + w.id)}</div>
        <button class="wt-merge" onclick="mergeAgentWorktree('\${esc(w.id)}')">
          \${SVG.branch} Verify & merge
        </button>
      </div>\`).join('');
  }

  function renderAuthAndIde(auth, ideLog) {
    const authEl = document.getElementById('authList');
    const entries = Object.entries(auth || {});
    if (entries.length === 0) {
      authEl.innerText = 'No auth bridge data.';
    } else {
      authEl.innerHTML = entries.map(([k, v]) => {
        const ok = v.authenticated || v.signedIn;
        const badge = ok ? '● IN' : (v.installed ? '○ INSTALLED' : '○ NOT FOUND');
        return '<span class="auth-line"><span>' + esc(k) + '</span><span class="st ' + (ok ? 'ok' : 'no') + '">' + badge + '</span></span>';
      }).join('');
    }

    const ideEl = document.getElementById('ideTranscriptBox');
    if (!ideLog) {
      ideEl.innerText = 'No active Antigravity IDE transcript found.';
    } else {
      ideEl.innerText = 'Status: ' + (ideLog.status || 'IDLE') + '\\n\\n' + (ideLog.lastResponse || '');
    }
  }

  // 7. Spawn modal
  function openSpawnModal() { document.getElementById('spawnModal').classList.add('open'); }
  function closeSpawnModal() { document.getElementById('spawnModal').classList.remove('open'); }

  async function submitSpawnAgent() {
    const id = document.getElementById('spId').value.trim();
    const name = document.getElementById('spName').value.trim();
    const role = document.getElementById('spRole').value;
    const preferredCore = document.getElementById('spCore').value;
    const description = document.getElementById('spDesc').value.trim();
    if (!name) return;

    await api('/api/agents', {
      method: 'POST',
      body: JSON.stringify({ nonce: makeNonce(), id, name, role, preferredCore, description })
    });
    closeSpawnModal();
    if (id) selectChannel(id);
    refreshState();
  }

  // 8. Mobile views
  function setMobileView(view) {
    const app = document.getElementById('appEl');
    app.classList.remove('mob-roster', 'mob-insp');
    if (view === 'roster') app.classList.add('mob-roster');
    if (view === 'insp') app.classList.add('mob-insp');
    document.getElementById('mobBtnSquad').className = view === 'roster' ? 'active' : '';
    document.getElementById('mobBtnComms').className = view === 'comms' ? 'active' : '';
    document.getElementById('mobBtnInsp').className = view === 'insp' ? 'active' : '';
  }

  // 9. Boot
  const composerInput = document.getElementById('composerInput');
  composerInput.addEventListener('input', () => autoGrow(composerInput));
  composerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitComposer();
    }
  });
  document.getElementById('threadEl').addEventListener('scroll', () => updateNewPill(filteredFeed().length));

  renderComposerRow();
  renderHeader();
  connectStream();
  refreshState();
  setInterval(() => {
    if (!document.hidden) refreshState();
  }, 2500);
  // Watchdog: reconnect whenever sseState !== 'LIVE' (including when displaying POLLING) or EventSource is CLOSED
  setInterval(() => {
    if (!esHandle || esHandle.readyState === 2 || sseState !== 'LIVE') connectStream();
  }, 5000);
</script>
</body>
</html>`;
}


// --- MODULE: src/daemon/web-ui.js ---
/**
 * BotAutoTask — Local Web & Mobile Control Center UI Server.
 * Zero-dependency HTTP + Server-Sent Events (SSE) coordinator server for multi-agent
 * real-time monitoring, live transcript streaming, 3-mode steering, core hot-swapping,
 * specialist spawning, and isolated Git Worktree merging.
 */



class LocalWebUiServer {
  constructor({ mesh, port = 8765, token = null } = {}) {
    this.mesh = mesh;
    this.port = port;
    this.token = token || randomBytes(16).toString('hex');
    this.server = null;
    this.sseClients = new Set();
    this.eventRingBuffer = [];
    this.currentSeq = 1000;
    this.seenNonces = new Map();

    // Hook into mesh events so every inter-agent message/steer/creation streams to UI
    if (this.mesh) {
      const origEvent = this.mesh.onEvent || (() => {});
      this.mesh.onEvent = (evt) => {
        origEvent(evt);
        this.broadcastEvent(evt.type || 'agent_message', evt);
      };
    }
  }

  broadcastEvent(family, payload) {
    this.currentSeq++;
    const frame = { t: 'event', family, seq: this.currentSeq, payload };
    this.eventRingBuffer.push(frame);
    if (this.eventRingBuffer.length > 500) {
      this.eventRingBuffer.shift();
    }

    const sseData = `id: ${this.currentSeq}\nevent: frame\ndata: ${JSON.stringify(frame)}\n\n`;
    for (const client of this.sseClients) {
      try {
        client.write(sseData);
      } catch {}
    }
  }

  _isAuthorized(req, url) {
    const authHeader = req.headers.authorization || '';
    if (authHeader === `Bearer ${this.token}`) return true;
    const qToken = url.searchParams.get('token');
    return qToken === this.token;
  }

  _checkOrigin(req) {
    const host = req.headers.host || '';
    const origin = req.headers.origin || '';
    const isLocalHost = host.startsWith('127.0.0.1') || host.startsWith('localhost');
    if (!isLocalHost) return false;
    if (origin) {
      return origin.includes('127.0.0.1') || origin.includes('localhost');
    }
    return true;
  }

  _checkDuplicateNonce(nonce, res) {
    if (!nonce) return false;
    if (this.seenNonces.has(nonce)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'duplicate', nonce }));
      return true;
    }
    this.seenNonces.set(nonce, Date.now());
    if (this.seenNonces.size > 2000) {
      const firstKey = this.seenNonces.keys().next().value;
      this.seenNonces.delete(firstKey);
    }
    return false;
  }

  async start() {
    this.server = createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

      // Security check: DNS rebinding & cross-origin CSRF prevention
      if (!this._checkOrigin(req)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' }).end('Forbidden: Invalid Host or Origin');
        return;
      }

      // 1. Serve Tactical Coworker Command Center HTML
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(renderDashboardHtml(this.token, { mode: 'local' }));
        return;
      }

      // 2. SSE Event Stream with Last-Event-ID Ring-Buffer Replay
      if (req.method === 'GET' && url.pathname === '/api/events') {
        if (!this._isAuthorized(req, url)) {
          res.writeHead(401, { 'Content-Type': 'text/plain' }).end('Unauthorized');
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });

        this.sseClients.add(res);

        // Send initial hello handshake
        res.write(
          `id: ${this.currentSeq}\nevent: frame\ndata: ${JSON.stringify({
            t: 'hello',
            protocolVersion: 1,
            seq: this.currentSeq
          })}\n\n`
        );

        // Replay missed events if Last-Event-ID is provided
        const lastId = parseInt(req.headers['last-event-id'] || url.searchParams.get('lastEventId') || '', 10);
        if (!isNaN(lastId)) {
          for (const f of this.eventRingBuffer) {
            if (f.seq > lastId) {
              res.write(`id: ${f.seq}\nevent: frame\ndata: ${JSON.stringify(f)}\n\n`);
            }
          }
        }

        // Keep-alive comment ping: some embedded webviews/proxies drop idle SSE streams
        const keepAlive = setInterval(() => {
          try {
            res.write(': ping\n\n');
          } catch {
            clearInterval(keepAlive);
          }
        }, 10_000);

        req.on('close', () => {
          clearInterval(keepAlive);
          this.sseClients.delete(res);
        });
        return;
      }

      // Authenticate all API routes (fail-closed)
      if (!this._isAuthorized(req, url)) {
        res.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      const readJson = async () => {
        let body = '';
        for await (const chunk of req) {
          body += String(chunk);
          if (body.length > 1_048_576) throw new Error('Body too large');
        }
        return JSON.parse(body || '{}');
      };

      // 3. GET /api/state — Full Roster, Handoffs, 0-Key Auth & IDE Transcript
      if (req.method === 'GET' && url.pathname === '/api/state') {
        const agents = this.mesh ? this.mesh.listAgents() : [];
        const handoffs = this.mesh ? this.mesh.handoffs.slice(-40) : [];
        const auth = await getZeroKeyAuthStatus();
        let latestIdeLog = null;
        try {
          const info = findLatestAntigravityTranscript();
          if (info) {
            latestIdeLog = {
              conversationId: info.conversationId,
              status: info.summary?.lastStatus,
              lastResponse: info.summary?.lastAgentResponse?.slice(0, 400)
            };
          }
        } catch {}

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ agents, handoffs, auth, latestIdeLog }));
        return;
      }

      // 4. POST /api/agents — Spawn a new specialist coworker
      if (req.method === 'POST' && url.pathname === '/api/agents') {
        const body = await readJson().catch(() => ({}));
        if (this._checkDuplicateNonce(body.nonce, res)) return;
        if (!body.name) {
          res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Missing name' }));
          return;
        }
        if (this.mesh) {
          const created = this.mesh.createAgent({
            id: body.id,
            name: body.name,
            role: body.role || 'writer',
            description: body.description || '',
            preferredCore: body.preferredCore || 'auto'
          });
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ created: true, agent: created }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ created: true }));
        }
        return;
      }

      // 5. POST /api/agents/:id/message — Send / Interrupt / Queue
      const msgMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/message$/);
      if (req.method === 'POST' && msgMatch) {
        const targetId = decodeURIComponent(msgMatch[1]);
        const body = await readJson().catch(() => ({}));
        if (this._checkDuplicateNonce(body.nonce, res)) return;

        if (this.mesh) {
          const shouldWait = Boolean(body.wait);
          if (shouldWait) {
            // Run asynchronously so HTTP returns accepted immediately and SSE streams the turn result
            this.mesh
              .sendToAgent({
                fromId: 'commander',
                targetId,
                message: body.text || '',
                delivery: body.delivery || 'send',
                wait: true
              })
              .catch((err) => {
                this.broadcastEvent('team_step', {
                  fromId: targetId,
                  targetId: 'commander',
                  delivery: 'interrupt',
                  message: `Error: ${err.message}`
                });
              });
            res.writeHead(200, { 'Content-Type': 'application/json' }).end(
              JSON.stringify({ delivered: true, status: 'accepted', delivery: body.delivery || 'send' })
            );
          } else {
            const out = await this.mesh.sendToAgent({
              fromId: 'commander',
              targetId,
              message: body.text || '',
              delivery: body.delivery || 'send',
              wait: false
            });
            res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(out));
          }
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ delivered: true }));
        }
        return;
      }

      // 6. POST /api/agents/:id/core — Hot-swap preferred AI core/model
      const coreMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/core$/);
      if (req.method === 'POST' && coreMatch) {
        const agentId = decodeURIComponent(coreMatch[1]);
        const body = await readJson().catch(() => ({}));
        if (this._checkDuplicateNonce(body.nonce, res)) return;

        if (this.mesh && body.preferredCore) {
          this.mesh.createAgent({ id: agentId, preferredCore: body.preferredCore });
          this.broadcastEvent('agent_message', {
            fromId: 'commander',
            targetId: agentId,
            delivery: 'send',
            message: `Switched preferred AI core to "${body.preferredCore}".`
          });
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true }));
        return;
      }

      // 7. POST /api/agents/:id/merge — Verify & Merge isolated Git worktree
      const mergeMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/merge$/);
      if (req.method === 'POST' && mergeMatch) {
        const agentId = decodeURIComponent(mergeMatch[1]);
        const body = await readJson().catch(() => ({}));
        if (this._checkDuplicateNonce(body.nonce, res)) return;

        if (this.mesh) {
          const out = await this.mesh.executeMeshTool('MergeAgentWorktree', {
            agent_id: agentId,
            verify_cmd: body.verifyCmd || null
          });
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(out));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: true }));
        }
        return;
      }

      // 8. POST /api/agents/:id/stop — 2-step confirmed Stop
      const stopMatch = url.pathname.match(/^\/api\/agents\/([^/]+)\/stop$/);
      if (req.method === 'POST' && stopMatch) {
        const agentId = decodeURIComponent(stopMatch[1]);
        const body = await readJson().catch(() => ({}));
        if (!body.confirm) {
          res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Missing confirm: true' }));
          return;
        }
        const out = this.mesh ? this.mesh.stopAgent(agentId) : { ok: true };
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(out));
        return;
      }

      // 9. POST /api/agents/stop-all — Promise.allSettled emergency stop
      if (req.method === 'POST' && url.pathname === '/api/agents/stop-all') {
        const body = await readJson().catch(() => ({}));
        if (!body.confirm) {
          res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Missing confirm: true' }));
          return;
        }
        const agents = this.mesh ? this.mesh.listAgents() : [];
        const results = await Promise.allSettled(
          agents.map((a) => (this.mesh ? Promise.resolve(this.mesh.stopAgent(a.id)) : Promise.resolve()))
        );
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ stopped: results.length }));
        return;
      }

      // 10. POST /api/team/start — Dispatch autonomous squad mission (@lead -> @coder -> @reviewer -> merge)
      if (req.method === 'POST' && url.pathname === '/api/team/start') {
        const body = await readJson().catch(() => ({}));
        if (this._checkDuplicateNonce(body.nonce, res)) return;
        const goal = String(body.goal || '').trim();
        if (!goal) {
          res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Missing goal' }));
          return;
        }

        if (this.mesh) {
          const runFn = typeof this.mesh.runTeamMission === 'function'
            ? () => this.mesh.runTeamMission({ goal, check: body.check || null })
            : () =>
                this.mesh.sendToAgent({
                  fromId: 'commander',
                  targetId: 'lead',
                  message: `${goal}\nCoordinate with @coder and @reviewer to implement, test, and verify.`,
                  delivery: 'send',
                  wait: true
                });

          runFn().catch((err) => {
            this.broadcastEvent('team_step', {
              fromId: 'lead',
              targetId: 'commander',
              delivery: 'interrupt',
              message: `Squad execution error: ${err.message}`
            });
          });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ status: 'dispatched', goal }));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not Found');
    });

    let attempts = 0;
    while (true) {
      try {
        await new Promise((resolve, reject) => {
          const onError = (err) => {
            this.server.removeListener('listening', onListening);
            reject(err);
          };
          const onListening = () => {
            this.server.removeListener('error', onError);
            resolve();
          };
          this.server.once('error', onError);
          this.server.once('listening', onListening);
          this.server.listen(this.port, '127.0.0.1');
        });
        break;
      } catch (err) {
        if (err.code === 'EADDRINUSE' && this.port !== 0 && attempts < 10) {
          attempts++;
          this.port = attempts < 10 ? this.port + 1 : 0;
          continue;
        }
        throw err;
      }
    }

    const addr = this.server.address();
    this.port = addr.port;
    this.url = `http://127.0.0.1:${this.port}/#k=${this.token}`;
    return this;
  }

  async close() {
    for (const c of this.sseClients) {
      try {
        c.end();
      } catch {}
    }
    this.sseClients.clear();
    if (this.server) {
      await new Promise((resolve) => this.server.close(resolve));
      this.server = null;
    }
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
            console.log(`[BotAutoTask] Acquired Cloud Goal ${goal.id}: ${goal.title} (epoch: ${goal.lease_epoch || 0})`);
            const orchestrator = new GoalOrchestrator({
              registry: this.registry,
              ranker: this.ranker,
              gitCheckpoint: true,
              onNotify: (msg) => console.log(msg),
              onJournalEntry: async (entry) => {
                await fetch(`${this.cloudUrl}/api/lease/step`, {
                  method: 'POST',
                  headers: this._headers(),
                  body: JSON.stringify({
                    ...entry,
                    worker_id: this.workerId,
                    lease_epoch: goal.lease_epoch
                  })
                }).catch(() => {});

                const notif = formatGoalNotification({ goal, entry, dashboardUrl: `${this.cloudUrl}/#token=${this.apiToken}` });
                if (notif && (entry.outcome === 'GOAL_COMPLETED' || entry.outcome === 'RATE_LIMITED')) {
                  await sendMobileNotification({ ...notif, config: this.config.ntfy || {} }).catch(() => {});
                }
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

  if (subcommand === 'ui' || subcommand === 'dashboard') {
    const { flags } = parseCliFlags(rest);
    const port = parseInt(flags.port || '8765', 10);
    const mesh = new AgentMesh({ registry, ranker, workspaceDir: flags.path || process.cwd() });
    const ui = new LocalWebUiServer({ mesh, port });
    await ui.start();
    console.log(`[BotAutoTask] Local Web UI live at: ${ui.url}`);
    console.log(`Open in browser to monitor agents, stream logs, and steer tasks.`);
    if (flags.open === 'true') {
      const { exec } = await import('node:child_process');
      const startCmd = process.platform === 'win32' ? `start "" "${ui.url}"` : `open "${ui.url}"`;
      exec(startCmd);
    }
    return;
  }

  console.log(`BotAutoTask CLI — Pluggable Multi-Core & Free-Model Orchestrator
Commands:
  botautotask cores                                         List all pluggable AI cores & health
  botautotask auth                                          Inspect Zero-API-Key local login sessions
  botautotask models                                        Discover & rank best free/idle models
  botautotask agents                                        List Multi-Agent Mesh coworkers & status
  botautotask ui [--port 8765] [--open]                     Open local live multi-agent control web UI
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
