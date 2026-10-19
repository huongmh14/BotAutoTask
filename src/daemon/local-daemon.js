import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { FreeModelRanker } from '../core/model-discovery.js';
import { HarnessRegistry } from '../core/harness-registry.js';
import { GoalOrchestrator } from '../core/orchestrator.js';
import { OpenCodeHarness } from '../harnesses/opencode-harness.js';
import { AntigravityHarness } from '../harnesses/antigravity-harness.js';
import { ClaudeCodexHarness } from '../harnesses/claude-codex-harness.js';
import { NekoCoreHarness } from '../harnesses/neko-core-harness.js';
import { waitForNetwork } from './network-monitor.js';
import { sendMobileNotification, formatGoalNotification } from './mobile-notify.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..', '..');
const USER_HOME_DIR = join(homedir(), '.botautotask');

export const BUILTIN_DEFAULT_CONFIG = {
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

export function loadConfig(customPath = null) {
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
export function createRuntime(config = loadConfig()) {
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
export class LocalDaemon {
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
