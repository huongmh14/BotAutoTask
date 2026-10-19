import { spawn } from 'node:child_process';

/**
 * Safely executes a CLI command across Windows and POSIX without Node 24 DEP0190 warnings
 * and without corrupting multi-line prompt arguments.
 * @param {string} binary
 * @param {string[]} args
 * @param {{ cwd?: string, timeoutMs?: number }} [options]
 * @returns {Promise<{ stdout: string, stderr: string, exitCode: number }>}
 */
export function runCliProcess(binary, args = [], { cwd = process.cwd(), timeoutMs = 15 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === 'win32';
    // On Windows, global npm/bun CLIs are .cmd shims; run via cmd.exe /d /s /c with proper quoting or direct .cmd
    let command = binary;
    let spawnArgs = args;
    let windowsVerbatimArguments = false;

    if (isWin && !/\.(exe|cmd|bat)$/i.test(binary)) {
      const escapedArgs = [binary, ...args].map((arg) => {
        const s = String(arg).replace(/\r?\n/g, ' ');
        return `"${s.replace(/"/g, '\\"')}"`;
      });
      command = process.env.ComSpec || 'cmd.exe';
      spawnArgs = ['/d', '/s', '/c', `"${escapedArgs.join(' ')}"`];
      windowsVerbatimArguments = true;
    }

    const child = spawn(command, spawnArgs, {
      cwd,
      windowsHide: true,
      windowsVerbatimArguments,
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
