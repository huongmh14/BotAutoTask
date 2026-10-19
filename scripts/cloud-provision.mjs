#!/usr/bin/env node
/**
 * BotAutoTask — Cloudflare Cloud-Core provisioner (Playwright + wrangler).
 *
 *   npm run cloud:setup            # full setup (login -> D1 -> schema -> deploy -> secrets -> GitHub secrets)
 *   npm run cloud:setup -- --dry-run
 *
 * Division of labour:
 *  - Playwright (playwright-core + installed Edge/Chrome, persistent profile) drives ONLY the browser parts:
 *    the `wrangler login` OAuth consent page and the one-time workers.dev subdomain onboarding.
 *    The user types their own password / 2FA / captcha; this script never sees or stores credentials.
 *  - wrangler (via npx) does every API mutation: D1 create, schema apply, deploy, secrets. Idempotent re-runs.
 *
 * Outputs: cloud-core/wrangler.generated.toml (gitignored) and ~/.botautotask/config.json -> { cloud: {...} }.
 */
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLOUD_DIR = join(ROOT, 'cloud-core');
const GENERATED_CONFIG = 'wrangler.generated.toml';
const USER_DIR = join(homedir(), '.botautotask');
const USER_CONFIG = join(USER_DIR, 'config.json');
const BROWSER_PROFILE = join(USER_DIR, 'cf-browser-profile');
const DB_NAME = 'botautotask-db';
const HUMAN_TIMEOUT_MS = 10 * 60 * 1000; // time allowed for the user to log in / solve 2FA
const OPTIONAL_SECRETS = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ALLOWED_CHAT_ID', 'GITHUB_PAT', 'NTFY_TOPIC', 'DISCORD_WEBHOOK_URL'];

// ---------- pure helpers (unit-tested in tests/cloud-provision.test.js) ----------

export function extractOAuthUrl(text = '') {
  const m = String(text).match(/(https:\/\/dash\.cloudflare\.com\/oauth2\/auth\S+)\s/);
  return m ? m[1] : null;
}

export function extractD1DatabaseId(text = '') {
  const m = String(text).match(/database_id["']?\s*[:=]\s*["']([0-9a-f-]{36})["']/i);
  return m ? m[1] : null;
}

export function findD1InList(jsonText, name = DB_NAME) {
  try {
    const list = JSON.parse(jsonText);
    const hit = Array.isArray(list) ? list.find((d) => d.name === name) : null;
    return hit ? hit.uuid || hit.database_id || null : null;
  } catch {
    return null;
  }
}

export function extractWorkersDevUrl(text = '') {
  const m = String(text).match(/https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev/i);
  return m ? m[0] : null;
}

export function needsWorkersDevSubdomain(text = '') {
  return /workers\.dev subdomain/i.test(String(text)) && /register|onboard|create/i.test(String(text));
}

export function renderGeneratedConfig(baseToml, databaseId) {
  if (!/^[0-9a-f-]{36}$/i.test(databaseId || '')) throw new Error(`Invalid D1 database id: ${databaseId}`);
  return baseToml.replace(/database_id\s*=\s*"[^"]*"/, `database_id = "${databaseId}"`);
}

export function mergeCloudConfig(existing, cloud) {
  return { ...(existing || {}), cloud: { ...((existing && existing.cloud) || {}), ...cloud } };
}

// ---------- side-effecting steps ----------

const log = (msg) => console.log(`[cloud-setup] ${msg}`);
const isWin = process.platform === 'win32';

function wrangler(args, { input = null, onOutput = null } = {}) {
  return new Promise((resolve) => {
    // npx is a .cmd shim on Windows; run its JS entry with node instead of shell:true (no arg concatenation).
    const [cmd, pre] = isWin
      ? [process.execPath, [join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js')]]
      : ['npx', []];
    const child = spawn(cmd, [...pre, '--yes', 'wrangler@latest', ...args], {
      cwd: CLOUD_DIR,
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }
    });
    let out = '';
    const onData = (chunk) => {
      out += String(chunk);
      onOutput?.(out, child); // full buffer: values (e.g. the OAuth URL) can span chunks
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    if (input !== null) child.stdin.end(input);
    child.on('close', (code) => resolve({ code, out }));
  });
}

export const PLAYWRIGHT_STEALTH_OPTS = {
  headless: false,
  viewport: null,
  ignoreDefaultArgs: ['--enable-automation'],
  args: ['--disable-blink-features=AutomationControlled']
};

function openSystemBrowser(url) {
  if (isWin) {
    const candidates = [
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Google/Chrome/Application/chrome.exe'
    ].filter(existsSync);
    if (candidates[0]) {
      spawn(candidates[0], [url], { detached: true, stdio: 'ignore' }).unref();
      return true;
    }
  }
  try {
    spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    return true;
  } catch {
    return false;
  }
}

async function openBrowser() {
  let pw;
  try {
    pw = await import('playwright-core');
  } catch {
    throw new Error('playwright-core is not installed. Run: npm install --save-dev playwright-core');
  }
  mkdirSync(BROWSER_PROFILE, { recursive: true });
  // Reuse an installed browser without --enable-automation so Cloudflare Turnstile does not set navigator.webdriver=true.
  for (const channel of ['msedge', 'chrome']) {
    try {
      const ctx = await pw.chromium.launchPersistentContext(BROWSER_PROFILE, { channel, ...PLAYWRIGHT_STEALTH_OPTS });
      await ctx.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => undefined }));
      return ctx;
    } catch {}
  }
  throw new Error('Could not launch Edge or Chrome. Install one, or run `npx playwright install chromium`.');
}

async function ensureLogin(dryRun) {
  if (process.env.CLOUDFLARE_API_TOKEN) return log('Using CLOUDFLARE_API_TOKEN from env (skipping browser login).');
  const who = await wrangler(['whoami']);
  if (who.code === 0 && !/not authenticated|You are not logged in/i.test(who.out)) return log('wrangler already logged in.');
  if (dryRun) return log('[dry-run] would run `wrangler login` and complete OAuth.');

  const usePlaywright = process.argv.includes('--playwright-login');
  log('Opening Cloudflare OAuth in your browser. Please sign in and click "Allow".');
  let context = null;
  let opened = false;
  const login = wrangler(['login', '--browser=false'], {
    onOutput: async (chunk) => {
      const url = extractOAuthUrl(chunk);
      if (!url || opened) return;
      opened = true;
      log(`OAuth URL (use THIS link if switching browsers, NOT the login_challenge redirect):\n${url}`);
      if (!usePlaywright && openSystemBrowser(url)) return;
      try {
        context = await openBrowser();
        const page = context.pages()[0] || (await context.newPage());
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        const allow = page.getByRole('button', { name: /^(allow|authorize)$/i });
        await allow.waitFor({ timeout: HUMAN_TIMEOUT_MS }).catch(() => {});
        await allow.click().catch(() => {});
      } catch (err) {
        log(`Playwright browser fallback error (${err.message}); open the OAuth URL above in your browser.`);
      }
    }
  });
  const res = await login;
  await context?.close().catch(() => {});
  if (res.code !== 0) throw new Error(`wrangler login failed:\n${res.out.slice(-800)}`);
  log('Logged in to Cloudflare.');
}

async function ensureD1(dryRun) {
  const list = await wrangler(['d1', 'list', '--json']);
  const existing = findD1InList(list.out.slice(list.out.indexOf('[')));
  if (existing) return log(`D1 "${DB_NAME}" exists (${existing}).`), existing;
  if (dryRun) return log(`[dry-run] would create D1 "${DB_NAME}".`), '00000000-0000-0000-0000-000000000000';
  const created = await wrangler(['d1', 'create', DB_NAME]);
  const id = extractD1DatabaseId(created.out);
  if (!id) throw new Error(`Could not parse D1 id:\n${created.out.slice(-800)}`);
  log(`Created D1 "${DB_NAME}" (${id}).`);
  return id;
}

async function deploy(dryRun) {
  if (dryRun) return log('[dry-run] would deploy worker.'), 'https://botautotask-cloud-core.example.workers.dev';
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await wrangler(['deploy', '--config', GENERATED_CONFIG]);
    const url = extractWorkersDevUrl(res.out);
    if (res.code === 0 && url) return url;
    if (attempt === 1 && needsWorkersDevSubdomain(res.out)) {
      // ponytail: guided onboarding (user picks the subdomain name); dashboard selectors change too often to automate safely.
      log('Your account has no workers.dev subdomain yet. Pick one in the browser window, then close it.');
      const context = await openBrowser();
      const page = context.pages()[0] || (await context.newPage());
      await page.goto('https://dash.cloudflare.com/?to=/:account/workers-and-pages');
      await page.waitForEvent('close', { timeout: HUMAN_TIMEOUT_MS }).catch(() => {});
      await context.close().catch(() => {});
      continue;
    }
    throw new Error(`wrangler deploy failed:\n${res.out.slice(-1200)}`);
  }
}

async function putSecret(name, value, dryRun) {
  if (dryRun) return log(`[dry-run] would set worker secret ${name}.`);
  const res = await wrangler(['secret', 'put', name, '--config', GENERATED_CONFIG], { input: value });
  if (res.code !== 0) throw new Error(`Setting secret ${name} failed:\n${res.out.slice(-600)}`);
  log(`Worker secret ${name} set.`);
}

function setGitHubSecrets(secrets, dryRun) {
  try {
    execFileSync('gh', ['auth', 'status'], { stdio: 'ignore' });
  } catch {
    return log('GitHub CLI not logged in; skip GitHub secrets (run `gh auth login` then re-run).');
  }
  for (const [name, value] of Object.entries(secrets)) {
    if (dryRun) {
      log(`[dry-run] would set GitHub secret ${name}.`);
      continue;
    }
    execFileSync('gh', ['secret', 'set', name], { cwd: ROOT, input: value, stdio: ['pipe', 'ignore', 'inherit'] });
    log(`GitHub Actions secret ${name} set.`);
  }
}

async function healthCheck(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.status !== 'healthy') throw new Error(`Health check failed: HTTP ${res.status} ${JSON.stringify(body)}`);
  log(`Health check OK: ${url}`);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const userConfig = existsSync(USER_CONFIG) ? JSON.parse(readFileSync(USER_CONFIG, 'utf8')) : {};
  const apiToken = userConfig.cloud?.apiToken || randomUUID(); // keep token stable across re-runs

  await ensureLogin(dryRun);
  const databaseId = await ensureD1(dryRun);
  writeFileSync(
    join(CLOUD_DIR, GENERATED_CONFIG),
    renderGeneratedConfig(readFileSync(join(CLOUD_DIR, 'wrangler.toml'), 'utf8'), databaseId)
  );

  if (dryRun) log('[dry-run] would apply cloud-core/schema.sql to remote D1.');
  else {
    const res = await wrangler(['d1', 'execute', DB_NAME, '--remote', '--yes', '--file', 'schema.sql', '--config', GENERATED_CONFIG]);
    if (res.code !== 0) throw new Error(`Schema apply failed:\n${res.out.slice(-800)}`);
    log('Schema applied (idempotent CREATE IF NOT EXISTS).');
  }

  const url = await deploy(dryRun);
  log(`Worker deployed: ${url}`);
  await putSecret('BOTAUTOTASK_API_TOKEN', apiToken, dryRun);
  for (const name of OPTIONAL_SECRETS) if (process.env[name]) await putSecret(name, process.env[name], dryRun);

  setGitHubSecrets({ BOTAUTOTASK_CLOUD_URL: url, BOTAUTOTASK_API_TOKEN: apiToken }, dryRun);

  if (!dryRun) {
    mkdirSync(USER_DIR, { recursive: true });
    writeFileSync(USER_CONFIG, JSON.stringify(mergeCloudConfig(userConfig, { url, apiToken, d1DatabaseId: databaseId }), null, 2));
    log(`Saved cloud url/token to ${USER_CONFIG}`);
    await healthCheck(url, apiToken);
  }
  log(`Done. Open ${url} on your phone.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(`[cloud-setup] FAILED: ${err.message}`);
    process.exit(1);
  });
}
