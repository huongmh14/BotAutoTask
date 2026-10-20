import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { CoreStatsStore } from '../src/core/core-stats.js';
import { FreeModelRanker } from '../src/core/model-discovery.js';
import { HarnessRegistry } from '../src/core/harness-registry.js';

test('CoreStatsStore counts outcomes per core and persists across instances', () => {
  const file = join(tmpdir(), `core-stats-${randomUUID()}.json`);
  const store = new CoreStatsStore(file);
  store.record('opencode', 'opencode/gpt-luna', 'STEP_DONE');
  store.record('opencode', 'opencode/gpt-luna', 'RATE_LIMITED');
  store.record('opencode', 'opencode/gpt-luna', 'RATE_LIMITED');
  store.record('claude', null, 'GOAL_COMPLETED');

  const snap = store.snapshot();
  assert.equal(snap.opencode.runs, 3);
  assert.equal(snap.opencode.rateLimited, 2);
  assert.equal(snap.opencode.errors, 0);
  assert.equal(snap.opencode.goalCompleted, 0);
  assert.equal(snap.opencode.lastModelId, 'opencode/gpt-luna');
  assert.equal(snap.claude.runs, 1);
  assert.equal(snap.claude.goalCompleted, 1);

  // A fresh instance loading the same file must see the same counters
  const reloaded = new CoreStatsStore(file);
  assert.equal(reloaded.snapshot().opencode.rateLimited, 2);
  const onDisk = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(onDisk.cores.claude.runs, 1);
});

test('CoreStatsStore survives a corrupt stats file without throwing', () => {
  const file = join(tmpdir(), `core-stats-broken-${randomUUID()}.json`);
  writeFileSync(file, '{not json at all', 'utf8');
  const store = new CoreStatsStore(file);
  store.record('codex', 'codex-default', 'STEP_DONE');
  assert.equal(store.snapshot().codex.runs, 1);
});

test('FreeModelRanker.getActiveCooldowns lists and purges, and survives colons in model ids', () => {
  const ranker = new FreeModelRanker({ cooldownMs: 1000 });
  const NOW = 1_700_000_000_000;
  ranker.markCooldown('opencode', 'openrouter/minimax/minimax-m3.1-flash:free', 60_000, NOW);
  ranker.markCooldown('claude', 'claude-sonnet', 60_000, NOW);
  ranker.markCooldown('codex', 'codex-default', 1, NOW); // expires at NOW+1

  const all = ranker.getActiveCooldowns(null, NOW + 5_000);
  assert.equal(all.length, 2, 'expired cooldown must be purged');
  const oc = all.find((c) => c.harnessId === 'opencode');
  assert.ok(oc, 'opencode cooldown present');
  assert.equal(oc.modelId, 'openrouter/minimax/minimax-m3.1-flash:free', 'model id keeps its :free suffix');
  assert.ok(oc.remainingMs > 0 && oc.remainingMs <= 60_000);

  const onlyClaude = ranker.getActiveCooldowns('claude', NOW + 5_000);
  assert.equal(onlyClaude.length, 1);
  assert.equal(onlyClaude[0].modelId, 'claude-sonnet');
});

test('HarnessRegistry wraps executeStep to record stats without changing the receipt', async () => {
  const store = new CoreStatsStore(join(tmpdir(), `core-stats-reg-${randomUUID()}.json`));
  const registry = new HarnessRegistry({ stats: store });
  const receipt = { outcome: 'RATE_LIMITED', summary: '429', harnessId: 'stub', modelId: 'm1' };
  registry.register({
    id: 'stub',
    isAvailable: async () => true,
    discoverModels: async () => [],
    executeStep: async ({ modelId }) => ({ ...receipt, modelId })
  });

  const out = await registry.get('stub').executeStep({ goal: {}, modelId: 'm1' });
  assert.equal(out.outcome, 'RATE_LIMITED');
  assert.equal(out.modelId, 'm1');

  const snap = store.snapshot();
  assert.equal(snap.stub.runs, 1);
  assert.equal(snap.stub.rateLimited, 1);
  assert.equal(snap.stub.lastModelId, 'm1');

  // Re-registering the same harness instance must not double-wrap
  registry.register(registry.get('stub'));
  await registry.get('stub').executeStep({ goal: {}, modelId: 'm1' });
  assert.equal(store.snapshot().stub.runs, 2, 'exactly one record per execution');
});
