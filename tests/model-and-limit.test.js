import test from 'node:test';
import assert from 'node:assert/strict';
import { isRateLimitError } from '../src/core/rate-limit-detector.js';
import { parseStepTags } from '../src/core/types.js';
import { FreeModelRanker } from '../src/core/model-discovery.js';

test('isRateLimitError detects 429, quota, and usage limits', () => {
  assert.equal(isRateLimitError('Error: HTTP 429 Too Many Requests', 1), true);
  assert.equal(isRateLimitError('You have exceeded your usage limit until 5pm', 1), true);
  assert.equal(isRateLimitError('resource_exhausted: quota exceeded for model', 1), true);
  assert.equal(isRateLimitError('SyntaxError: Unexpected token', 1), false);
});

test('parseStepTags extracts status and falls back when tags are missing', () => {
  const tagged = parseStepTags(
    'Working...\n<OMNIGOAL_SUMMARY>Fixed auth bug</OMNIGOAL_SUMMARY>\n<OMNIGOAL_STATUS>COMPLETED</OMNIGOAL_STATUS>'
  );
  assert.equal(tagged.completed, true);
  assert.equal(tagged.summary, 'Fixed auth bug');

  const untagged = parseStepTags('Line 1\nRefactored login controller successfully.');
  assert.equal(untagged.completed, false);
  assert.match(untagged.summary, /Refactored login controller/);
});

test('FreeModelRanker prioritizes deepseek-v4.1-flash-free and gpt-luna and respects cooldowns', () => {
  const ranker = new FreeModelRanker({
    priorityModels: ['deepseek-v4.1-flash-free', 'gpt-luna', 'google/gemini-2.5-pro']
  });
  const candidates = [
    { harnessId: 'opencode', modelId: 'openrouter/qwen/qwen-2.5-coder:free', isFree: true },
    { harnessId: 'opencode', modelId: 'opencode/gpt-luna', isFree: true },
    { harnessId: 'opencode', modelId: 'opencode/deepseek-v4.1-flash-free', isFree: true }
  ];
  const ranked = ranker.rankCandidates(candidates);
  assert.equal(ranked[0].modelId, 'opencode/deepseek-v4.1-flash-free');
  assert.equal(ranked[1].modelId, 'opencode/gpt-luna');

  ranker.markCooldown('opencode', 'opencode/deepseek-v4.1-flash-free', 60_000);
  const afterCooldown = ranker.rankCandidates(candidates);
  assert.equal(afterCooldown[0].modelId, 'opencode/gpt-luna');
});
