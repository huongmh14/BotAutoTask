import { CustomCmdHarness } from '../harnesses/custom-cmd-harness.js';

/**
 * Hexagonal Registry of AI Harnesses (Cores).
 * Decouples the Orchestrator from specific AI implementations:
 * You can register, unregister, or hot-swap Neko Core, OpenCode, Antigravity, Claude,
 * or any future custom AI core via code or JSON config.
 */
export class HarnessRegistry {
  constructor() {
    this.harnesses = new Map();
  }

  register(harness) {
    if (!harness || !harness.id) {
      throw new Error('Harness must have an id property');
    }
    this.harnesses.set(harness.id, harness);
  }

  unregister(harnessId) {
    this.harnesses.delete(harnessId);
  }

  get(harnessId) {
    return this.harnesses.get(harnessId);
  }

  list() {
    return Array.from(this.harnesses.values());
  }

  /**
   * Registers or replaces harnesses defined in JSON config (`customHarnesses`).
   */
  registerFromConfig(customConfigs = []) {
    for (const def of customConfigs) {
      if (def.enabled === false) continue;
      this.register(new CustomCmdHarness(def));
    }
  }

  /**
   * Queries all available harnesses, collects their free/idle models, and ranks them
   * via FreeModelRanker. If `preferredSpec` (e.g. "opencode:gpt-luna" or "claude") is given,
   * boosts matching candidates to the top.
   */
  async getCandidates(ranker, preferredSpec = 'auto') {
    const rawCandidates = [];

    for (const harness of this.harnesses.values()) {
      let available = false;
      try {
        available = await harness.isAvailable();
      } catch {
        available = false;
      }
      if (!available) continue;

      let models = [];
      try {
        models = await harness.discoverModels();
      } catch {
        models = [];
      }

      for (const m of models) {
        rawCandidates.push({
          harness,
          harnessId: harness.id,
          modelId: m.modelId,
          isFree: m.isFree ?? true
        });
      }
    }

    const ranked = ranker.rankCandidates(rawCandidates);

    if (preferredSpec && preferredSpec !== 'auto') {
      const specLower = preferredSpec.toLowerCase();
      ranked.sort((a, b) => {
        const aMatch =
          a.harnessId.toLowerCase() === specLower ||
          a.modelId.toLowerCase().includes(specLower) ||
          `${a.harnessId}:${a.modelId}`.toLowerCase().includes(specLower);
        const bMatch =
          b.harnessId.toLowerCase() === specLower ||
          b.modelId.toLowerCase().includes(specLower) ||
          `${b.harnessId}:${b.modelId}`.toLowerCase().includes(specLower);
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return b.score - a.score;
      });
    }

    return ranked;
  }
}
