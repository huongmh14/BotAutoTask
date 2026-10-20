import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { OUTCOME, parseStepTags } from './types.js';
import { findLatestAntigravityTranscript, writeIdeDirectiveBridge } from './log-reader.js';
import { runCliProcess } from './spawn-cli.js';

const execFileAsync = promisify(execFile);

/**
 * Strategy 1 + 2 + 4: Supervisor <-> IDE Worker Loop.
 * - Uses a fast, free Supervisor model (e.g. `opencode/deepseek-v4.1-flash-free` or `openai/gpt-5.6-luna`)
 *   to read the IDE Worker's logs (`transcript.jsonl`, JSON event stream, `git diff`, test output).
 * - Evaluates whether the goal is met or generates a concise, surgical next directive for the IDE Worker,
 *   saving ~80% of the IDE's context tokens.
 */
export class SupervisorLoop {
  constructor({
    workerHarness,
    workerModelId = 'auto',
    supervisorModelId = 'opencode/deepseek-v4.1-flash-free',
    supervisorBinary = 'opencode',
    supervisorDecideFn = null,
    writeDirectiveBridge = true,
    onNotify = null
  } = {}) {
    this.workerHarness = workerHarness;
    this.workerModelId = workerModelId;
    this.supervisorModelId = supervisorModelId;
    this.supervisorBinary = supervisorBinary;
    this.supervisorDecideFn = supervisorDecideFn;
    this.writeDirectiveBridge = writeDirectiveBridge;
    this.onNotify = onNotify;
  }

  async _notify(msg) {
    if (this.onNotify) await this.onNotify(msg);
  }

  async _collectWorkspaceEvidence(workspaceDir, acceptanceCmd = null) {
    let gitStatus = '';
    let gitDiffStat = '';
    let testOutput = '';
    let testPassed = null;

    try {
      const { stdout: st } = await execFileAsync('git', ['status', '--short'], {
        cwd: workspaceDir,
        windowsHide: true
      });
      gitStatus = st.trim();
      const { stdout: df } = await execFileAsync('git', ['diff', '--stat'], {
        cwd: workspaceDir,
        windowsHide: true
      });
      gitDiffStat = df.trim();
    } catch {}

    if (acceptanceCmd) {
      try {
        const { stdout, stderr } = await execFileAsync(acceptanceCmd, [], {
          cwd: workspaceDir,
          shell: true,
          timeout: 120_000,
          windowsHide: true
        });
        testPassed = true;
        testOutput = `${stdout || ''}\n${stderr || ''}`.slice(-600).trim();
      } catch (err) {
        testPassed = false;
        testOutput = `${err.stdout || ''}\n${err.stderr || ''}\n${err.message || ''}`.slice(-600).trim();
      }
    }

    const agyTranscript = findLatestAntigravityTranscript();
    return {
      gitStatus,
      gitDiffStat,
      testPassed,
      testOutput,
      antigravityLatest: agyTranscript?.summary || null
    };
  }

  /**
   * Calls the lightweight free Supervisor model to analyze Worker logs & evidence
   * and formulate the exact next directive for the IDE Worker.
   */
  async _defaultSupervisorDecide({ originalGoal, lastWorkerReceipt, evidence, journal, stepNumber }) {
    // If the Worker already declared completion AND acceptance test passed (or no acceptance test), we're done!
    if (
      lastWorkerReceipt.outcome === OUTCOME.GOAL_COMPLETED &&
      (evidence.testPassed === true || evidence.testPassed === null)
    ) {
      return {
        completed: true,
        nextDirective: '',
        reasoning: 'Worker declared completion and acceptance check passed.'
      };
    }

    const supervisorPrompt = [
      `You are the Supervisor Agent controlling a coding IDE Worker.`,
      `ORIGINAL TARGET GOAL: ${originalGoal.target_prompt}`,
      `STEP NUMBER JUST FINISHED: ${stepNumber}`,
      `WORKER SUMMARY: ${lastWorkerReceipt.summary}`,
      `WORKER LOG / TOOL CALLS: ${(lastWorkerReceipt.rawLog || '').slice(-800)}`,
      evidence.gitStatus ? `GIT STATUS:\n${evidence.gitStatus}` : '',
      evidence.testOutput
        ? `VERIFICATION / TEST OUTPUT (passed=${evidence.testPassed}):\n${evidence.testOutput}`
        : '',
      evidence.antigravityLatest?.lastAgentResponse
        ? `LATEST ANTIGRAVITY IDE TRANSCRIPT:\n${evidence.antigravityLatest.lastAgentResponse.slice(-400)}`
        : '',
      '',
      `Decide the next action:`,
      `- If the ORIGINAL TARGET GOAL is 100% complete and verified, output <SUPERVISOR_DECISION>COMPLETED</SUPERVISOR_DECISION>.`,
      `- Otherwise, output a concise, surgical instruction for the IDE Worker's next step inside <NEXT_DIRECTIVE>...</NEXT_DIRECTIVE> and brief reason inside <REASONING>...</REASONING>.`
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const { stdout } = await runCliProcess(
        this.supervisorBinary,
        ['run', '-m', this.supervisorModelId, supervisorPrompt],
        { timeoutMs: 90_000 }
      );
      const isDone = /<SUPERVISOR_DECISION>\s*COMPLETED\s*<\/SUPERVISOR_DECISION>/i.test(stdout);
      const dirMatch = stdout.match(/<NEXT_DIRECTIVE>([\s\S]*?)<\/NEXT_DIRECTIVE>/i);
      const reasonMatch = stdout.match(/<REASONING>([\s\S]*?)<\/REASONING>/i);

      return {
        completed: isDone,
        nextDirective: dirMatch ? dirMatch[1].trim() : `Continue working on: ${originalGoal.target_prompt}`,
        reasoning: reasonMatch ? reasonMatch[1].trim() : parseStepTags(stdout).summary
      };
    } catch {
      // Deterministic fallback if supervisor CLI is busy/offline
      const fallbackDirective =
        evidence.testPassed === false
          ? `Fix the failing verification check:\n${evidence.testOutput}\nWhile completing: ${originalGoal.target_prompt}`
          : `Continue from previous step (${lastWorkerReceipt.summary}) to finish: ${originalGoal.target_prompt}`;
      return {
        completed: false,
        nextDirective: fallbackDirective,
        reasoning: 'Generated via deterministic log/test analyzer fallback.'
      };
    }
  }

  /**
   * Executes the closed-loop Supervisor <-> IDE Worker cycle until goal completion.
   */
  async runSupervisedGoal(goal) {
    const workspaceDir = goal.repo_path || process.cwd();
    const maxSteps = goal.max_steps ?? 10;
    const journal = [];
    let currentDirective = goal.target_prompt;

    for (let stepNumber = 1; stepNumber <= maxSteps; stepNumber++) {
      if (this.writeDirectiveBridge) {
        writeIdeDirectiveBridge(workspaceDir, {
          goalId: goal.id,
          stepNumber,
          directive: currentDirective,
          reasoning: stepNumber === 1 ? 'Initial target goal' : 'Supervisor follow-up directive'
        });
      }

      await this._notify(`🎯 [Step ${stepNumber}] Sending directive to IDE Worker (${this.workerHarness.id}): ${currentDirective}`);

      const stepGoal = {
        ...goal,
        target_prompt: currentDirective
      };

      const receipt = await this.workerHarness.executeStep({
        goal: stepGoal,
        journal,
        workspaceDir,
        modelId: this.workerModelId
      });

      const evidence = await this._collectWorkspaceEvidence(workspaceDir, goal.acceptance_cmd);

      // If Worker already completed and acceptance check passed, finish immediately
      if (
        receipt.outcome === OUTCOME.GOAL_COMPLETED &&
        (evidence.testPassed === true || evidence.testPassed === null)
      ) {
        journal.push({
          goal_id: goal.id,
          step_number: stepNumber,
          core_used: this.workerHarness.id,
          model_used: this.workerModelId,
          outcome: OUTCOME.GOAL_COMPLETED,
          summary: receipt.summary,
          directive_sent: currentDirective
        });
        // testPassed === null (không có acceptance_cmd) → không tự cho "đạt" (Spec 08 A2)
        const finalStatus = evidence.testPassed === true ? 'COMPLETED' : 'COMPLETED_UNVERIFIED';
        await this._notify(
          finalStatus === 'COMPLETED'
            ? `✅ [Supervisor] Goal completed in ${stepNumber} step(s): ${receipt.summary}`
            : `🟡 [Supervisor] Goal completed in ${stepNumber} step(s) but CHƯA kiểm chứng (thiếu acceptance_cmd): ${receipt.summary}`
        );
        return { status: finalStatus, stepsRun: stepNumber, journal };
      }

      const decideFn = this.supervisorDecideFn || this._defaultSupervisorDecide.bind(this);
      const decision = await decideFn({
        originalGoal: goal,
        lastWorkerReceipt: receipt,
        evidence,
        journal,
        stepNumber
      });

      journal.push({
        goal_id: goal.id,
        step_number: stepNumber,
        core_used: this.workerHarness.id,
        model_used: this.workerModelId,
        outcome: decision.completed ? OUTCOME.GOAL_COMPLETED : receipt.outcome,
        summary: receipt.summary,
        supervisor_reasoning: decision.reasoning,
        next_directive: decision.nextDirective
      });

      if (decision.completed) {
        // Chỉ COMPLETED khi có bằng chứng test pass; thiếu check → COMPLETED_UNVERIFIED (Spec 08 A2)
        const finalStatus = evidence.testPassed === true ? 'COMPLETED' : 'COMPLETED_UNVERIFIED';
        await this._notify(
          finalStatus === 'COMPLETED'
            ? `✅ [Supervisor] Verified goal completion at step ${stepNumber}.`
            : `🟡 [Supervisor] Goal finished at step ${stepNumber} nhưng CHƯA kiểm chứng (thiếu acceptance_cmd).`
        );
        return { status: finalStatus, stepsRun: stepNumber, journal };
      }

      currentDirective = decision.nextDirective;
      await this._notify(`🧠 [Supervisor Analysis] ${decision.reasoning}\n👉 Next Directive: ${currentDirective}`);
    }

    return { status: 'MAX_STEPS_REACHED', stepsRun: maxSteps, journal };
  }
}
