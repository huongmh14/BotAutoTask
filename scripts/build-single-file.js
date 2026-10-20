/**
 * Zero-dependency bundler that compiles all BotAutoTask modules into a SINGLE
 * standalone file (`dist/botautotask.mjs`) that can be downloaded directly and run
 * anywhere with zero `npm install` or external files required.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const MODULE_ORDER = [
  'src/core/types.js',
  'src/core/rate-limit-detector.js',
  'src/core/spawn-cli.js',
  'src/core/log-reader.js',
  'src/core/atomic-write.js',
  'src/core/policy.js',
  'src/core/completion-contract.js',
  'src/core/harness2-engine.js',
  'src/core/auth-bridge.js',
  'src/core/model-discovery.js',
  'src/harnesses/custom-cmd-harness.js',
  'src/harnesses/opencode-harness.js',
  'src/harnesses/antigravity-harness.js',
  'src/harnesses/claude-codex-harness.js',
  'src/harnesses/neko-core-harness.js',
  'src/core/harness-registry.js',
  'src/core/orchestrator.js',
  'src/core/supervisor.js',
  'src/core/worktree-manager.js',
  'src/core/agent-mesh.js',
  'src/daemon/mobile-notify.js',
  'src/daemon/network-monitor.js',
  'src/ui/dashboard-html.js',
  'src/daemon/web-ui.js',
  'src/daemon/local-daemon.js',
  'src/daemon/cli.js'
];

const bodyChunks = [];

for (const relPath of MODULE_ORDER) {
  const fullPath = join(ROOT, relPath);
  const raw = readFileSync(fullPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const filteredLines = [];

  for (const line of lines) {
    if (line.startsWith('#!')) continue;
    if (/^\s*import\s+.*from\s+['"]node:/.test(line)) continue;
    if (/^\s*import\s+.*from\s+['"]\./.test(line)) continue;
    if (/^\s*export\s*\{/.test(line)) continue;
    filteredLines.push(line.replace(/^\s*export\s+(class|function|async\s+function|const|let)\s+/, '$1 '));
  }

  bodyChunks.push(`// --- MODULE: ${relPath} ---\n` + filteredLines.join('\n'));
}

const mergedImports = [
  `import { exec, execFile, spawn, spawnSync } from 'node:child_process';`,
  `import { createServer } from 'node:http';`,
  `import { randomUUID, randomBytes, createHash, timingSafeEqual } from 'node:crypto';`,
  `import { promisify } from 'node:util';`,
  `import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync, statSync, lstatSync, renameSync, appendFileSync, rmSync, copyFileSync, openSync, fsyncSync, closeSync } from 'node:fs';`,
  `import { join, dirname, basename, resolve, isAbsolute, normalize } from 'node:path';`,
  `import { homedir, tmpdir } from 'node:os';`,
  `import { fileURLToPath } from 'node:url';`
];

let combinedBody = bodyChunks.join('\n\n');
combinedBody = combinedBody
  .replace(/const execFileAsync = promisify\(execFile\);/g, '')
  .replace(/const execAsync = promisify\(exec\);/g, '')
  .replace(/const __dirname = dirname\(fileURLToPath\(import\.meta\.url\)\);/g, '')
  .replace(/const ROOT_DIR = join\(__dirname, '\.\.', '\.\.'\);/g, '');

const finalBundle = [
  '#!/usr/bin/env node',
  '/**',
  ' * BotAutoTask — Single-File Standalone Bundle (Zero Dependencies)',
  ' * Can be downloaded and executed directly on any machine with Node.js >= 20 or Bun.',
  ' */',
  ...mergedImports,
  '',
  'const execFileAsync = promisify(execFile);',
  'const execAsync = promisify(exec);',
  'const __dirname = dirname(fileURLToPath(import.meta.url));',
  'const ROOT_DIR = __dirname;',
  '',
  combinedBody
].join('\n');

const outArgIdx = process.argv.indexOf('--out');
const outPath =
  outArgIdx !== -1 && process.argv[outArgIdx + 1]
    ? process.argv[outArgIdx + 1]
    : join(ROOT, 'dist', 'botautotask.mjs');

const outDir = dirname(outPath);
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}
writeFileSync(outPath, finalBundle, 'utf8');
console.log(`[+] Built single-file standalone bundle: ${outPath} (${Buffer.byteLength(finalBundle)} bytes)`);
