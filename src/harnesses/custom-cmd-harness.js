import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { OUTCOME, parseStepTags, buildHandoverPrompt } from '../core/types.js';
import { isRateLimitError } from '../core/rate-limit-detector.js';

const execAsync = promisify(exec);

/**
 * Pluggable Custom Command Harness.
 * Allows swapping Neko Core or adding any future self-developed AI core purely via JSON configuration
 * (`commandTemplate`: e.g. `my-core run --model {{model}} --prompt-file {{prompt_file}}`).
 */
export class CustomCmdHarness {
  constructor(def = {}) {
    this.id = def.id || 'custom-cmd';
    this.models = def.models || [`${this.id}-default`];
    this.commandTemplate = def.commandTemplate || '';
    this.checkCommand = def.checkCommand || null;
  }

  async isAvailable() {
    if (!this.commandTemplate) return false;
    if (!this.checkCommand) return true;
    try {
      await execAsync(this.checkCommand, { timeout: 4000, windowsHide: true });
      return true;
    } catch {
      return false;
    }
  }

  async discoverModels() {
    return this.models.map((m) => ({
      harnessId: this.id,
      modelId: m,
      isFree: true
    }));
  }

  async executeStep({ goal, journal = [], workspaceDir = process.cwd(), modelId }) {
    const prompt = buildHandoverPrompt(goal, journal);
    const tempFile = join(tmpdir(), `botautotask-${goal.id || 'step'}-${Date.now()}.txt`);
    writeFileSync(tempFile, prompt, 'utf8');

    const cmd = this.commandTemplate
      .replaceAll('{{model}}', modelId || this.models[0] || '')
      .replaceAll('{{prompt_file}}', tempFile)
      .replaceAll('{{workspace}}', workspaceDir);

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: workspaceDir,
        timeout: 10 * 60 * 1000,
        windowsHide: true
      });
      const combined = `${stdout || ''}\n${stderr || ''}`;
      if (isRateLimitError(combined, 0)) {
        return {
          outcome: OUTCOME.RATE_LIMITED,
          summary: `Rate limit on ${this.id}/${modelId}`,
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
          summary: `Rate limit hit on ${this.id}/${modelId}`,
          harnessId: this.id,
          modelId
        };
      }
      return {
        outcome: OUTCOME.ERROR,
        summary: combined.slice(-400).trim() || `Execution failed on ${this.id}`,
        harnessId: this.id,
        modelId
      };
    } finally {
      try {
        unlinkSync(tempFile);
      } catch {}
    }
  }
}
