import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatGoalNotification, sendMobileNotification } from '../src/daemon/mobile-notify.js';

test('[CLOUD-AC04] formatGoalNotification correctly formats started, progress, rate-limited, and completion', () => {
  const goal = { id: 'goal-123', target_prompt: 'Fix login security vulnerability', title: 'Fix login' };

  // Goal started
  const startNotif = formatGoalNotification({ goal, dashboardUrl: 'https://example.com/pwa' });
  assert.equal(startNotif.title, '🎯 Goal Started: goal-123');
  assert.equal(startNotif.message, 'Fix login security vulnerability');
  assert.equal(startNotif.clickUrl, 'https://example.com/pwa');

  // Rate limited
  const rateLimitNotif = formatGoalNotification({
    goal,
    entry: {
      step_number: 2,
      core_used: 'opencode',
      model_used: 'deepseek-v4.1-flash-free',
      outcome: 'RATE_LIMITED',
      summary: '429 rate limit hit'
    }
  });
  assert.match(rateLimitNotif.title, /Rate Limit/);
  assert.match(rateLimitNotif.message, /auto-swapping/);
  assert.deepEqual(rateLimitNotif.tags, ['warning', 'arrows_counterclockwise']);

  // Goal completed
  const completeNotif = formatGoalNotification({
    goal,
    entry: {
      step_number: 3,
      core_used: 'antigravity',
      model_used: 'gemini-2.5-pro',
      outcome: 'GOAL_COMPLETED',
      summary: 'Tests passed and commit created'
    }
  });
  assert.match(completeNotif.title, /Goal Completed/);
  assert.equal(completeNotif.message, 'Tests passed and commit created');
  assert.equal(completeNotif.priority, 4);
});

test('[CLOUD-AC04] sendMobileNotification formats request and calls fetch correctly', async () => {
  let capturedUrl = '';
  let capturedOptions = {};

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return { ok: true, status: 200 };
  };

  try {
    const res = await sendMobileNotification({
      title: 'Alert Title',
      message: 'Alert Body',
      priority: 4,
      tags: ['gear', 'warning'],
      clickUrl: 'https://my-dashboard.com',
      actions: [{ action: 'view', label: 'Open PWA', url: 'https://my-dashboard.com' }],
      config: {
        server: 'https://ntfy.sh',
        topic: 'botautotask-test-topic',
        token: 'secret-ntfy-token'
      }
    });

    assert.equal(res.sent, true);
    assert.equal(capturedUrl, 'https://ntfy.sh/botautotask-test-topic');
    assert.equal(capturedOptions.headers.Title, 'Alert Title');
    assert.equal(capturedOptions.headers.Priority, '4');
    assert.equal(capturedOptions.headers.Tags, 'gear,warning');
    assert.equal(capturedOptions.headers.Click, 'https://my-dashboard.com');
    assert.equal(capturedOptions.headers.Authorization, 'Bearer secret-ntfy-token');
    assert.equal(capturedOptions.headers.Actions, 'view, Open PWA, https://my-dashboard.com');
    assert.equal(capturedOptions.body, 'Alert Body');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
