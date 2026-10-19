import { OUTCOME, parseStepTags, buildHandoverPrompt } from '../core/types.js';
import { isRateLimitError } from '../core/rate-limit-detector.js';

/**
 * Pluggable Neko Core Runtime Harness (meiiie/neko-bot compatible HTTP/SSE local control plane).
 * Completely isolated in this adapter so you can swap or replace Neko Core with any future core at any time.
 */
export class NekoCoreHarness {
  constructor({ endpoint = 'http://127.0.0.1:19820/api/run', fetchFn = globalThis.fetch } = {}) {
    this.id = 'neko-core';
    this.endpoint = endpoint;
    this.fetchFn = fetchFn;
  }

  async isAvailable() {
    if (!this.fetchFn) return false;
    try {
      const healthUrl = this.endpoint.replace(/\/api\/run$/, '/api/health');
      const res = await this.fetchFn(healthUrl, { signal: AbortSignal.timeout(2500) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async discoverModels() {
    return [{ harnessId: this.id, modelId: 'neko-core-default', isFree: true }];
  }

  async executeStep({ goal, journal = [], workspaceDir = process.cwd(), modelId = 'neko-core-default' }) {
    const prompt = buildHandoverPrompt(goal, journal);
    try {
      const res = await this.fetchFn(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId: goal.id,
          prompt,
          workspaceDir,
          model: modelId
        }),
        signal: AbortSignal.timeout(10 * 60 * 1000)
      });
      const text = await res.text();
      if (!res.ok || isRateLimitError(text, res.status)) {
        return {
          outcome: res.status === 429 || isRateLimitError(text, res.status) ? OUTCOME.RATE_LIMITED : OUTCOME.ERROR,
          summary: text.slice(0, 400) || `Neko Core returned HTTP ${res.status}`,
          harnessId: this.id,
          modelId
        };
      }
      const parsed = parseStepTags(text);
      return {
        outcome: parsed.completed ? OUTCOME.GOAL_COMPLETED : OUTCOME.STEP_DONE,
        summary: parsed.summary,
        harnessId: this.id,
        modelId
      };
    } catch (err) {
      return {
        outcome: OUTCOME.ERROR,
        summary: err.message || 'Neko Core unreachable',
        harnessId: this.id,
        modelId
      };
    }
  }
}
