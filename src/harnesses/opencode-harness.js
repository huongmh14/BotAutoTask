import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { OUTCOME, parseStepTags, buildHandoverPrompt } from '../core/types.js';
import { isRateLimitError } from '../core/rate-limit-detector.js';

const execFileAsync = promisify(execFile);

/**
 * OpenCode CLI Harness (`opencode run -m <model> <prompt>`).
 * Supports dynamic discovery of top free models (e.g. deepseek-v4.1-flash-free, gpt-luna, openrouter/*:free).
 */
export class OpenCodeHarness {
  constructor({ binary = 'opencode', ranker = null } = {}) {
    this.id = 'opencode';
    this.binary = binary;
    this.ranker = ranker;
  }

  async isAvailable() {
    try {
      await execFileAsync(this.binary, ['--version'], { timeout: 4000, windowsHide: true, shell: true });
      return true;
    } catch {
      return false;
    }
  }

  async discoverModels() {
    if (!this.ranker) {
      return [
        { harnessId: this.id, modelId: 'opencode/deepseek-v4.1-flash-free', isFree: true },
        { harnessId: this.id, modelId: 'opencode/gpt-luna', isFree: true }
      ];
    }
    const [cliModels, orModels] = await Promise.all([
      this.ranker.discoverOpenCodeCliModels(this.binary),
      this.ranker.discoverOpenRouterFreeModels()
    ]);
    const seen = new Set();
    const merged = [];
    for (const item of [...cliModels, ...orModels]) {
      if (!seen.has(item.modelId)) {
        seen.add(item.modelId);
        merged.push({ ...item, harnessId: this.id });
      }
    }
    return merged;
  }

  async executeStep({ goal, journal = [], workspaceDir = process.cwd(), modelId }) {
    const prompt = buildHandoverPrompt(goal, journal);
    const args = ['run'];
    if (modelId) {
      args.push('-m', modelId);
    }
    args.push(prompt);

    try {
      const { stdout, stderr } = await execFileAsync(this.binary, args, {
        cwd: workspaceDir,
        timeout: 15 * 60 * 1000,
        windowsHide: true,
        shell: true
      });
      const combined = `${stdout || ''}\n${stderr || ''}`;
      if (isRateLimitError(combined, 0)) {
        return {
          outcome: OUTCOME.RATE_LIMITED,
          summary: `Rate limit on opencode (${modelId})`,
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
          summary: `Rate limit hit on opencode (${modelId})`,
          harnessId: this.id,
          modelId
        };
      }
      return {
        outcome: OUTCOME.ERROR,
        summary: combined.slice(-400).trim() || `OpenCode failed on ${modelId}`,
        harnessId: this.id,
        modelId
      };
    }
  }
}
