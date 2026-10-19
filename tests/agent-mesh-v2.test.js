import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AgentMesh } from '../src/core/agent-mesh.js';
import { HarnessRegistry } from '../src/core/harness-registry.js';
import { FreeModelRanker } from '../src/core/model-discovery.js';
import { OUTCOME } from '../src/core/types.js';

function createMockMesh() {
  const registry = new HarnessRegistry();
  const ranker = new FreeModelRanker({ priorityModels: ['mock/free-model'] });

  registry.register({
    id: 'mock',
    async isAvailable() { return true; },
    async discoverModels() { return [{ harnessId: 'mock', modelId: 'mock/free-model', isFree: true }]; },
    async executeStep({ goal, modelId, signal }) {
      if (signal?.aborted) {
        throw new Error('Aborted by signal');
      }
      return {
        outcome: OUTCOME.GOAL_COMPLETED,
        summary: `Finished turn: ${goal.slice(-60).replace(/\s+/g, ' ')}`,
        rawOutput: 'Done',
        harnessId: 'mock',
        modelId
      };
    }
  });

  const stateFile = join(tmpdir(), `mesh-v2-test-${randomUUID()}.json`);
  return new AgentMesh({ registry, ranker, stateFile });
}

test('AgentMesh v2 supports delivery modes (send, interrupt, queue)', async () => {
  const mesh = createMockMesh();

  // 1. Delivery "queue" — queues message in inbox without executing immediately
  const queueRes = await mesh.sendToAgent({
    fromId: 'lead',
    targetId: 'coder',
    message: 'Queued task to do later',
    delivery: 'queue',
    wait: false
  });
  assert.equal(queueRes.delivered, true);
  assert.equal(queueRes.status, 'queued');

  const coderInfo = mesh.checkAgent('coder');
  assert.equal(coderInfo.inboxCount, 1);

  // 2. Delivery "interrupt" — pushes high-priority steer into pendingSteers
  const interruptRes = await mesh.sendToAgent({
    fromId: 'lead',
    targetId: 'coder',
    message: 'Drop everything and fix security leak',
    delivery: 'interrupt',
    wait: false
  });
  assert.equal(interruptRes.delivered, true);
  const coderAfterSteer = mesh.checkAgent('coder');
  assert.equal(coderAfterSteer.pendingSteers.length, 1);

  // 3. Delivery "send" (wait: true) — consumes steer and inbox during execution
  const sendRes = await mesh.sendToAgent({
    fromId: 'lead',
    targetId: 'coder',
    message: 'Run normal turn',
    delivery: 'send',
    wait: true
  });
  assert.equal(sendRes.delivered, true);
  assert.equal(sendRes.status, OUTCOME.GOAL_COMPLETED);

  const coderFinal = mesh.checkAgent('coder');
  assert.equal(coderFinal.pendingSteers.length, 0);
  assert.equal(coderFinal.inboxCount, 0);
});

test('AgentMesh v2 Loop Guard rejects identical repeated calls after 3 times', async () => {
  const mesh = createMockMesh();
  const repeatedMsg = 'Build exact same feature';

  const res1 = await mesh.sendToAgent({ fromId: 'lead', targetId: 'coder', message: repeatedMsg, wait: true });
  assert.equal(res1.delivered, true);

  const res2 = await mesh.sendToAgent({ fromId: 'lead', targetId: 'coder', message: repeatedMsg, wait: true });
  assert.equal(res2.delivered, true);

  // 3rd attempt with identical message -> Loop Guard triggers!
  const res3 = await mesh.sendToAgent({ fromId: 'lead', targetId: 'coder', message: repeatedMsg, wait: true });
  assert.equal(res3.delivered, false);
  assert.match(res3.error, /Loop detected: same message sent/);
});
