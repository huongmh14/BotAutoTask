import test from 'node:test';
import assert from 'node:assert/strict';
import { FreeModelRanker } from '../src/core/model-discovery.js';
import { HarnessRegistry } from '../src/core/harness-registry.js';
import { GoalOrchestrator } from '../src/core/orchestrator.js';

test('GoalOrchestrator automatically switches from rate-limited model/harness to next free model and completes goal', async () => {
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
