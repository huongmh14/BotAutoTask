import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAntigravityTranscript,
  parseOpenCodeJsonStream
} from '../src/core/log-reader.js';
import { SupervisorLoop } from '../src/core/supervisor.js';

test('parseAntigravityTranscript extracts latest response, tool calls, and status from transcript.jsonl', () => {
  const sampleJsonl = [
    JSON.stringify({
      step_index: 1,
      source: 'USER_EXPLICIT',
      type: 'USER_INPUT',
      status: 'DONE',
      content: 'Fix the login bug in auth.js'
    }),
    JSON.stringify({
      step_index: 2,
      source: 'MODEL',
      type: 'PLANNER_RESPONSE',
      status: 'DONE',
      thinking: 'Checking auth.js line 42',
      tool_calls: [
        { name: 'replace_file_content', args: { TargetFile: 'src/auth.js' } },
        { name: 'run_command', args: { CommandLine: 'npm test' } }
      ],
      content: 'Updated src/auth.js, but 1 test in session.test.js is still failing.'
    })
  ].join('\n');

  const summary = parseAntigravityTranscript(sampleJsonl);
  assert.equal(summary.lastStatus, 'DONE');
  assert.equal(summary.lastUserPrompt, 'Fix the login bug in auth.js');
  assert.match(summary.lastAgentResponse, /1 test in session\.test\.js is still failing/);
  assert.deepEqual(summary.toolCalls, ['replace_file_content(src/auth.js)', 'run_command(npm test)']);
  assert.equal(summary.hasError, false);
});

test('parseOpenCodeJsonStream parses opencode run --format json NDJSON events and session ID', () => {
  const ndjson = [
    JSON.stringify({ type: 'session.start', sessionID: 'ses_abc123' }),
    JSON.stringify({ type: 'tool.call', tool: 'edit', input: { filePath: 'src/index.js' } }),
    JSON.stringify({ type: 'message.part', text: 'Added export to src/index.js.\n' }),
    JSON.stringify({ type: 'message.part', text: '<OMNIGOAL_SUMMARY>Exported handler</OMNIGOAL_SUMMARY>' })
  ].join('\n');

  const parsed = parseOpenCodeJsonStream(ndjson);
  assert.equal(parsed.sessionId, 'ses_abc123');
  assert.deepEqual(parsed.toolCalls, ['edit(src/index.js)']);
  assert.match(parsed.textOutput, /Added export to src\/index\.js/);
});

test('SupervisorLoop reads worker logs/results, generates targeted next directive, and completes goal', async () => {
  const directivesReceivedByWorker = [];

  // Mock IDE Worker (e.g., Antigravity or OpenCode Sonnet)
  const mockWorkerHarness = {
    id: 'ide-worker',
    async executeStep({ goal }) {
      directivesReceivedByWorker.push(goal.target_prompt);
      if (directivesReceivedByWorker.length === 1) {
        return {
          outcome: 'STEP_DONE',
          summary: 'Created src/math.js with add(), forgot subtract()',
          harnessId: 'ide-worker',
          modelId: 'freemodel/claude-sonnet-4-6',
          rawLog: 'Tool: write_to_file(src/math.js)\nTest output: Error: subtract is not exported'
        };
      }
      return {
        outcome: 'GOAL_COMPLETED',
        summary: 'Added subtract() to src/math.js and all tests pass',
        harnessId: 'ide-worker',
        modelId: 'freemodel/claude-sonnet-4-6',
        rawLog: 'Tool: replace_file_content(src/math.js)\nPASS: 2/2 tests'
      };
    }
  };

  // Mock Supervisor Agent (lightweight free model that reads logs and issues next directive)
  const mockSupervisorDecide = async ({ originalGoal, lastWorkerReceipt, stepNumber }) => {
    assert.equal(stepNumber, 1);
    assert.match(lastWorkerReceipt.rawLog, /subtract is not exported/);
    return {
      completed: false,
      nextDirective:
        'In src/math.js, export function subtract(a, b) to fix "Error: subtract is not exported", then run tests.',
      reasoning: 'Worker created add() but test log shows subtract() is missing.'
    };
  };

  const loop = new SupervisorLoop({
    workerHarness: mockWorkerHarness,
    workerModelId: 'freemodel/claude-sonnet-4-6',
    supervisorDecideFn: mockSupervisorDecide,
    writeDirectiveBridge: false
  });

  const result = await loop.runSupervisedGoal({
    id: 'sup-goal-1',
    title: 'Implement math module',
    target_prompt: 'Create src/math.js with add and subtract functions',
    max_steps: 4
  });

  assert.equal(result.status, 'COMPLETED');
  assert.equal(result.stepsRun, 2);
  assert.equal(directivesReceivedByWorker.length, 2);
  assert.match(directivesReceivedByWorker[1], /export function subtract/);
});
