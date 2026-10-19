/**
 * Core contracts and output tag parser for BotAutoTask.
 * Keeps Orchestrator completely decoupled from individual AI Harnesses.
 */

export const OUTCOME = Object.freeze({
  STEP_DONE: 'STEP_DONE',
  GOAL_COMPLETED: 'GOAL_COMPLETED',
  RATE_LIMITED: 'RATE_LIMITED',
  ERROR: 'ERROR'
});

/**
 * Extracts <OMNIGOAL_STATUS> and <OMNIGOAL_SUMMARY> tags from agent CLI output.
 * Gracefully falls back to trailing non-empty lines if the agent didn't print XML tags.
 * @param {string} stdout
 * @returns {{ completed: boolean, summary: string }}
 */
export function parseStepTags(stdout = '') {
  const text = String(stdout || '');
  const statusMatch = text.match(/<OMNIGOAL_STATUS>\s*(COMPLETED|DONE)\s*<\/OMNIGOAL_STATUS>/i);
  const summaryMatch = text.match(/<OMNIGOAL_SUMMARY>([\s\S]*?)<\/OMNIGOAL_SUMMARY>/i);

  const completed = Boolean(statusMatch);
  if (summaryMatch && summaryMatch[1].trim()) {
    return {
      completed,
      summary: summaryMatch[1].trim()
    };
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('<OMNIGOAL_'));

  const fallbackSummary = lines.slice(-3).join(' | ').slice(0, 500) || 'Step executed without output summary.';
  return {
    completed,
    summary: fallbackSummary
  };
}

/**
 * Builds a self-contained handover prompt so any core (OpenCode, Antigravity, Claude, Neko Core, or custom)
 * can pick up seamlessly from previous steps in the journal.
 */
export function buildHandoverPrompt(goal, journal = []) {
  const historyLines =
    journal.length === 0
      ? 'No previous steps executed yet.'
      : journal
          .slice(-8)
          .map(
            (entry, idx) =>
              `Step ${entry.step_number ?? idx + 1} [${entry.core_used || entry.harnessId}/${entry.model_used || entry.modelId} -> ${entry.outcome}]: ${entry.summary}`
          )
          .join('\n');

  const acceptance = goal.acceptance_cmd
    ? `\nAcceptance Verification Command: \`${goal.acceptance_cmd}\` (run this to verify before declaring completion).`
    : '';

  return [
    `# TARGET GOAL: ${goal.title || goal.id}`,
    goal.target_prompt,
    acceptance,
    `\n## DURABLE JOURNAL (Previous Cores' Progress):`,
    historyLines,
    `\n## INSTRUCTIONS FOR THIS STEP:`,
    `1. Continue from the journal state above without redoing completed work.`,
    `2. Make concrete progress in the workspace and verify your changes.`,
    `3. At the end of your response, always output:`,
    `   <OMNIGOAL_SUMMARY>1-2 sentence summary of what you achieved in this step</OMNIGOAL_SUMMARY>`,
    `4. ONLY if the entire TARGET GOAL is 100% finished and verified, also output:`,
    `   <OMNIGOAL_STATUS>COMPLETED</OMNIGOAL_STATUS>`
  ].join('\n');
}
