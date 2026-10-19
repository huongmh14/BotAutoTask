import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AgentMesh } from '../src/core/agent-mesh.js';
import { HarnessRegistry } from '../src/core/harness-registry.js';
import { FreeModelRanker } from '../src/core/model-discovery.js';
import { OUTCOME } from '../src/core/types.js';

function concurrencyProbeHarness(id, modelId, probe) {
  return {
    id,
    async isAvailable() {
      return true;
    },
    async discoverModels() {
      return [{ harnessId: id, modelId, isFree: true }];
    },
    async executeStep({ goal, modelId }) {
      probe.running += 1;
      probe.maxConcurrent = Math.max(probe.maxConcurrent, probe.running);
      await new Promise((r) => setTimeout(r, 60));
      probe.running -= 1;
      probe.calls.push(`${id}:${modelId}`);
      return {
        outcome: OUTCOME.GOAL_COMPLETED,
        summary: `done ${goal.slice(-20)} on ${id}`,
        harnessId: id,
        modelId
      };
    }
  };
}

function arenaMockMesh() {
  const registry = new HarnessRegistry();
  const ranker = new FreeModelRanker({ priorityModels: ['mock/free-model'] });
  registry.register(concurrencyProbeHarness('mock', 'mock/free-model', { running: 0, maxConcurrent: 0, calls: [] }));
  const stateFile = join(tmpdir(), `arena-mesh-${randomUUID()}.json`);
  return new AgentMesh({ registry, ranker, stateFile });
}

test('broadcast with parallel=true runs all agents concurrently', async () => {
  const probe = { running: 0, maxConcurrent: 0, calls: [] };
  const registry = new HarnessRegistry();
  const ranker = new FreeModelRanker({ priorityModels: ['mock/free-model'] });
  registry.register(concurrencyProbeHarness('mock', 'mock/free-model', probe));
  const mesh = new AgentMesh({ registry, ranker, stateFile: join(tmpdir(), `par-${randomUUID()}.json`) });

  const out = await mesh.sendToAgent({
    fromId: 'commander',
    targetId: 'all',
    message: 'parallel broadcast probe',
    delivery: 'send',
    wait: true,
    parallel: true
  });

  assert.equal(out.delivered, true);
  assert.equal(out.parallel, true);
  assert.equal(out.broadcast.length, 3, 'squad lead/coder/reviewer all messaged');
  assert.ok(out.broadcast.every((r) => r.status === OUTCOME.GOAL_COMPLETED), 'all turns completed');
  assert.equal(probe.maxConcurrent, 3, 'turns must overlap — 3 writers run at once');

  // Sequential default is preserved
  const probe2 = { running: 0, maxConcurrent: 0, calls: [] };
  const registry2 = new HarnessRegistry();
  registry2.register(concurrencyProbeHarness('mock', 'mock/free-model', probe2));
  const mesh2 = new AgentMesh({ registry: registry2, ranker, stateFile: join(tmpdir(), `seq-${randomUUID()}.json`) });
  const seq = await mesh2.sendToAgent({ fromId: 'commander', targetId: 'all', message: 'seq probe', delivery: 'send', wait: true });
  assert.equal(seq.parallel, undefined);
  assert.equal(probe2.maxConcurrent, 1, 'default broadcast stays sequential');
});

test('runArena fans out in parallel, verifies each worktree, ranks and stops losers', async () => {
  const mesh = arenaMockMesh();
  const events = [];
  mesh.onEvent = (evt) => events.push(evt.type);

  const out = await mesh.runArena({ goal: 'Viết hàm cộng hai số và test', verifyCmd: 'exit 0', participants: 3 });

  assert.equal(out.participants, 3);
  assert.equal(out.results.length, 3);
  assert.ok(out.winner, 'a winner must exist when verify passes');
  assert.equal(out.winner.verified, true);
  assert.equal(out.winner.rank, 3);
  assert.ok(out.results.every((r) => r.spec && r.runnerId.startsWith(out.arenaId)));

  const roster = new Map(mesh.listAgents().map((a) => [a.id, a.status]));
  const loserStates = out.results.slice(1).map((r) => roster.get(r.runnerId));
  assert.ok(loserStates.every((s) => s === 'aborted'), 'losers stopped');
  assert.notEqual(roster.get(out.winner.runnerId), 'aborted', 'winner stays active');

  assert.ok(events.includes('arena_started'));
  assert.ok(events.includes('arena_finished'));
});

test('runArena with failing verify has no verified winner but still ranks outcomes', async () => {
  const mesh = arenaMockMesh();
  const out = await mesh.runArena({ goal: 'Impossible task', verifyCmd: 'exit 1', participants: 2 });
  assert.equal(out.participants, 2);
  assert.ok(out.results.every((r) => r.verified === false));
  // Mock harness always GOAL_COMPLETED → rank 2 winner still selected as best effort
  assert.ok(out.winner);
  assert.equal(out.winner.rank, 2);
});

test('runArena rejects nonsense participant counts into the 2..6 band', async () => {
  const mesh = arenaMockMesh();
  const tooFew = await mesh.runArena({ goal: 'g', participants: 1 });
  assert.equal(tooFew.participants, 2);
  const tooMany = await mesh.runArena({ goal: 'g', participants: 99 });
  assert.equal(tooMany.participants, 6);
  const nonsense = await mesh.runArena({ goal: 'g', participants: 'abc' });
  assert.equal(nonsense.participants, 3);
});
