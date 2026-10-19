# BotAutoTask Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `BotAutoTask` in `D:\BotAutoTask` — a pluggable multi-core agent orchestrator that auto-discovers top free/idle models (e.g., `deepseek-v4.1-flash-free`, `gpt-luna` on OpenCode, plus Antigravity, Claude, Codex, Neko Core, and custom cores), automatically switches cores on rate limits while preserving progress via a durable journal, runs when network is available (with Windows Wake Timer + GitHub Actions Cloud Worker when PC is off), and is controllable 24/7 via a Cloudflare Worker Telegram Bot.

**Architecture:** Hexagonal pluggable-core design where the Orchestrator Engine (`src/core/`) depends only on a narrow `AgentHarness` contract, allowing any AI core (`src/harnesses/*`) to be swapped or added without modifying orchestration logic. A free 24/7 Cloudflare Worker + D1 (`cloud-core/`) manages Telegram commands, durable SQL leases (90s TTL), and GitHub Actions fallback when the PC is powered down.

**Tech Stack:** Node.js >= 20 (ESM, zero external runtime dependencies — uses native `fetch`, `node:test`, `node:child_process`), Cloudflare Workers + D1 SQLite, GitHub Actions, PowerShell (Windows Task Scheduler).

**Spec:** `D:\BotAutoTask\docs\superpowers\specs\2026-10-19-botautotask-design.md`

## Global Constraints

- Project path: `D:\BotAutoTask`
- Zero third-party npm packages required for the local runtime and tests (use Node.js built-in `fetch`, `node:child_process`, `node:fs`, `node:test`, `node:assert/strict`).
- All AI execution cores must implement the `AgentHarness` interface (`id`, `isAvailable()`, `discoverModels()`, `executeStep(ctx)`) so Neko Core or any future custom core can be added/replaced via `config/default-config.json` or `src/harnesses/` without modifying `src/core/orchestrator.js`.
- Free model discovery must prioritize user-pinned patterns (`deepseek*v4*flash*free`, `gpt-luna`, `opencode/*free*`, `google/gemini-2.5-*`, `*coder*free`) and dynamically query `opencode models` + OpenRouter free models (`pricing.prompt === "0"` and `pricing.completion === "0"`).
- Rate limit detection must catch `429`, `rate_limit`, `rate limit`, `quota exceeded`, `usage limit`, `credit balance is too low`, `too many requests`, and put the specific `harness:model` on cooldown while immediately failing over to the next ranked free model/harness in the same goal run.
- Sync the `botautotask` skill across all local agents (`Antigravity`, `Claude Code`, `Codex`, `OpenCode`, `Cursor`) and run `d:\agent-toolkit-bundle\sync-to-bundle.ps1`.

## Review Focus

1. **All free models in primary harness rate-limited simultaneously:** When `opencode:deepseek-v4.1-flash-free` and `opencode:gpt-luna` both return `429`, the selector must automatically fall through to the next available harness (e.g., `antigravity`, `neko-core`, or `custom-cmd`) without losing prior step journal entries.
2. **CLI output missing `<OMNIGOAL_SUMMARY>` tags:** When a CLI agent finishes a step with exit code 0 but does not emit explicit XML tags, `parseStepOutput` must safely extract the trailing non-empty lines of stdout as the step summary instead of crashing or storing an empty string.
3. **`opencode models` CLI unavailable or network offline during model discovery:** `FreeModelRanker.discoverAll()` must gracefully fall back to the static priority list in `config/default-config.json` without throwing.
4. **Lease expiration while PC goes offline mid-goal:** When `lease_expires_at < now`, `shouldTriggerCloudFallback(goal, nowMs)` in `cloud-core/worker.js` must return `true` only when `execution_mode` is `'auto'` or `'cloud'` and `repo_url` is present.
5. **Custom/Swapped Core via JSON config (`neko-core` replacement):** Registering a new core in `config/default-config.json` under `customHarnesses` with a command template (`my-new-core run --model {{model}} --prompt {{prompt_file}}`) must work without writing any JavaScript code.

---

### Task 1: Core Contracts, Rate-Limit Detector & Dynamic Free-Model Ranker

**Files:**
- Create: `D:\BotAutoTask\package.json`
- Create: `D:\BotAutoTask\config\default-config.json`
- Create: `D:\BotAutoTask\src\core\types.js`
- Create: `D:\BotAutoTask\src\core\rate-limit-detector.js`
- Create: `D:\BotAutoTask\src\core\model-discovery.js`
- Test: `D:\BotAutoTask\tests\model-and-limit.test.js`

**Interfaces:**
- Produces:
  - `isRateLimitError(output: string, exitCode?: number): boolean` in `src/core/rate-limit-detector.js`
  - `parseStepTags(stdout: string): { completed: boolean, summary: string }` in `src/core/types.js`
  - `class FreeModelRanker` in `src/core/model-discovery.js`:
    - `constructor(config, options?: { execFn?, fetchFn? })`
    - `scoreModelId(modelId: string): number`
    - `markCooldown(harnessId: string, modelId: string, durationMs?: number): void`
    - `isCoolingDown(harnessId: string, modelId: string, nowMs?: number): boolean`
    - `rankCandidates(candidates: Array<{ harnessId: string, modelId: string, isFree?: boolean }>): Array<{ harnessId: string, modelId: string, score: number }>`

- [ ] **Step 1: Write the failing test in `D:\BotAutoTask\tests\model-and-limit.test.js`**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { isRateLimitError } from '../src/core/rate-limit-detector.js';
import { parseStepTags } from '../src/core/types.js';
import { FreeModelRanker } from '../src/core/model-discovery.js';

test('isRateLimitError detects 429, quota, and usage limits', () => {
  assert.equal(isRateLimitError('Error: HTTP 429 Too Many Requests', 1), true);
  assert.equal(isRateLimitError('You have exceeded your usage limit until 5pm', 1), true);
  assert.equal(isRateLimitError('SyntaxError: Unexpected token', 1), false);
});

test('parseStepTags extracts status and falls back when tags are missing', () => {
  const tagged = parseStepTags('Working...\n<OMNIGOAL_SUMMARY>Fixed auth bug</OMNIGOAL_SUMMARY>\n<OMNIGOAL_STATUS>COMPLETED</OMNIGOAL_STATUS>');
  assert.equal(tagged.completed, true);
  assert.equal(tagged.summary, 'Fixed auth bug');

  const untagged = parseStepTags('Line 1\nRefactored login controller successfully.');
  assert.equal(untagged.completed, false);
  assert.match(untagged.summary, /Refactored login controller/);
});

test('FreeModelRanker prioritizes deepseek-v4.1-flash-free and gpt-luna and respects cooldowns', () => {
  const ranker = new FreeModelRanker({
    priorityModels: ['deepseek-v4.1-flash-free', 'gpt-luna', 'google/gemini-2.5-pro']
  });
  const candidates = [
    { harnessId: 'opencode', modelId: 'openrouter/qwen/qwen-2.5-coder:free', isFree: true },
    { harnessId: 'opencode', modelId: 'opencode/gpt-luna', isFree: true },
    { harnessId: 'opencode', modelId: 'opencode/deepseek-v4.1-flash-free', isFree: true }
  ];
  const ranked = ranker.rankCandidates(candidates);
  assert.equal(ranked[0].modelId, 'opencode/deepseek-v4.1-flash-free');
  assert.equal(ranked[1].modelId, 'opencode/gpt-luna');

  ranker.markCooldown('opencode', 'opencode/deepseek-v4.1-flash-free', 60_000);
  const afterCooldown = ranker.rankCandidates(candidates);
  assert.equal(afterCooldown[0].modelId, 'opencode/gpt-luna');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test "D:\BotAutoTask\tests\model-and-limit.test.js"`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: Implement `package.json`, `config/default-config.json`, `src/core/types.js`, `src/core/rate-limit-detector.js`, and `src/core/model-discovery.js`**

Implement `FreeModelRanker` with dynamic CLI scanning (`opencode models`) and OpenRouter free API scanning (`https://openrouter.ai/api/v1/models`), with safe fallback to `config.priorityModels` if offline.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test "D:\BotAutoTask\tests\model-and-limit.test.js"`
Expected: PASS (3 tests passing)

---

### Task 2: Pluggable Harness Registry, Adapters (OpenCode, Antigravity, Claude/Codex, Neko Core, Custom) & Orchestrator Loop

**Files:**
- Create: `D:\BotAutoTask\src\core\harness-registry.js`
- Create: `D:\BotAutoTask\src\harnesses\opencode-harness.js`
- Create: `D:\BotAutoTask\src\harnesses\antigravity-harness.js`
- Create: `D:\BotAutoTask\src\harnesses\claude-codex-harness.js`
- Create: `D:\BotAutoTask\src\harnesses\neko-core-harness.js`
- Create: `D:\BotAutoTask\src\harnesses\custom-cmd-harness.js`
- Create: `D:\BotAutoTask\src\core\orchestrator.js`
- Test: `D:\BotAutoTask\tests\orchestrator-failover.test.js`

**Interfaces:**
- Consumes: `FreeModelRanker`, `isRateLimitError`, `parseStepTags` from Task 1.
- Produces:
  - `class HarnessRegistry` in `src/core/harness-registry.js`:
    - `register(harness: AgentHarness): void`
    - `unregister(harnessId: string): void`
    - `registerFromConfig(customHarnessConfigs: Array<Object>): void`
    - `getCandidates(ranker: FreeModelRanker, preferredSpec?: string): Promise<Array<{ harness, modelId, score }>>`
  - `class GoalOrchestrator` in `src/core/orchestrator.js`:
    - `constructor({ registry, ranker, onJournalEntry?, onNotify? })`
    - `runGoal(goal, existingJournal?): Promise<{ status: string, stepsRun: number, journal: Array<Object> }>`

- [ ] **Step 1: Write the failing test in `D:\BotAutoTask\tests\orchestrator-failover.test.js`**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { FreeModelRanker } from '../src/core/model-discovery.js';
import { HarnessRegistry } from '../src/core/harness-registry.js';
import { CustomCmdHarness } from '../src/harnesses/custom-cmd-harness.js';
import { GoalOrchestrator } from '../src/core/orchestrator.js';

test('GoalOrchestrator automatically switches from rate-limited model/harness to next free model and completes goal', async () => {
  const ranker = new FreeModelRanker({
    priorityModels: ['deepseek-v4.1-flash-free', 'gpt-luna', 'neko-local-v1']
  });
  const registry = new HarnessRegistry();

  // Mock OpenCode harness where deepseek-v4.1-flash-free hits 429, then gpt-luna completes step 1
  registry.register({
    id: 'opencode',
    async isAvailable() { return true; },
    async discoverModels() {
      return [
        { modelId: 'opencode/deepseek-v4.1-flash-free', isFree: true },
        { modelId: 'opencode/gpt-luna', isFree: true }
      ];
    },
    async executeStep({ modelId }) {
      if (modelId.includes('deepseek-v4.1')) {
        return {
          outcome: 'RATE_LIMITED',
          summary: 'HTTP 429 rate limit on deepseek-v4.1-flash-free',
          harnessId: 'opencode',
          modelId
        };
      }
      return {
        outcome: 'GOAL_COMPLETED',
        summary: 'Implemented feature using gpt-luna',
        harnessId: 'opencode',
        modelId
      };
    }
  });

  const notifications = [];
  const orchestrator = new GoalOrchestrator({
    registry,
    ranker,
    onNotify: (msg) => notifications.push(msg)
  });

  const result = await orchestrator.runGoal({
    id: 'goal-1',
    title: 'Build auth module',
    target_prompt: 'Create login and verify tests pass',
    max_steps: 5
  });

  assert.equal(result.status, 'COMPLETED');
  assert.equal(result.journal.length, 2);
  assert.equal(result.journal[0].outcome, 'RATE_LIMITED');
  assert.equal(result.journal[1].model_used, 'opencode/gpt-luna');
  assert.equal(result.journal[1].outcome, 'GOAL_COMPLETED');
});

test('HarnessRegistry allows hot-swapping neko-core with a custom self-developed core via config', async () => {
  const ranker = new FreeModelRanker({ priorityModels: ['my-custom-model-free'] });
  const registry = new HarnessRegistry();
  registry.registerFromConfig([
    {
      id: 'my-future-core',
      models: ['my-custom-model-free'],
      commandTemplate: 'node -e "console.log(\'<OMNIGOAL_SUMMARY>Done by custom core</OMNIGOAL_SUMMARY><OMNIGOAL_STATUS>COMPLETED</OMNIGOAL_STATUS>\')"'
    }
  ]);
  const candidates = await registry.getCandidates(ranker);
  assert.equal(candidates[0].harness.id, 'my-future-core');
  const receipt = await candidates[0].harness.executeStep({
    goal: { id: 'g2', target_prompt: 'Test custom' },
    journal: [],
    modelId: 'my-custom-model-free'
  });
  assert.equal(receipt.outcome, 'GOAL_COMPLETED');
  assert.equal(receipt.summary, 'Done by custom core');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test "D:\BotAutoTask\tests\orchestrator-failover.test.js"`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: Implement `src/core/harness-registry.js`, all 5 adapters in `src/harnesses/`, and `src/core/orchestrator.js`**

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test "D:\BotAutoTask\tests\orchestrator-failover.test.js"`
Expected: PASS (2 tests passing)

---

### Task 3: Cloud Control Plane (Cloudflare Worker + D1 + Telegram Bot + GitHub Actions Fallback) & Local Network Daemon

**Files:**
- Create: `D:\BotAutoTask\cloud-core\schema.sql`
- Create: `D:\BotAutoTask\cloud-core\wrangler.toml`
- Create: `D:\BotAutoTask\cloud-core\worker.js`
- Create: `D:\BotAutoTask\src\daemon\network-monitor.js`
- Create: `D:\BotAutoTask\src\daemon\local-daemon.js`
- Create: `D:\BotAutoTask\src\daemon\cli.js`
- Create: `D:\BotAutoTask\.github\workflows\botautotask-worker.yml`
- Create: `D:\BotAutoTask\scripts\register-windows-task.ps1`
- Test: `D:\BotAutoTask\tests\cloud-and-daemon.test.js`

**Interfaces:**
- Produces:
  - `parseTelegramCommand(text: string): { command: string, args: string, flags: Object }` in `cloud-core/worker.js`
  - `shouldTriggerCloudFallback(goal: Object, nowMs: number): boolean` in `cloud-core/worker.js`
  - `LocalDaemon` in `src/daemon/local-daemon.js` (network wait gate, offline queue persistence `.botautotask-queue.json`, Cloud Core heartbeat/lease polling).
  - CLI entrypoint `D:\BotAutoTask\src\daemon\cli.js` (`models`, `run`, `submit`, `daemon`, `cores`).

- [ ] **Step 1: Write the failing test in `D:\BotAutoTask\tests\cloud-and-daemon.test.js`**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTelegramCommand, shouldTriggerCloudFallback } from '../cloud-core/worker.js';

test('parseTelegramCommand parses /goal, /switch, and /mode with flags', () => {
  const cmd = parseTelegramCommand('/goal Fix all tests --repo owner/repo --core opencode:gpt-luna');
  assert.equal(cmd.command, '/goal');
  assert.equal(cmd.args, 'Fix all tests');
  assert.equal(cmd.flags.repo, 'owner/repo');
  assert.equal(cmd.flags.core, 'opencode:gpt-luna');
});

test('shouldTriggerCloudFallback triggers when local PC lease expires and repo_url is configured', () => {
  const now = 1_700_000_100_000;
  const expiredGoal = {
    status: 'RUNNING_LOCAL',
    execution_mode: 'auto',
    repo_url: 'user/my-repo',
    lease_expires_at: now - 10_000
  };
  assert.equal(shouldTriggerCloudFallback(expiredGoal, now), true);

  const activeLocalGoal = {
    ...expiredGoal,
    lease_expires_at: now + 60_000
  };
  assert.equal(shouldTriggerCloudFallback(activeLocalGoal, now), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test "D:\BotAutoTask\tests\cloud-and-daemon.test.js"`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: Implement `cloud-core/worker.js`, `cloud-core/schema.sql`, `cloud-core/wrangler.toml`, `src/daemon/*`, `.github/workflows/botautotask-worker.yml`, and `scripts/register-windows-task.ps1`**

- [ ] **Step 4: Run all tests to verify they pass**

Run: `node --test "D:\BotAutoTask\tests\*.test.js"`
Expected: PASS (all tests across all 3 test files pass)

---

### Task 4: Agent Skill Integration & Toolkit Bundle Auto-Sync

**Files:**
- Create: `D:\BotAutoTask\README.md`
- Create: `D:\BotAutoTask\skill\botautotask\SKILL.md`
- Sync to: `C:\Users\huong\.gemini\config\skills\botautotask\SKILL.md` (and Claude/Codex/OpenCode/Cursor skill folders + `d:\agent-toolkit-bundle\sync-to-bundle.ps1`)

- [ ] **Step 1: Create `D:\BotAutoTask\skill\botautotask\SKILL.md` and `D:\BotAutoTask\README.md`**
- [ ] **Step 2: Verify CLI commands (`node D:\BotAutoTask\src\daemon\cli.js models` and `cores`) work end-to-end**
- [ ] **Step 3: Sync skill to local agents and run `powershell -ExecutionPolicy Bypass -File "d:\agent-toolkit-bundle\sync-to-bundle.ps1"`**
