import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalWebUiServer } from '../src/daemon/web-ui.js';

test('LocalWebUiServer serves HTML, enforces auth and DNS-rebinding checks, and handles idempotent nonces', async () => {
  const ui = new LocalWebUiServer({ port: 0 });
  await ui.start();

  try {
    const baseUrl = `http://127.0.0.1:${ui.port}`;

    // 1. GET / serves dashboard HTML without auth
    const htmlRes = await fetch(`${baseUrl}/`);
    assert.equal(htmlRes.status, 200);
    const html = await htmlRes.text();
    assert.match(html, /BotAutoTask/);

    // 2. GET /api/state rejects unauthorized requests
    const unauthRes = await fetch(`${baseUrl}/api/state`);
    assert.equal(unauthRes.status, 401);

    // 3. GET /api/state accepts valid Bearer token
    const authRes = await fetch(`${baseUrl}/api/state`, {
      headers: { Authorization: `Bearer ${ui.token}` }
    });
    assert.equal(authRes.status, 200);
    const state = await authRes.json();
    assert.ok(Array.isArray(state.agents));

    // 4. DNS-rebinding / CSRF protection: Origin: http://attacker.com returns 403
    const rebindingRes = await fetch(`${baseUrl}/api/state`, {
      headers: {
        Origin: 'http://attacker.com',
        Authorization: `Bearer ${ui.token}`
      }
    });
    assert.equal(rebindingRes.status, 403);

    // 5. Idempotent nonce: sending same nonce returns duplicate
    const nonce = `test-nonce-${Date.now()}`;
    const msgRes1 = await fetch(`${baseUrl}/api/agents/coder/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ui.token}`
      },
      body: JSON.stringify({ nonce, text: 'Fix bug' })
    });
    assert.equal(msgRes1.status, 200);
    const data1 = await msgRes1.json();
    assert.equal(data1.delivered, true);

    const msgRes2 = await fetch(`${baseUrl}/api/agents/coder/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ui.token}`
      },
      body: JSON.stringify({ nonce, text: 'Fix bug' })
    });
    assert.equal(msgRes2.status, 200);
    const data2 = await msgRes2.json();
    assert.equal(data2.status, 'duplicate');
  } finally {
    await ui.close();
  }
});
