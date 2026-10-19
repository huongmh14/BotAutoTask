import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

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
export function resolveCliBinary(binary) {
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
export function commandExists(binary) {
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
export function runCliProcess(
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
