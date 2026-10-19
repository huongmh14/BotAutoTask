import { OUTCOME, parseStepTags, buildHandoverPrompt } from '../core/types.js';
import { isRateLimitError } from '../core/rate-limit-detector.js';
import { runCliProcess, commandExists } from '../core/spawn-cli.js';

/**
 * Claude Code (`claude -p`) and OpenAI Codex (`codex exec`) Harnesses.
 */
export class ClaudeCodexHarness {
  constructor({ id = 'claude', binary = 'claude' } = {}) {
    this.id = id;
    this.binary = binary;
  }

  async isAvailable() {
    return commandExists(this.binary);
  }

  async discoverModels() {
    return [
      {
        harnessId: this.id,
        modelId: this.id === 'codex' ? 'codex-default' : 'claude-sonnet',
        isFree: true
      }
    ];
  }

  async executeStep({ goal, journal = [], workspaceDir = process.cwd(), modelId }) {
    const prompt = buildHandoverPrompt(goal, journal);
    const args =
      this.id === 'codex'
        ? ['exec', '--full-auto', prompt]
        : ['-p', prompt, '--dangerously-skip-permissions'];

    try {
      const { stdout, stderr } = await runCliProcess(this.binary, args, {
        cwd: workspaceDir,
        timeoutMs: 15 * 60 * 1000
      });
      const combined = `${stdout || ''}\n${stderr || ''}`;
      if (isRateLimitError(combined, 0)) {
        return {
          outcome: OUTCOME.RATE_LIMITED,
          summary: `${this.id} rate/usage limit reached`,
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
          summary: `${this.id} rate/usage limit reached`,
          harnessId: this.id,
          modelId
        };
      }
      return {
        outcome: OUTCOME.ERROR,
        summary: combined.slice(-400).trim() || `${this.id} execution failed`,
        harnessId: this.id,
        modelId
      };
    }
  }
}
