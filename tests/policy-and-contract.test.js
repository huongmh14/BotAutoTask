import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { decide, isHardRefuseCommand } from '../src/core/policy.js';
import { CompletionContract } from '../src/core/completion-contract.js';
import { Harness2Engine, SURFACE_COMPONENTS } from '../src/core/harness2-engine.js';

test('Policy Engine enforces hard refuse, ask once, mode boundaries, and kill-switch', () => {
  // 1. Hard refuse is NEVER bypassed, even with YOLO and auto mode
  assert.equal(isHardRefuseCommand('rm -rf /'), true);
  assert.equal(decide({ mode: 'auto', yolo: true, command: 'rm -rf /' }), 'refused');
  assert.equal(decide({ mode: 'auto', yolo: true, path: '~/.ssh/id_rsa' }), 'refused');
  assert.equal(decide({ mode: 'auto', yolo: true, command: 'format c:' }), 'refused');

  // 2. Kill-switch fail-closed
  assert.equal(decide({ mode: 'auto', command: 'echo hello', killSwitch: true }), 'refused');
  assert.equal(decide({ mode: 'auto', command: 'echo hello', killSwitch: { isOn: false } }), 'refused');

  // 3. Ask once: destructive git commands
  assert.equal(decide({ mode: 'auto', yolo: false, command: 'git push --force' }), 'ask');
  assert.equal(decide({ mode: 'auto', yolo: true, command: 'git push --force' }), 'allow'); // YOLO auto allows ask-once
  assert.equal(decide({ mode: 'auto', yolo: false, command: 'git push --force', grants: ['git push --force'] }), 'allow');

  // 4. Plan mode is strictly read-only
  assert.equal(decide({ mode: 'plan', action: 'read', path: 'src/index.js' }), 'allow');
  assert.equal(decide({ mode: 'plan', action: 'write', path: 'src/index.js' }), 'ask');
  assert.equal(decide({ mode: 'plan', action: 'exec', command: 'npm test' }), 'ask');

  // 5. Default mode allows read/write but asks for shell execution
  assert.equal(decide({ mode: 'default', action: 'write', path: 'src/index.js' }), 'allow');
  assert.equal(decide({ mode: 'default', action: 'exec', command: 'npm test' }), 'ask');
});

test('CompletionContract enforces append-only, epoch invalidation, gap anti-loop, and no self-pass', () => {
  const contract = new CompletionContract({ goalId: 'goal-42' });

  // 1. Append-only up to 16
  contract.addCriterion({ id: 'c1', requirement: 'Must export decide function' });
  contract.addCriterion({ id: 'c2', requirement: 'Must pass unit tests' });
  assert.throws(() => contract.addCriterion({ id: 'c1', requirement: 'Duplicate' }));

  // 2. No acceptance and no criteria -> outcome_unverified
  const emptyContract = new CompletionContract({ goalId: 'empty' });
  const emptyEval = emptyContract.evaluate();
  assert.equal(emptyEval.verdict, 'outcome_unverified');

  // 3. Mutation epoch mismatch -> validation_missing
  const epochA = CompletionContract.calculateMutationEpoch('diff-content-A');
  const epochB = CompletionContract.calculateMutationEpoch('diff-content-B');
  const missingEval = contract.evaluate({
    results: {
      c1: { passed: true, epoch: epochA },
      c2: { passed: true, epoch: epochA }
    },
    currentMutationEpoch: epochB // code changed!
  });
  assert.equal(missingEval.verdict, 'validation_missing');

  // 4. Gap signature anti-loop detection
  const gap1 = contract.recordStepGap(['c2'], epochA);
  assert.equal(gap1.status, 'PROGRESSING');

  const gap2 = contract.recordStepGap(['c2'], epochA);
  assert.equal(gap2.status, 'SWAP_CORE'); // 2 consecutive identical failures

  const gap3 = contract.recordStepGap(['c2'], epochA);
  assert.equal(gap3.status, 'STALLED'); // 3 consecutive identical failures
});

test('Harness2Engine validates paths, budget, autotriggers, and experience library triples', (t) => {
  const tempDir = join(tmpdir(), `harness2-test-${Date.now()}`);
  t.after(() => {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  const engine = new Harness2Engine({ workspaceDir: tempDir, alwaysOnMaxChars: 1000 });

  // 1. Path safety
  assert.equal(engine.validatePath('skills/cleaner/SKILL.md'), true);
  assert.equal(engine.validatePath('../escape.txt'), false);
  assert.equal(engine.validatePath('/etc/passwd'), false);

  // 2. Autotrigger generation
  const triggers = engine.generateAutotriggers([
    { name: 'csv-cleaner', description: 'Cleans messy CSV tables' },
    { name: 'sql-opt', description: 'Optimizes slow queries' }
  ]);
  assert.match(triggers, /When Cleans messy CSV tables, load the csv-cleaner skill/);
  assert.match(triggers, /When Optimizes slow queries, load the sql-opt skill/);

  // 3. Context budget
  const budgetOk = engine.validateContextBudget({
    [SURFACE_COMPONENTS.C1_SYSTEM_PROMPT]: 'Short prompt',
    [SURFACE_COMPONENTS.C2_GUARDRAILS]: 'Be safe'
  });
  assert.equal(budgetOk.valid, true);

  // 4. Experience Library R: { cue, lesson, evidence }
  const saved = engine.saveExperience({
    domain: 'data-processing',
    name: 'csv-audit',
    cue: 'Excel files with formula sums',
    lesson: 'Opening workbook directly verifies written formulas',
    evidence: 'Saved file was tested with verify_workbook.py and caught empty sum'
  });
  assert.equal(saved.saved, true);

  const loaded = engine.loadExperiences('data-processing');
  assert.equal(loaded.length, 1);
  assert.match(loaded[0], /EXPERIENCE ENTRY: csv-audit/);
  assert.match(loaded[0], /Cue:.*Excel files/);
});
