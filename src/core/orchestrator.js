import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import { OUTCOME } from './types.js';
import { Harness2Engine } from './harness2-engine.js';

const execFileAsync = promisify(execFile);

/**
 * Target-driven Goal Orchestrator.
 * Executes a goal across steps, automatically failing over to the next best free model/core
 * when rate limits hit, and persisting a durable journal of every step.
 */
export class GoalOrchestrator {
  constructor({ registry, ranker, onJournalEntry = null, onNotify = null, gitCheckpoint = false } = {}) {
    this.registry = registry;
    this.ranker = ranker;
    this.onJournalEntry = onJournalEntry;
    this.onNotify = onNotify;
    this.gitCheckpoint = gitCheckpoint;
    this.experience = null;
  }

  async _notify(msg) {
    if (this.onNotify) {
      await this.onNotify(msg);
    }
  }

  async _tryGitCheckpoint(workspaceDir, message) {
    if (!this.gitCheckpoint || !workspaceDir) return null;
    try {
      await execFileAsync('git', ['add', '-A'], { cwd: workspaceDir, windowsHide: true });
      await execFileAsync('git', ['commit', '-m', message], { cwd: workspaceDir, windowsHide: true });
      const { stdout } = await execFileAsync('git', ['rev-parse', '--short', 'HEAD'], {
        cwd: workspaceDir,
        windowsHide: true
      });
      return stdout.trim();
    } catch {
      return null;
    }
  }

  _getExperienceEngine(workspaceDir) {
    if (!this.experience) {
      this.experience = new Harness2Engine({ workspaceDir });
    }
    return this.experience;
  }

  async _verifyAcceptance(goal, workspaceDir) {
    if (!goal.acceptance_cmd) return { ok: true, verified: false, output: '' };
    const cwd = workspaceDir && existsSync(workspaceDir) ? workspaceDir : process.cwd();
    try {
      const { stdout, stderr } = await execFileAsync(goal.acceptance_cmd, [], {
        cwd,
        shell: true,
        timeout: 5 * 60 * 1000,
        windowsHide: true
      });
      return { ok: true, verified: true, output: `${stdout || ''}\n${stderr || ''}`.trim() };
    } catch (err) {
      return {
        ok: false,
        verified: false,
        output: `${err.stdout || ''}\n${err.stderr || ''}\n${err.message || ''}`.slice(-400).trim()
      };
    }
  }

  _saveVerifiedExperience(goal, journal, check) {
    // ponytail: lesson = last step summary, không chưng cất bằng LLM (harness2 selection.py).
    // Trần: bài học có thể dài/nhiễu. Nâng cấp: 1 lời gọi LLM rẻ trích <experience> cue/lesson/evidence.
    try {
      const engine = this._getExperienceEngine(goal.repo_path || process.cwd());
      const lastSummary = journal.length > 0 ? String(journal[journal.length - 1].summary || '') : '';
      engine.saveExperience({
        domain: goal.domain || 'general',
        name: goal.id,
        cue: goal.title || goal.id,
        lesson: lastSummary.slice(0, 400),
        evidence: `${goal.acceptance_cmd} → pass\n${String(check.output || '').slice(-300)}`
      });
    } catch {}
  }

  /**
   * Runs a Goal until GOAL_COMPLETED, max_steps reached, or all cores exhausted.
   */
  async runGoal(goal, existingJournal = []) {
    const journal = [...existingJournal];
    const maxSteps = goal.max_steps ?? 15;
    const workspaceDir = goal.repo_path || process.cwd();
    let stepNumber = goal.current_step ?? journal.length;

    // Harness² Experience Library: inject proven lessons from past verified goals
    try {
      const notes = this._getExperienceEngine(workspaceDir).loadExperiences(goal.domain || 'general');
      if (notes.length > 0 && !goal.experience_notes) {
        goal.experience_notes = notes.join('\n');
      }
    } catch {}

    while (stepNumber < maxSteps) {
      stepNumber += 1;
      const candidates = await this.registry.getCandidates(this.ranker, goal.preferred_core || 'auto');

      if (candidates.length === 0) {
        await this._notify(`⚠️ [${goal.title || goal.id}] All AI cores/models are currently on cooldown or unavailable.`);
        return { status: 'PAUSED_LIMIT', stepsRun: stepNumber - 1, journal };
      }

      let stepSucceeded = false;

      for (const candidate of candidates) {
        const { harness, modelId } = candidate;
        const receipt = await harness.executeStep({
          goal,
          journal,
          workspaceDir,
          modelId
        });

        const commitSha = await this._tryGitCheckpoint(
          workspaceDir,
          `chore(botautotask): step ${stepNumber} via ${harness.id}/${modelId}`
        );

        const entry = {
          goal_id: goal.id,
          step_number: stepNumber,
          core_used: harness.id,
          model_used: modelId,
          outcome: receipt.outcome,
          summary: receipt.summary,
          git_commit: commitSha,
          created_at: Date.now()
        };
        journal.push(entry);

        if (this.onJournalEntry) {
          await this.onJournalEntry(entry);
        }

        if (receipt.outcome === OUTCOME.RATE_LIMITED) {
          this.ranker.markCooldown(harness.id, modelId);
          await this._notify(
            `🔄 [${goal.title || goal.id}] Rate limit on ${harness.id}/${modelId}. Switching to next best free model...`
          );
          continue; // Immediately try next ranked candidate in the same step
        }

        if (receipt.outcome === OUTCOME.ERROR) {
          this.ranker.markCooldown(harness.id, modelId, 5 * 60 * 1000);
          await this._notify(
            `⚠️ [${goal.title || goal.id}] Error on ${harness.id}/${modelId}: ${receipt.summary}. Failing over...`
          );
          continue;
        }

        stepSucceeded = true;

        if (receipt.outcome === OUTCOME.GOAL_COMPLETED) {
          const check = await this._verifyAcceptance(goal, workspaceDir);
          if (check.ok) {
            if (check.verified === false) {
              // Không có acceptance_cmd → không tự cho "đạt" (Spec 08 A2, bỏ auto-pass)
              await this._notify(
                `🟡 [${goal.title || goal.id}] COMPLETED (UNVERIFIED) using ${harness.id}/${modelId}: ${receipt.summary} — thiếu acceptance_cmd nên chưa kiểm chứng.`
              );
              return { status: 'COMPLETED_UNVERIFIED', stepsRun: stepNumber, journal };
            }
            await this._notify(
              `✅ [${goal.title || goal.id}] COMPLETED using ${harness.id}/${modelId}: ${receipt.summary}`
            );
            this._saveVerifiedExperience(goal, journal, check);
            return { status: 'COMPLETED', stepsRun: stepNumber, journal };
          } else {
            journal.push({
              goal_id: goal.id,
              step_number: stepNumber,
              core_used: 'verifier',
              model_used: 'acceptance_cmd',
              outcome: OUTCOME.STEP_DONE,
              summary: `Acceptance check failed: ${check.output}`,
              created_at: Date.now()
            });
          }
        }

        break; // Move to next step
      }

      if (!stepSucceeded) {
        return { status: 'PAUSED_LIMIT', stepsRun: stepNumber, journal };
      }
    }

    return { status: 'MAX_STEPS_REACHED', stepsRun: stepNumber, journal };
  }
}
