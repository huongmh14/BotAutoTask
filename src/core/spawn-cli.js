import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

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
export function commandExists(binary) {
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
export function runCliProcess(binary, args = [], { cwd = process.cwd(), timeoutMs = 15 * 60 * 1000 } = {}) {
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
