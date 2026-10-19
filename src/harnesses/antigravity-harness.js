import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { OUTCOME, parseStepTags, buildHandoverPrompt } from '../core/types.js';
import { isRateLimitError } from '../core/rate-limit-detector.js';

const execFileAsync = promisify(execFile);

/**
 * Antigravity Harness (`agy` / `agentapi new-conversation`).
 */
export class AntigravityHarness {
  constructor({ binary = 'agy' } = {}) {
    this.id = 'antigravity';
    this.binary = binary;
  }

  async isAvailable() {
    for (const cmd of [this.binary, 'agentapi']) {
      try {
        await execFileAsync(cmd, ['--help'], { timeout: 4000, windowsHide: true, shell: true });
        this.activeBinary = cmd;
        return true;
      } catch {}
    }
    return false;
  }

  async discoverModels() {
    return [{ harnessId: this.id, modelId: 'agy-default', isFree: true }];
  }

  async executeStep({ goal, journal = [], workspaceDir = process.cwd(), modelId = 'agy-default' }) {
    const prompt = buildHandoverPrompt(goal, journal);
    const bin = this.activeBinary || this.binary;
    const args = bin === 'agentapi' ? ['new-conversation', '--', prompt] : ['--', prompt];

    try {
      const { stdout, stderr } = await execFileAsync(bin, args, {
        cwd: workspaceDir,
        timeout: 15 * 60 * 1000,
        windowsHide: true,
        shell: true
      });
      const combined = `${stdout || ''}\n${stderr || ''}`;
      if (isRateLimitError(combined, 0)) {
        return {
          outcome: OUTCOME.RATE_LIMITED,
          summary: 'Antigravity quota/rate limit reached',
          harnessId: this.id,
          modelId
        };
      }
      const parsed = parseStepTags(stdout || stderr);
      return {
        outcome: parsed.completed ? OUTCOME.GOAL_COMPLETED : OUTCOME.STEP_DONE,
        summary: parsed.summary,
        harnessId: this.id,
        modelId
      };
    } catch (err) {
      const combined = `${err.stdout || ''}\n${err.stderr || ''}\n${err.message || ''}`;
      if (isRateLimitError(combined, err.code ?? 1)) {
        return {
          outcome: OUTCOME.RATE_LIMITED,
          summary: 'Antigravity rate limit reached',
          harnessId: this.id,
          modelId
        };
      }
      return {
        outcome: OUTCOME.ERROR,
        summary: combined.slice(-400).trim() || 'Antigravity execution error',
        harnessId: this.id,
        modelId
      };
    }
  }
}
