/**
 * BotAutoTask — Git Worktree Manager per Agent.
 * Enables multiple autonomous AI agent writers to modify code in parallel isolated git worktrees
 * without stepping on each other's files, followed by isolated verification and atomic merges.
 */

import { existsSync, mkdirSync, rmSync, readFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export function slugifyAgentId(id = '') {
  return String(id || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'worker';
}

export class WorktreeManager {
  constructor({ repoPath = process.cwd(), baseBranch = 'HEAD' } = {}) {
    this.repoPath = resolve(repoPath);
    this.baseBranch = baseBranch;
    this.worktreesRoot = join(this.repoPath, '.botautotask', 'worktrees');
    this.isGitRepo = this._checkIsGitRepo();
    if (this.isGitRepo) {
      this._ensureGitExcluded();
    }
  }

  _ensureGitExcluded() {
    try {
      const excludeFile = join(this.repoPath, '.git', 'info', 'exclude');
      if (existsSync(excludeFile)) {
        const content = readFileSync(excludeFile, 'utf8');
        if (!content.includes('.botautotask/')) {
          appendFileSync(excludeFile, '\n.botautotask/\n', 'utf8');
        }
      }
    } catch {}
  }

  _runGit(args, cwd = this.repoPath, timeoutMs = 60000) {
    const res = spawnSync('git', args, {
      cwd,
      encoding: 'utf8',
      timeout: timeoutMs,
      shell: false
    });
    return {
      status: res.status ?? 1,
      stdout: (res.stdout || '').trim(),
      stderr: (res.stderr || '').trim()
    };
  }

  _checkIsGitRepo() {
    try {
      const res = this._runGit(['rev-parse', '--is-inside-work-tree'], this.repoPath, 5000);
      return res.status === 0 && res.stdout === 'true';
    } catch {
      return false;
    }
  }

  getWorktreePath(agentId) {
    const slug = slugifyAgentId(agentId);
    return join(this.worktreesRoot, slug);
  }

  getBranchName(agentId) {
    const slug = slugifyAgentId(agentId);
    return `botautotask/agent-${slug}`;
  }

  /**
   * Ensures an isolated git worktree exists for the given agent.
   * Falls back to repoPath if the workspace is not a git repository.
   */
  ensure(agentId, baseRef = this.baseBranch) {
    if (!this.isGitRepo) {
      return {
        path: this.repoPath,
        isWorktree: false,
        warning: 'NOT_A_GIT_REPOSITORY'
      };
    }

    const wtPath = this.getWorktreePath(agentId);
    const branchName = this.getBranchName(agentId);

    // Ensure parent directory exists
    mkdirSync(this.worktreesRoot, { recursive: true });

    if (existsSync(wtPath)) {
      const wtStatus = this._runGit(['status', '--porcelain'], wtPath);
      if (!wtStatus.stdout) {
        const ffRes = this._runGit(['merge', '--no-edit', baseRef], wtPath);
        if (ffRes.status !== 0) {
          this._runGit(['merge', '--abort'], wtPath);
        }
      }
      return { path: wtPath, branch: branchName, isWorktree: true };
    }

    // Create branch and worktree
    const addRes = this._runGit(['worktree', 'add', '-B', branchName, wtPath, baseRef]);
    if (addRes.status !== 0) {
      // Fallback: try creating without -B if branch already exists
      const fallbackRes = this._runGit(['worktree', 'add', wtPath, branchName]);
      if (fallbackRes.status !== 0) {
        throw new Error(`Failed to create worktree for agent ${agentId}: ${addRes.stderr || fallbackRes.stderr}`);
      }
    }

    return { path: wtPath, branch: branchName, isWorktree: true };
  }

  /**
   * Commits all changes in the agent's worktree.
   */
  commit(agentId, message = 'Auto-commit from agent turn') {
    const wtPath = this.getWorktreePath(agentId);
    const cwd = existsSync(wtPath) ? wtPath : this.repoPath;

    if (!this.isGitRepo) {
      return { committed: false, reason: 'NOT_A_GIT_REPOSITORY' };
    }

    // Check status
    const statusRes = this._runGit(['status', '--porcelain'], cwd);
    if (!statusRes.stdout) {
      return { committed: false, reason: 'CLEAN_WORKING_TREE' };
    }

    // Stage all changes
    this._runGit(['add', '-A'], cwd);

    // Commit
    const commitRes = this._runGit(['commit', '-m', message], cwd);
    if (commitRes.status !== 0) {
      throw new Error(`Git commit failed in worktree: ${commitRes.stderr}`);
    }

    const shaRes = this._runGit(['rev-parse', 'HEAD'], cwd);
    const statRes = this._runGit(['diff', '--stat', 'HEAD~1', 'HEAD'], cwd);

    return {
      committed: true,
      sha: shaRes.stdout,
      diffStat: statRes.stdout
    };
  }

  /**
   * Runs acceptance / test command inside the agent's worktree (or a specified cwd).
   */
  verify(agentId, cmd, timeoutMs = 300000, customCwd = null) {
    const wtPath = this.getWorktreePath(agentId);
    const cwd = customCwd || (existsSync(wtPath) ? wtPath : this.repoPath);
    const start = Date.now();

    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'powershell.exe' : '/bin/sh';
    const shellArgs = isWindows ? ['-NoProfile', '-Command', cmd] : ['-c', cmd];

    const res = spawnSync(shell, shellArgs, {
      cwd,
      encoding: 'utf8',
      timeout: timeoutMs
    });

    const durationMs = Date.now() - start;
    const passed = (res.status === 0);
    return {
      passed,
      exitCode: res.status ?? 1,
      stdout: (res.stdout || '').trim(),
      stderr: (res.stderr || '').trim(),
      durationMs
    };
  }

  /**
   * Merges the agent's worktree branch into the base branch with verification.
   */
  merge(agentId, { verifyCmd = null } = {}) {
    if (!this.isGitRepo) {
      return { success: true, isWorktree: false };
    }

    const branchName = this.getBranchName(agentId);

    // 0. Auto-commit any uncommitted edits left by the writer agent in its worktree
    try {
      this.commit(agentId, `feat(${agentId}): auto-commit agent worktree changes`);
    } catch {}

    // 1. Verify in worktree first
    if (verifyCmd) {
      const wtVerify = this.verify(agentId, verifyCmd);
      if (!wtVerify.passed) {
        return {
          success: false,
          reason: 'VERIFY_FAILED_IN_WORKTREE',
          error: wtVerify.stderr || wtVerify.stdout
        };
      }
    }

    // 2. Clean any colliding uncommitted/untracked files in main working tree so verified worktree merges cleanly
    const changedRes = this._runGit(['diff', '--name-only', `HEAD...${branchName}`]);
    const changedFiles = changedRes.stdout ? changedRes.stdout.split(/\r?\n/).filter(Boolean) : [];
    for (const f of changedFiles) {
      this._runGit(['checkout', '--', f]);
      this._runGit(['clean', '-f', '--', f]);
    }

    // 3. Merge into main repository working tree
    const mergeRes = this._runGit(['merge', '--no-ff', branchName, '-m', `Merge worktree of agent ${agentId}`]);
    if (mergeRes.status !== 0) {
      // Collect conflict files
      const conflictRes = this._runGit(['diff', '--name-only', '--diff-filter=U']);
      const conflicts = conflictRes.stdout ? conflictRes.stdout.split('\n').filter(Boolean) : [];

      // Abort merge cleanly
      this._runGit(['merge', '--abort']);
      return {
        success: false,
        reason: 'MERGE_CONFLICT',
        conflicts,
        error: mergeRes.stderr || mergeRes.stdout
      };
    }

    // 3. Verify on main branch after merge
    if (verifyCmd) {
      const mainVerify = this.verify(agentId, verifyCmd, 300000, this.repoPath);
      if (!mainVerify.passed) {
        // Revert merge commit cleanly
        this._runGit(['reset', '--hard', 'HEAD~1']);
        return {
          success: false,
          reason: 'VERIFY_FAILED_ON_MAIN',
          error: mainVerify.stderr || mainVerify.stdout
        };
      }
    }

    const headShaRes = this._runGit(['rev-parse', 'HEAD']);
    return {
      success: true,
      sha: headShaRes.stdout
    };
  }

  /**
   * Cleans up worktrees and branches.
   */
  cleanup(agentId = null) {
    if (!this.isGitRepo) return;

    if (agentId) {
      const wtPath = this.getWorktreePath(agentId);
      const branchName = this.getBranchName(agentId);
      if (existsSync(wtPath)) {
        this._runGit(['worktree', 'remove', '--force', wtPath]);
      }
      this._runGit(['branch', '-D', branchName]);
    } else {
      this._runGit(['worktree', 'prune']);
      if (existsSync(this.worktreesRoot)) {
        try { rmSync(this.worktreesRoot, { recursive: true, force: true }); } catch {}
      }
    }
  }
}
