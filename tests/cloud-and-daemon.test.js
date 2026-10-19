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

  const localOnlyGoal = {
    ...expiredGoal,
    execution_mode: 'local'
  };
  assert.equal(shouldTriggerCloudFallback(localOnlyGoal, now), false);
});
