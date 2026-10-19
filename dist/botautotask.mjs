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
        .filter((l) => l && /^[a-z0-9_.-]+\/[a-z0-9_./:-]+$/i.test(l) && !/^freemodel\//i.test(l));

      if (lines.length === 0) throw new Error('No model lines parsed');

      return lines.map((modelId) => ({
        harnessId: 'opencode',
        modelId,
        isFree: /free|opencode\/|luna|pickle|grok|gemini/i.test(modelId)
      }));
    } catch {
      return [
        { harnessId: 'opencode', modelId: 'opencode/big-pickle', isFree: true },
        { harnessId: 'opencode', modelId: 'opencode/mimo-v2.6-flash-free', isFree: true },
        { harnessId: 'opencode', modelId: 'opencode/deepseek-v4.1-flash-free', isFree: true }
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
 * OpenCode CLI Harness (`opencode run --pure --format json -m <model> <prompt>`).
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
        { harnessId: this.id, modelId: 'opencode/big-pickle', isFree: true },
        { harnessId: this.id, modelId: 'opencode/mimo-v2.6-flash-free', isFree: true },
        { harnessId: this.id, modelId: 'opencode/deepseek-v4.1-flash-free', isFree: true }
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

  async executeStep({
    goal,
    journal = [],
    workspaceDir = process.cwd(),
    modelId,
    role = 'writer',
    signal = null
  }) {
    const prompt = buildHandoverPrompt(goal, journal);
    const args = ['run', '--pure'];
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
    const timeoutMs = role === 'reader' ? 60 * 1000 : 120 * 1000;

    try {
      const { stdout, stderr } = await runCliProcess(this.binary, args, {
        cwd: workspaceDir,
        timeoutMs,
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
      const wtStatus = this._runGit(['status', '--porcelain'], wtPath);
      if (!wtStatus.stdout) {
        const ffRes = this._runGit(['merge', '--no-edit', baseRef], wtPath);
        if (ffRes.status !== 0) {
          this._runGit(['merge', '--abort'], wtPath);
        }
      }
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

    // 2. Clean any colliding uncommitted/untracked files in main working tree so verified worktree merges cleanly
    const changedRes = this._runGit(['diff', '--name-only', `HEAD...${branchName}`]);
    const changedFiles = changedRes.stdout ? changedRes.stdout.split(/\r?\n/).filter(Boolean) : [];
    for (const f of changedFiles) {
      this._runGit(['checkout', '--', f]);
      this._runGit(['clean', '-f', '--', f]);
    }

    // 3. Merge into main repository working tree
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
        conflicts,
        error: mergeRes.stderr || mergeRes.stdout
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
      message: `${goal}${checkNote}\nDo NOT call any tools (no bash/read/glob). Immediately output a concise 4-bullet implementation specification for @coder.`,
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
        message: `Task Goal: ${goal}${checkNote}\n\nLead Specification:\n${leadRes.reply}\n\nVerify and summarize the implemented changes in your isolated worktree in one concise response (do not run slow multi-step loops).`,
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
        message: `Implemented changes on branch \`botautotask/agent-coder\`.\nSummary:\n${coderRes ? coderRes.reply : leadRes.reply}${verifyReport}\n\nDo NOT call any tools. Review the verification output above and confirm readiness to merge in 3 concise bullet points.`,
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
          role: agent.role,
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
        const mergeOut = this.worktreeManager.merge(args.agent_id, { verifyCmd: args.verify_cmd });
        const msg = mergeOut.success
          ? `[MISSION COMPLETE & MERGED] Branch \`${this.worktreeManager.getBranchName(args.agent_id)}\` passed verification and merged into main (commit: ${(mergeOut.sha || 'HEAD').slice(0, 7)}).`
          : `[MERGE FAILED] ${mergeOut.reason || 'error'}${mergeOut.error ? ': ' + mergeOut.error.slice(0, 240) : ''}`;
        const h = {
          schema: 'neko.session-handoff/v1',
          id: randomUUID(),
          createdAt: new Date().toISOString(),
          fromAgentId: args.agent_id || 'coder',
          targetAgentId: 'commander',
          delivery: 'send',
          priority: false,
          core: 'worktree:merger',
          summary: msg
        };
        this.handoffs.push(h);
        this._persistState();
        this.onEvent({
          type: 'team_step',
          id: h.id,
          fromId: h.fromAgentId,
          targetId: 'commander',
          delivery: 'send',
          message: msg,
          harnessId: 'worktree',
          modelId: 'merger'
        });
        return mergeOut;
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
              status: a.status === 'running' ? 'idle' : a.status || 'idle',
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
 * BotAutoTask — Web Dashboard UI.
 * Clean 2-column chat layout (Messenger / Telegram style):
 *   - Left sidebar: chat list (group channel + AI coworkers), search, connection state
 *   - Right: conversation with left/right bubbles, typing indicator, composer
 *   - Ocean-blue primary palette (#0284C7) with light / deep-ocean dark themes
 *   - Original friendly whale mascot (pure inline SVG, no external assets)
 */

function renderDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="vi" data-theme="ocean-light">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>BotAutoTask — Tactical Coworker Mesh</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230284C7'/%3E%3Cpath d='M23 30.5C18.5 27.5 13 21.5 10.5 15C12.5 20.5 14 27 16.2 33.5C14 40 12.5 46.5 10.5 52.5C13 46 18.5 40.5 23 37.5Z' fill='%23fff'/%3E%3Cpath d='M22 33C24 22 36 14.5 46 17C53.5 19.5 58 24.5 58 30.5C58 37 52.5 41.5 45.5 43.5C37 46 27 45.5 23 39C21.8 37 21.6 35 22 33Z' fill='%23fff'/%3E%3Ccircle cx='49.5' cy='27.5' r='2.2' fill='%230369A1'/%3E%3C/svg%3E" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
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
    width: 40px;
    height: 40px;
    border-radius: 13px;
    background: linear-gradient(135deg, #38BDF8, #0369A1);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 4px 12px var(--accent-soft);
  }
  .brand-logo svg {
    width: 27px;
    height: 27px;
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
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: #FFFFFF;
  }
  .avatar svg {
    width: 27px;
    height: 27px;
  }
  .avatar.sm {
    width: 34px;
    height: 34px;
  }
  .avatar.sm svg {
    width: 21px;
    height: 21px;
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
    width: 130px;
    height: 130px;
    margin: 0 auto 18px;
    border-radius: 50%;
    background: var(--bg-pill);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 0 12px var(--accent-soft);
  }
  .hero-art svg {
    width: 88px;
    height: 88px;
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
          <div class="brand-logo" title="BotAutoTask">
            <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M23 30.5C18.5 27.5 13 21.5 10.5 15C12.5 20.5 14 27 16.2 33.5C14 40 12.5 46.5 10.5 52.5C13 46 18.5 40.5 23 37.5Z" fill="#FFFFFF"/>
              <path d="M22 33C24 22 36 14.5 46 17C53.5 19.5 58 24.5 58 30.5C58 37 52.5 41.5 45.5 43.5C37 46 27 45.5 23 39C21.8 37 21.6 35 22 33Z" fill="#FFFFFF"/>
              <g clip-path="url(#brandbelly)"><ellipse cx="39" cy="46" rx="19" ry="8.5" fill="rgba(255,255,255,0.38)"/></g>
              <defs><clipPath id="brandbelly"><path d="M22 33C24 22 36 14.5 46 17C53.5 19.5 58 24.5 58 30.5C58 37 52.5 41.5 45.5 43.5C37 46 27 45.5 23 39C21.8 37 21.6 35 22 33Z"/></clipPath></defs>
              <path d="M37 37.5C41 38.5 43.2 42.5 41.2 47C37.6 49 33.4 47.6 32.4 44C33.6 40.5 35 37.9 37 37.5Z" fill="rgba(255,255,255,0.82)"/>
              <circle cx="49.5" cy="27.5" r="2.2" fill="rgba(3,105,161,0.8)"/>
              <path d="M52 33.5C53.3 35.1 55.3 35.3 56.7 34" stroke="rgba(3,105,161,0.8)" stroke-width="1.7" stroke-linecap="round" fill="none"/>
            </svg>
          </div>
          <div class="brand-text">
            <div class="brand-name">BotAutoTask</div>
            <div class="brand-sub">Multi-Agent Chat</div>
          </div>
        </div>

        <div class="brand-actions">
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
        </div>
      </div>

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
          <span class="avatar sm" id="headerAvatar" style="background:linear-gradient(135deg,#38BDF8,#0369A1);"></span>
          <div class="header-info">
            <div class="header-title-row">
              <span class="header-title" id="headerTitle">Nhóm BotAutoTask</span>
              <span class="role-tag" id="headerRoleTag">Nhóm</span>
            </div>
            <div class="header-sub" id="headerSubtitle">Kênh phối hợp chung · #mesh-command-room</div>
          </div>
        </div>

        <div class="header-actions">
          <button class="pill-btn" onclick="mergeAgentWorktree(currentChannel === 'all' ? 'coder' : currentChannel)" title="Kiểm thử & gộp nhánh Git Worktree của đồng sự">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg>
            <span>Gộp nhánh</span>
          </button>
          <button class="icon-btn" onclick="clearCurrentView()" title="Xóa lịch sử hiển thị">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      </header>

      <section class="chat-stream" id="chatStream"></section>

      <footer class="composer">
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
  // ===== Original whale mascot (pure SVG, parameterized colors) =====
  let __whaleUid = 0;
  function whaleSvg(opts) {
    opts = opts || {};
    const uid = 'wh' + (++__whaleUid);
    const BODY = 'M22 33C24 22 36 14.5 46 17C53.5 19.5 58 24.5 58 30.5C58 37 52.5 41.5 45.5 43.5C37 46 27 45.5 23 39C21.8 37 21.6 35 22 33Z';
    const FLUKE = 'M23 30.5C18.5 27.5 13 21.5 10.5 15C12.5 20.5 14 27 16.2 33.5C14 40 12.5 46.5 10.5 52.5C13 46 18.5 40.5 23 37.5Z';
    const FIN = 'M37 37.5C41 38.5 43.2 42.5 41.2 47C37.6 49 33.4 47.6 32.4 44C33.6 40.5 35 37.9 37 37.5Z';
    let body = opts.body || 'currentColor';
    let defs = '<defs><clipPath id="wc-' + uid + '"><path d="' + BODY + '"/></clipPath>';
    if (opts.gradient) {
      defs += '<linearGradient id="wg-' + uid + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="' + opts.gradient[0] + '"/>' +
        '<stop offset="1" stop-color="' + opts.gradient[1] + '"/></linearGradient>';
      body = 'url(#wg-' + uid + ')';
    }
    defs += '</defs>';
    const fin = opts.fin || body;
    const belly = (opts.belly !== undefined) ? opts.belly : 'rgba(255,255,255,0.4)';
    const ink = opts.ink || 'rgba(255,255,255,0.9)';
    let spout = '';
    if (opts.spout) {
      const mist = opts.mist || 'rgba(255,255,255,0.65)';
      spout = '<g stroke="' + mist + '" stroke-width="2.4" stroke-linecap="round" fill="none">' +
        '<path d="M44.5 15.5C44.5 11.5 46.5 8.8 50 6.2"/>' +
        '<path d="M43 15.5C42 11.6 40 9.2 37 7.2"/></g>' +
        '<circle cx="52" cy="10.2" r="1.5" fill="' + mist + '"/>' +
        '<circle cx="35.4" cy="10.8" r="1.5" fill="' + mist + '"/>' +
        '<circle cx="44.2" cy="4.6" r="1.5" fill="' + mist + '"/>';
    }
    return '<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + defs +
      spout +
      '<path d="' + FLUKE + '" fill="' + body + '"/>' +
      '<path d="' + BODY + '" fill="' + body + '"/>' +
      '<g clip-path="url(#wc-' + uid + ')"><ellipse cx="39" cy="46" rx="19" ry="8.5" fill="' + belly + '"/></g>' +
      '<path d="' + FIN + '" fill="' + fin + '"/>' +
      '<circle cx="49.5" cy="27.5" r="2.2" fill="' + ink + '"/>' +
      '<path d="M52 33.5C53.3 35.1 55.3 35.3 56.7 34" stroke="' + ink + '" stroke-width="1.7" stroke-linecap="round" fill="none"/>' +
      '</svg>';
  }

  // White whale for colored avatars; gradient whale with water spout for the welcome art
  const WHALE_MARK = whaleSvg({ body: '#FFFFFF', fin: 'rgba(255,255,255,0.82)', belly: 'rgba(255,255,255,0.38)', ink: 'rgba(3,105,161,0.8)' });
  const WHALE_HERO = whaleSvg({ gradient: ['#5BC4F9', '#0284C7'], fin: '#0369A1', belly: 'rgba(255,255,255,0.62)', ink: '#0B3D5F', mist: 'rgba(2,132,199,0.5)', spout: true });

  const ICONS = {
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>'
  };

  const PERSONAS = {
    all: {
      title: 'Nhóm BotAutoTask',
      tag: 'Nhóm',
      grad: 'linear-gradient(135deg, #38BDF8, #0369A1)',
      sub: 'Kênh phối hợp chung · #mesh-command-room'
    },
    lead: {
      title: '@lead · Trưởng nhóm',
      tag: 'Lead',
      grad: 'linear-gradient(135deg, #0EA5E9, #075985)',
      sub: 'Điều phối & phân công công việc'
    },
    coder: {
      title: '@coder · Lập trình viên',
      tag: 'Writer',
      grad: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
      sub: 'Viết code & kiểm thử trong Git Worktree riêng'
    },
    reviewer: {
      title: '@reviewer · Kiểm duyệt',
      tag: 'QA',
      grad: 'linear-gradient(135deg, #6366F1, #4338CA)',
      sub: 'Review code & đảm bảo chất lượng'
    }
  };

  function getPersona(id) {
    if (PERSONAS[id]) return PERSONAS[id];
    return {
      title: '@' + id,
      tag: 'Đồng sự',
      grad: 'linear-gradient(135deg, #38BDF8, #0284C7)',
      sub: 'Chuyên gia đồng hành'
    };
  }

  let authToken = '';
  if (location.hash.startsWith('#k=')) {
    authToken = location.hash.slice(3);
  }

  let agentsState = [];
  let feedItems = [];
  let currentChannel = 'all';
  let currentVerifyCmd = 'python -m unittest discover -s tests -p "test_*.py" -v; python scripts/query_engine.py --test; python scripts/evaluate.py --check';
  let sseSource = null;
  let sseState = 'CONNECTING';
  let lastStateOkTs = 0;

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
        if (added) renderStream();
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
    const countEl = document.getElementById('podCountLabel');
    if (!groupEl || !coworkerEl) return;
    if (countEl) countEl.textContent = agentsState.length + ' thành viên';

    const runningCount = agentsState.filter((a) => a.status === 'running').length;
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

    const filtered = agentsState.filter((a) => {
      if (!q) return true;
      const p = getPersona(a.id);
      return (
        a.id.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        (a.name || '').toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q)
      );
    });

    coworkerEl.innerHTML = filtered.map((a) => {
      const p = getPersona(a.id);
      const isRunning = a.status === 'running';
      const isQueued = (a.inboxCount || 0) > 0 || (a.pendingSteers || 0) > 0;
      const dotCls = isRunning ? 'working' : (a.status === 'error' ? 'error' : (isQueued ? 'queued' : 'online'));
      const preview = isRunning ? 'Đang xử lý nhiệm vụ...' : (a.description || p.sub);

      return \`
        <button class="chat-item \${currentChannel === a.id ? 'active' : ''}" onclick="selectChannel('\${escapeHtml(a.id)}')">
          <span class="avatar" style="background:\${p.grad}">
            \${WHALE_MARK}
            <i class="status-dot \${dotCls}"></i>
          </span>
          <span class="chat-item-main">
            <span class="chat-item-top">
              <span class="chat-item-name">\${escapeHtml(p.title)}</span>
              <span class="role-tag">\${escapeHtml(p.tag)}</span>
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

  function renderStream() {
    const stream = document.getElementById('chatStream');
    if (!stream) return;
    const msgs = getVisibleMessages();

    const runningAgents = currentChannel === 'all'
      ? agentsState.filter((a) => a.status === 'running')
      : agentsState.filter((a) => a.id === currentChannel && a.status === 'running');

    if (msgs.length === 0 && runningAgents.length === 0) {
      stream.innerHTML = \`
        <div class="welcome">
          <div class="hero-art">\${WHALE_HERO}</div>
          <h2>Chào mừng đến BotAutoTask</h2>
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
            <div class="msg-bubble \${m.priority ? 'priority' : ''}">\${escapeHtml(m.text)}</div>
          </div>
        </div>
      \`;
    }

    for (const a of runningAgents) {
      const p = getPersona(a.id);
      const lastAct = (a.recentActivity || []).slice(-1)[0] || 'Đang xử lý...';
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
    stream.scrollTop = stream.scrollHeight;
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
    this.token = token || process.env.BOTAUTOTASK_UI_TOKEN || randomBytes(16).toString('hex');
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
    'opencode/big-pickle',
    'opencode/mimo-v2.6-flash-free',
    'deepseek-v4.1-flash-free',
    'opencode/deepseek-v4.1-flash-free',
    'gpt-luna',
    'opencode/gpt-luna',
    'opencode/grok-code',
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
    mesh.loadPersistedState();
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
