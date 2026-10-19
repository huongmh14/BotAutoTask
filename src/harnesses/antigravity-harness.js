import { join } from 'node:path';
import { OUTCOME, parseStepTags, buildHandoverPrompt } from '../core/types.js';
import { isRateLimitError } from '../core/rate-limit-detector.js';
import { runCliProcess, commandExists } from '../core/spawn-cli.js';
import { findLatestAntigravityTranscript, writeIdeDirectiveBridge } from '../core/log-reader.js';

/**
 * Antigravity Harness (`agy` / `antigravity` / `agentapi new-conversation` + `transcript.jsonl` reader).
 * Supports Strategy 2: writes directives to `.botautotask/DIRECTIVE.md` and reads real-time execution
 * logs from `~/.gemini/antigravity/brain/<conv-id>/.system_generated/logs/transcript.jsonl`.
 */
export class AntigravityHarness {
  constructor({ binary = 'agy' } = {}) {
    this.id = 'antigravity';
    this.binary = binary;
  }

  async isAvailable() {
    const localAppData = process.env.LOCALAPPDATA || '';
    const candidates = [
      this.binary,
      'agentapi',
      'antigravity',
      localAppData ? join(localAppData, 'Programs', 'Antigravity', 'bin', 'antigravity.cmd') : '',
      localAppData ? join(localAppData, 'Programs', 'Antigravity', 'Antigravity.exe') : ''
    ].filter(Boolean);

    for (const cmd of candidates) {
      if (commandExists(cmd)) {
        this.activeBinary = cmd;
        return true;
      }
    }
    return false;
  }

  async discoverModels() {
    return [{ harnessId: this.id, modelId: 'agy-default', isFree: true }];
  }

  async executeStep({ goal, journal = [], workspaceDir = process.cwd(), modelId = 'agy-default' }) {
    const prompt = buildHandoverPrompt(goal, journal);
    writeIdeDirectiveBridge(workspaceDir, {
      goalId: goal.id || 'goal',
      stepNumber: (journal?.length || 0) + 1,
      directive: prompt,
      reasoning: 'Dispatched to Antigravity IDE / CLI'
    });

    const bin = this.activeBinary || this.binary;
    const args = bin === 'agentapi' ? ['new-conversation', '--', prompt] : ['--', prompt];

    try {
      const { stdout, stderr } = await runCliProcess(bin, args, {
        cwd: workspaceDir,
        timeoutMs: 15 * 60 * 1000
      });
      const combined = `${stdout || ''}\n${stderr || ''}`;
      const latestTranscript = findLatestAntigravityTranscript();
      const rawLog = latestTranscript
        ? `Tools: ${latestTranscript.summary.toolCalls.join(', ')}\nResponse: ${latestTranscript.summary.lastAgentResponse}`
        : combined.slice(-800);

      if (isRateLimitError(combined, 0)) {
        return {
          outcome: OUTCOME.RATE_LIMITED,
          summary: 'Antigravity quota/rate limit reached',
          harnessId: this.id,
          modelId,
          rawLog
        };
      }
      const parsed = parseStepTags(stdout || latestTranscript?.summary?.lastAgentResponse || stderr);
      return {
        outcome: parsed.completed ? OUTCOME.GOAL_COMPLETED : OUTCOME.STEP_DONE,
        summary: parsed.summary,
        harnessId: this.id,
        modelId,
        rawLog
      };
    } catch (err) {
      const combined = `${err.stdout || ''}\n${err.stderr || ''}\n${err.message || ''}`;
      if (isRateLimitError(combined, err.code ?? 1)) {
        return {
          outcome: OUTCOME.RATE_LIMITED,
          summary: 'Antigravity rate limit reached',
          harnessId: this.id,
          modelId,
          rawLog: combined.slice(-800)
        };
      }
      return {
        outcome: OUTCOME.ERROR,
        summary: combined.slice(-400).trim() || 'Antigravity execution error',
        harnessId: this.id,
        modelId,
        rawLog: combined.slice(-800)
      };
    }
  }
}
