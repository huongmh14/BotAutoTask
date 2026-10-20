import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, existsSync, readFileSync } from 'node:fs';
import { FreeModelRanker } from '../src/core/model-discovery.js';
import { HarnessRegistry } from '../src/core/harness-registry.js';
import { GoalOrchestrator } from '../src/core/orchestrator.js';

test('[CORE-AC03] [CORE-AC04] [SAFE-AC02] GoalOrchestrator automatically switches from rate-limited model/harness to next free model and completes goal', async () => {
  const ranker = new FreeModelRanker({
    priorityModels: ['deepseek-v4.1-flash-free', 'gpt-luna', 'neko-local-v1']
  });
  const registry = new HarnessRegistry();

  registry.register({
    id: 'opencode',
    async isAvailable() {
      return true;
    },
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

  // Không có acceptance_cmd → COMPLETED_UNVERIFIED, không còn auto-pass (Spec 08 A2)
  assert.equal(result.status, 'COMPLETED_UNVERIFIED');
  assert.equal(result.journal.length, 2);
  assert.equal(result.journal[0].outcome, 'RATE_LIMITED');
  assert.equal(result.journal[1].model_used, 'opencode/gpt-luna');
  assert.equal(result.journal[1].outcome, 'GOAL_COMPLETED');
});

test('[CORE-AC04] [H2-AC03] [SAFE-AC02] GoalOrchestrator returns COMPLETED with passing acceptance_cmd and saves Experience Library entry (Spec 08 A2 + D2)', async (t) => {
  const workDir = join(tmpdir(), `orch-exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  const ranker = new FreeModelRanker({ priorityModels: ['mock-free-model'] });
  const registry = new HarnessRegistry();

  registry.register({
    id: 'mock',
    async isAvailable() {
      return true;
    },
    async discoverModels() {
      return [{ modelId: 'mock/mock-free-model', isFree: true }];
    },
    async executeStep({ modelId }) {
      return {
        outcome: 'GOAL_COMPLETED',
        summary: 'Implemented verified feature',
        harnessId: 'mock',
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
    id: 'goal-exp-1',
    title: 'Experience wiring goal',
    target_prompt: 'Do the thing',
    repo_path: workDir,
    domain: 'testing',
    acceptance_cmd: 'echo acceptance-pass',
    max_steps: 3
  });
  t.after(() => {
    try { rmSync(workDir, { recursive: true, force: true }); } catch {}
  });

  assert.equal(result.status, 'COMPLETED');
  assert.ok(notifications.some((n) => n.includes('✅')));

  // Experience Library entry saved under .botautotask/library/testing/
  const expFile = join(workDir, '.botautotask', 'library', 'testing', 'goal-exp-1.md');
  assert.ok(existsSync(expFile));
  const expContent = readFileSync(expFile, 'utf8');
  assert.match(expContent, /EXPERIENCE ENTRY: goal-exp-1/);
  assert.match(expContent, /echo acceptance-pass → pass/);

  // A follow-up goal in the same domain receives the PROVEN EXPERIENCE notes
  const result2 = await orchestrator.runGoal({
    id: 'goal-exp-2',
    title: 'Second goal',
    target_prompt: 'Do more',
    repo_path: workDir,
    domain: 'testing',
    acceptance_cmd: 'echo acceptance-pass',
    max_steps: 3
  });
  assert.equal(result2.status, 'COMPLETED');
});

test('[CORE-AC05] HarnessRegistry allows hot-swapping neko-core with a custom self-developed core via config', async () => {
  const ranker = new FreeModelRanker({ priorityModels: ['my-custom-model-free'] });
  const registry = new HarnessRegistry();
  registry.registerFromConfig([
    {
      id: 'my-future-core',
      models: ['my-custom-model-free'],
      commandTemplate:
        'node -e "console.log(\'<OMNIGOAL_SUMMARY>Done by custom core</OMNIGOAL_SUMMARY><OMNIGOAL_STATUS>COMPLETED</OMNIGOAL_STATUS>\')"'
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
