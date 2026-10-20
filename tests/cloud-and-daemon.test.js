import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, readFileSync } from 'node:fs';
import { parseTelegramCommand, shouldTriggerCloudFallback } from '../cloud-core/worker.js';
import { LocalDaemon } from '../src/daemon/local-daemon.js';
import { atomicWriteJsonSync } from '../src/core/atomic-write.js';

test('[CLOUD-AC03] parseTelegramCommand parses /goal, /switch, and /mode with flags', () => {
  const cmd = parseTelegramCommand('/goal Fix all tests --repo owner/repo --core opencode:gpt-luna');
  assert.equal(cmd.command, '/goal');
  assert.equal(cmd.args, 'Fix all tests');
  assert.equal(cmd.flags.repo, 'owner/repo');
  assert.equal(cmd.flags.core, 'opencode:gpt-luna');
});

test('[CLOUD-AC03] shouldTriggerCloudFallback triggers when local PC lease expires and repo_url is configured', () => {
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

  const localOnlyGoal = {
    ...expiredGoal,
    execution_mode: 'local'
  };
  assert.equal(shouldTriggerCloudFallback(localOnlyGoal, now), false);
});

test('[CORE-AC07] atomicWriteJsonSync and LocalDaemon persist queue entries safely', (t) => {
  const queueFile = join(tmpdir(), `botautotask-queue-${Date.now()}.json`);
  t.after(() => {
    try { rmSync(queueFile, { force: true }); } catch {}
    try { rmSync(`${queueFile}.bak`, { force: true }); } catch {}
  });

  atomicWriteJsonSync(queueFile, [{ id: 'g-seed', status: 'QUEUED' }], { makeBackup: true });
  const daemon = new LocalDaemon({ queueFile });
  assert.equal(daemon.loadLocalQueue().length, 1);

  const added = daemon.enqueueLocalGoal({ id: 'g-offline-1', target_prompt: 'Run offline queue check' });
  assert.equal(added.id, 'g-offline-1');
  assert.equal(added.status, 'QUEUED');

  const persisted = JSON.parse(readFileSync(queueFile, 'utf8'));
  assert.equal(persisted.length, 2);
  assert.equal(persisted[1].id, 'g-offline-1');
});
