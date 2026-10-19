/**
 * Persistent per-core usage & rate-limit statistics (Orca-style usage tracking).
 * Counts every harness step outcome so the dashboard can show runs, 429 hits,
 * errors and completion counts per AI core across sessions.
 */

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { atomicWriteJsonSync } from './atomic-write.js';

const OUTCOME_WEIGHTS = Object.freeze({
  RATE_LIMITED: 'rateLimited',
  ERROR: 'errors'
});

export class CoreStatsStore {
  constructor(filePath = join(homedir(), '.botautotask', 'core-stats.json')) {
    this.filePath = filePath;
    this.data = { cores: {}, updatedAt: null };
    this._load();
  }

  _load() {
    try {
      if (existsSync(this.filePath)) {
        const parsed = JSON.parse(readFileSync(this.filePath, 'utf8'));
        if (parsed && typeof parsed === 'object' && typeof parsed.cores === 'object') {
          this.data = parsed;
        }
      }
    } catch {
      // Corrupt stats must never break execution — start fresh.
    }
  }

  _save() {
    this.data.updatedAt = Date.now();
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      atomicWriteJsonSync(this.filePath, this.data);
    } catch {
      // Best-effort persistence.
    }
  }

  _entry(harnessId) {
    if (!this.data.cores[harnessId]) {
      this.data.cores[harnessId] = {
        runs: 0,
        rateLimited: 0,
        errors: 0,
        goalCompleted: 0,
        lastModelId: null,
        lastOutcome: null,
        lastUsedAt: null
      };
    }
    return this.data.cores[harnessId];
  }

  /**
   * Records one harness step outcome. Never throws.
   * @param {string} harnessId
   * @param {string} modelId
   * @param {string} outcome One of OUTCOME values
   */
  record(harnessId, modelId = null, outcome = null) {
    try {
      const e = this._entry(harnessId);
      e.runs += 1;
      e.lastModelId = modelId || e.lastModelId;
      e.lastOutcome = outcome || e.lastOutcome;
      e.lastUsedAt = Date.now();
      if (OUTCOME_WEIGHTS[outcome]) e[OUTCOME_WEIGHTS[outcome]] += 1;
      if (outcome === 'GOAL_COMPLETED') e.goalCompleted += 1;
      this._save();
      return e;
    } catch {
      return null;
    }
  }

  snapshot() {
    return JSON.parse(JSON.stringify(this.data.cores));
  }
}
