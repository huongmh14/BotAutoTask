import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { WorktreeManager } from '../src/core/worktree-manager.js';

function runGitCmd(args, cwd) {
  return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

function createTempGitRepo() {
  const repoDir = join(tmpdir(), `wt-test-repo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  mkdirSync(repoDir, { recursive: true });

  runGitCmd(['init', '-b', 'main'], repoDir);
  runGitCmd(['config', 'user.name', 'BotAutoTask Tester'], repoDir);
  runGitCmd(['config', 'user.email', 'test@botautotask.local'], repoDir);

  writeFileSync(join(repoDir, 'README.md'), '# Test Project\nInitial content\n', 'utf8');
  runGitCmd(['add', 'README.md'], repoDir);
  runGitCmd(['commit', '-m', 'Initial commit'], repoDir);

  return repoDir;
}

test('WorktreeManager ensures isolated worktree per agent and merges cleanly', (t) => {
  const repoDir = createTempGitRepo();
  t.after(() => {
    try { rmSync(repoDir, { recursive: true, force: true }); } catch {}
  });

  const wm = new WorktreeManager({ repoPath: repoDir, baseBranch: 'main' });

  // 1. Ensure isolated worktrees for two writers
  const wtA = wm.ensure('agent-alice');
  const wtB = wm.ensure('agent-bob');

  assert.equal(wtA.isWorktree, true);
  assert.equal(wtB.isWorktree, true);
  assert.ok(existsSync(wtA.path));
  assert.ok(existsSync(wtB.path));
  assert.notEqual(wtA.path, wtB.path);

  // 2. Alice writes a new file in her worktree
  writeFileSync(join(wtA.path, 'alice.txt'), 'Hello from Alice\n', 'utf8');
  const commitA = wm.commit('agent-alice', 'Alice added feature A');
  assert.equal(commitA.committed, true);
  assert.ok(commitA.sha);

  // 3. Bob writes a different file in his worktree
  writeFileSync(join(wtB.path, 'bob.txt'), 'Hello from Bob\n', 'utf8');
  const commitB = wm.commit('agent-bob', 'Bob added feature B');
  assert.equal(commitB.committed, true);
  assert.ok(commitB.sha);

  // 4. Merge Alice into main
  const mergeA = wm.merge('agent-alice');
  assert.equal(mergeA.success, true);
  assert.ok(existsSync(join(repoDir, 'alice.txt')));

  // 5. Merge Bob into main (parallel non-conflicting work)
  const mergeB = wm.merge('agent-bob');
  assert.equal(mergeB.success, true);
  assert.ok(existsSync(join(repoDir, 'bob.txt')));

  // Cleanup
  wm.cleanup();
  assert.ok(!existsSync(wm.worktreesRoot));
});

test('WorktreeManager detects merge conflicts, aborts cleanly, and reports conflicting files', (t) => {
  const repoDir = createTempGitRepo();
  t.after(() => {
    try { rmSync(repoDir, { recursive: true, force: true }); } catch {}
  });

  const wm = new WorktreeManager({ repoPath: repoDir, baseBranch: 'main' });
  const wtA = wm.ensure('coder-1');
  const wtB = wm.ensure('coder-2');

  // Both edit the exact same line in README.md differently
  writeFileSync(join(wtA.path, 'README.md'), '# Test Project\nAlice line modification\n', 'utf8');
  wm.commit('coder-1', 'Coder 1 changed readme');

  writeFileSync(join(wtB.path, 'README.md'), '# Test Project\nBob conflicting line\n', 'utf8');
  wm.commit('coder-2', 'Coder 2 changed readme');

  // Coder 1 merges first -> succeeds
  const merge1 = wm.merge('coder-1');
  assert.equal(merge1.success, true);

  // Coder 2 merges -> conflict detected & aborted cleanly
  const merge2 = wm.merge('coder-2');
  assert.equal(merge2.success, false);
  assert.equal(merge2.reason, 'MERGE_CONFLICT');
  assert.deepEqual(merge2.conflicts, ['README.md']);

  // Main repository must remain clean without lingering merge state
  const statusRes = runGitCmd(['status', '--porcelain'], repoDir);
  assert.equal(statusRes.stdout.trim(), '');

  wm.cleanup();
});

test('WorktreeManager falls back safely when directory is not a git repo', (t) => {
  const nonGitDir = join(tmpdir(), `wt-nongit-${Date.now()}`);
  mkdirSync(nonGitDir, { recursive: true });
  t.after(() => {
    try { rmSync(nonGitDir, { recursive: true, force: true }); } catch {}
  });

  const wm = new WorktreeManager({ repoPath: nonGitDir });
  const res = wm.ensure('worker');
  assert.equal(res.isWorktree, false);
  assert.equal(res.path, nonGitDir);
  assert.equal(res.warning, 'NOT_A_GIT_REPOSITORY');
});
