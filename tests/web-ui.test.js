import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { LocalWebUiServer } from '../src/daemon/web-ui.js';
import { AgentMesh } from '../src/core/agent-mesh.js';
import { HarnessRegistry } from '../src/core/harness-registry.js';
import { FreeModelRanker } from '../src/core/model-discovery.js';

test('LocalWebUiServer serves Tactical Coworker HTML, enforces auth/DNS-rebinding, and handles coworker mesh controls', async () => {
  const registry = new HarnessRegistry();
  const ranker = new FreeModelRanker();
  const stateFile = join(tmpdir(), `webui-mesh-${randomUUID()}.json`);
  const mesh = new AgentMesh({ registry, ranker, stateFile });
  const ui = new LocalWebUiServer({ mesh, port: 0 });
  await ui.start();

  try {
    const baseUrl = `http://127.0.0.1:${ui.port}`;

    // 1. GET / serves Tactical Coworker Command Center HTML
    const htmlRes = await fetch(`${baseUrl}/`);
    assert.equal(htmlRes.status, 200);
    const html = await htmlRes.text();
    assert.match(html, /BotAutoTask — Tactical Coworker Mesh/);
    assert.match(html, /#mesh-command-room/);

    // 2. GET /api/state rejects unauthorized requests
    const unauthRes = await fetch(`${baseUrl}/api/state`);
    assert.equal(unauthRes.status, 401);

    // 3. GET /api/state accepts valid Bearer token & returns seeded squad (lead, coder, reviewer)
    const authRes = await fetch(`${baseUrl}/api/state`, {
      headers: { Authorization: `Bearer ${ui.token}` }
    });
    assert.equal(authRes.status, 200);
    const state = await authRes.json();
    assert.equal(state.agents.length, 3);

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
      body: JSON.stringify({ nonce, text: 'Fix bug', delivery: 'queue', wait: false })
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
      body: JSON.stringify({ nonce, text: 'Fix bug', delivery: 'queue', wait: false })
    });
    assert.equal(msgRes2.status, 200);
    const data2 = await msgRes2.json();
    assert.equal(data2.status, 'duplicate');

    // 6. Spawn a new specialist coworker via POST /api/agents
    const spawnRes = await fetch(`${baseUrl}/api/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ui.token}`
      },
      body: JSON.stringify({
        nonce: `spawn-${Date.now()}`,
        id: 'sec-audit',
        name: 'Security Auditor',
        role: 'reader',
        preferredCore: 'codex',
        description: 'Audits OWASP Top 10'
      })
    });
    assert.equal(spawnRes.status, 200);
    const spawnData = await spawnRes.json();
    assert.equal(spawnData.created, true);
    assert.equal(spawnData.agent.id, 'sec-audit');

    // 7. Hot-swap core via POST /api/agents/:id/core
    const coreRes = await fetch(`${baseUrl}/api/agents/coder/core`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ui.token}`
      },
      body: JSON.stringify({ nonce: `core-${Date.now()}`, preferredCore: 'claude' })
    });
    assert.equal(coreRes.status, 200);
    assert.equal(mesh.checkAgent('coder').id, 'coder');

    // 8. 2-step Stop requires confirm: true
    const stopBad = await fetch(`${baseUrl}/api/agents/coder/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ui.token}`
      },
      body: JSON.stringify({ nonce: `stop1-${Date.now()}` })
    });
    assert.equal(stopBad.status, 400);

    const stopOk = await fetch(`${baseUrl}/api/agents/coder/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ui.token}`
      },
      body: JSON.stringify({ nonce: `stop2-${Date.now()}`, confirm: true })
    });
    assert.equal(stopOk.status, 200);

    // 9. EADDRINUSE auto-fallback: starting a second server on the occupied port automatically picks the next free port
    const ui2 = new LocalWebUiServer({ port: ui.port });
    await ui2.start();
    try {
      assert.notEqual(ui2.port, ui.port);
      assert.ok(ui2.port > 0);
    } finally {
      await ui2.close();
    }
  } finally {
    await ui.close();
  }
});
