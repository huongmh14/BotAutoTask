import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { LocalWebUiServer } from '../src/daemon/web-ui.js';
import { AgentMesh } from '../src/core/agent-mesh.js';
import { HarnessRegistry } from '../src/core/harness-registry.js';
import { FreeModelRanker } from '../src/core/model-discovery.js';

test('[UI-AC01] [UI-AC02] [UI-AC03] [UI-AC04] [SAFE-AC05] [SEC-AC02] LocalWebUiServer serves Tactical Coworker HTML, enforces auth/DNS-rebinding, and handles coworker mesh controls', async () => {
  const registry = new HarnessRegistry();
  const ranker = new FreeModelRanker();
  const workspaceDir = join(tmpdir(), `webui-ws-${randomUUID()}`);
  const stateFile = join(workspaceDir, 'webui-mesh.json');
  const mesh = new AgentMesh({ registry, ranker, workspaceDir, stateFile });
  const ui = new LocalWebUiServer({ mesh, port: 0 });
  await ui.start();

  try {
    const baseUrl = `http://127.0.0.1:${ui.port}`;

    // 1. GET / serves Tactical Coworker Command Center HTML with PR #1 regression fixes
    const htmlRes = await fetch(`${baseUrl}/`);
    assert.equal(htmlRes.status, 200);
    const html = await htmlRes.text();
    assert.match(html, /WhaleBot — Tactical Coworker Mesh/);
    assert.match(html, /#mesh-command-room/);
    assert.match(html, /<rect x="6" y="6" width="12" height="12" rx="2"\/>/);
    assert.doesNotMatch(html, /<rect[^>]*y1=/);
    assert.match(html, /\.conn\.POLLING \.conn-dot/);
    assert.match(html, /sseState !== 'LIVE'/);
    assert.match(html, /function closeTelemetry\(\)/);
    assert.match(html, /currentVerifyCmd/);
    assert.match(html, /hasDuplicateItem/);
    assert.match(html, /openDiffModal/);
    assert.match(html, /openCmdPalette/);
    assert.match(html, /decideApprovalClick/);
    assert.match(html, /marked\.min\.js/);

    // 1b. SSE /api/events accepts ?k=<token> (Spec 08 A0 regression check) and rejects bad ?k=
    const sseBad = await fetch(`${baseUrl}/api/events?k=wrong-token`);
    assert.equal(sseBad.status, 401);
    const sseOk = await fetch(`${baseUrl}/api/events?k=${ui.token}`);
    assert.equal(sseOk.status, 200);
    await sseOk.body?.cancel();

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

    // 8b. Diff endpoint, removable inbox queue, and hash-bound approval lifecycle (Spec 08 C3, C4, B3)
    const diffRes = await fetch(`${baseUrl}/api/agents/coder/diff`, {
      headers: { Authorization: `Bearer ${ui.token}` }
    });
    assert.equal(diffRes.status, 200);
    const diffData = await diffRes.json();
    assert.equal(typeof diffData.diff, 'string');

    const remRes = await fetch(`${baseUrl}/api/agents/coder/inbox/remove`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ui.token}`
      },
      body: JSON.stringify({ nonce: `rm-${Date.now()}`, index: 0 })
    });
    assert.equal(remRes.status, 200);
    const remData = await remRes.json();
    assert.equal(remData.ok, true);

    const prop = mesh.proposeApproval({ action: 'MergeAgentWorktree', args: { agent_id: 'coder' }, callerId: 'coder' });
    const badHashRes = await fetch(`${baseUrl}/api/approvals/${prop.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ui.token}`
      },
      body: JSON.stringify({ nonce: `ap1-${Date.now()}`, decision: 'approve', hash: 'wrong-hash' })
    });
    assert.equal(badHashRes.status, 409);

    const denyRes = await fetch(`${baseUrl}/api/approvals/${prop.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ui.token}`
      },
      body: JSON.stringify({ nonce: `ap2-${Date.now()}`, decision: 'deny', hash: prop.hash, note: 'Hold merge' })
    });
    assert.equal(denyRes.status, 200);
    const denyData = await denyRes.json();
    assert.equal(denyData.approval.status, 'denied');

    const expRes = await fetch(`${baseUrl}/api/experience?domain=general`, {
      headers: { Authorization: `Bearer ${ui.token}` }
    });
    assert.equal(expRes.status, 200);

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
