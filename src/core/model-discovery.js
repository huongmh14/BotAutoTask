import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Dynamic Free-Model Discovery & Ranker.
 * Discovers free/idle models from OpenCode CLI (`opencode models`), OpenRouter public API,
 * and registered harnesses, then scores them so the strongest free models (e.g. deepseek-v4.1-flash-free,
 * gpt-luna, gemini-2.5-pro, deepseek-r1:free, qwen-coder:free) are always chosen first.
 */
export class FreeModelRanker {
  constructor(config = {}, options = {}) {
    this.priorityModels = config.priorityModels || [
      'deepseek-v4.1-flash-free',
      'gpt-luna',
      'opencode/deepseek-v4.1-flash-free',
      'opencode/gpt-luna',
      'google/gemini-2.5-pro',
      'google/gemini-2.5-flash'
    ];
    this.defaultCooldownMs = config.cooldownMs ?? 30 * 60 * 1000;
    this.cooldowns = new Map(); // key: `${harnessId}:${modelId}` -> expiresAtMs
    this.execFn = options.execFn || execFileAsync;
    this.fetchFn = options.fetchFn || globalThis.fetch;
  }

  _key(harnessId, modelId) {
    return `${harnessId}:${modelId}`;
  }

  markCooldown(harnessId, modelId, durationMs = this.defaultCooldownMs, nowMs = Date.now()) {
    this.cooldowns.set(this._key(harnessId, modelId), nowMs + durationMs);
  }

  isCoolingDown(harnessId, modelId, nowMs = Date.now()) {
    const expires = this.cooldowns.get(this._key(harnessId, modelId));
    if (!expires) return false;
    if (nowMs >= expires) {
      this.cooldowns.delete(this._key(harnessId, modelId));
      return false;
    }
    return true;
  }

  /**
   * Computes a priority score for a model ID. Higher = preferred earlier.
   * @param {string} modelId
   * @param {boolean} [isFree=true]
   * @returns {number}
   */
  scoreModelId(modelId = '', isFree = true) {
    const id = String(modelId).toLowerCase();
    let score = isFree ? 100 : 20;

    // Check explicit priority list in order (top item gets highest bonus)
    for (let i = 0; i < this.priorityModels.length; i++) {
      const target = this.priorityModels[i].toLowerCase();
      if (id === target || id.endsWith('/' + target) || id.includes(target)) {
        score += 1000 - i * 40;
        break;
      }
    }

    // Heuristic boosts for top free coding & reasoning models
    if (id.includes('deepseek') && id.includes('v4')) score += 300;
    if (id.includes('gpt-luna') || id.includes('luna')) score += 280;
    if (id.includes('free')) score += 150;
    if (id.includes('coder') || id.includes('codex') || id.includes('claude')) score += 100;
    if (id.includes('gemini-2.5-pro')) score += 90;
    if (id.includes('r1') || id.includes('flash')) score += 60;

    return score;
  }

  /**
   * Filters out cooling-down models and ranks available candidates highest-first.
   */
  rankCandidates(candidates = [], nowMs = Date.now()) {
    return candidates
      .filter((c) => !this.isCoolingDown(c.harnessId, c.modelId, nowMs))
      .map((c) => ({
        ...c,
        score: this.scoreModelId(c.modelId, c.isFree ?? true)
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Queries `opencode models` CLI to discover locally available free/configured models.
   */
  async discoverOpenCodeCliModels(binary = 'opencode') {
    try {
      const { stdout } = await this.execFn(binary, ['models'], { timeout: 8000, windowsHide: true });
      const lines = String(stdout || '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('Available') && !l.startsWith('---'));

      return lines.map((modelId) => ({
        harnessId: 'opencode',
        modelId,
        isFree: /free|opencode\/|luna|pickle|grok|gemini/i.test(modelId)
      }));
    } catch {
      // Fallback to well-known free OpenCode models when CLI is not yet installed or fails
      return [
        { harnessId: 'opencode', modelId: 'opencode/deepseek-v4.1-flash-free', isFree: true },
        { harnessId: 'opencode', modelId: 'opencode/gpt-luna', isFree: true },
        { harnessId: 'opencode', modelId: 'opencode/grok-code', isFree: true },
        { harnessId: 'opencode', modelId: 'opencode/big-pickle', isFree: true },
        { harnessId: 'opencode', modelId: 'google/gemini-2.5-pro', isFree: true },
        { harnessId: 'opencode', modelId: 'google/gemini-2.5-flash', isFree: true }
      ];
    }
  }

  /**
   * Queries OpenRouter public catalog for 100% free models (pricing.prompt === "0").
   */
  async discoverOpenRouterFreeModels() {
    if (!this.fetchFn) return [];
    try {
      const res = await this.fetchFn('https://openrouter.ai/api/v1/models', {
        signal: AbortSignal.timeout(6000)
      });
      if (!res.ok) return [];
      const data = await res.json();
      const models = Array.isArray(data?.data) ? data.data : [];
      return models
        .filter(
          (m) =>
            String(m?.pricing?.prompt) === '0' &&
            String(m?.pricing?.completion) === '0' &&
            (m?.context_length ?? 0) >= 32000
        )
        .slice(0, 15)
        .map((m) => ({
          harnessId: 'opencode',
          modelId: `openrouter/${m.id}`,
          isFree: true
        }));
    } catch {
      return [];
    }
  }
}
