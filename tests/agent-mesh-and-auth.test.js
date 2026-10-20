import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AgentMesh, parseInlineAgentToolCalls } from '../src/core/agent-mesh.js';
import { HarnessRegistry } from '../src/core/harness-registry.js';
import { FreeModelRanker } from '../src/core/model-discovery.js';
import { OUTCOME } from '../src/core/types.js';
import { getZeroKeyAuthStatus } from '../src/core/auth-bridge.js';

function createMockMesh() {
  const registry = new HarnessRegistry();
  const ranker = new FreeModelRanker({ priorityModels: ['mock/free-model'] });

  registry.register({
    id: 'mock',
    async isAvailable() {
      return true;
    },
    async discoverModels() {
      return [{ harnessId: 'mock', modelId: 'mock/free-model', isFree: true }];
    },
    async executeStep({ goal, modelId }) {
      if (goal.includes('DELEGATE_TO_CODER')) {
        return {
          outcome: OUTCOME.STEP_DONE,
          summary:
            'Delegating to coder.\n[AGENT_TOOL: {"tool":"SendToAgent","args":{"target_id":"coder","message":"Build feature Z"}}]',
          rawOutput:
            '[AGENT_TOOL: {"tool":"SendToAgent","args":{"target_id":"coder","message":"Build feature Z"}}]',
          harnessId: 'mock',
          modelId
        };
      }
      return {
        outcome: OUTCOME.GOAL_COMPLETED,
        summary: `Completed task: ${goal.slice(-80).replace(/\s+/g, ' ')}`,
        rawOutput: 'Done',
        harnessId: 'mock',
        modelId
      };
    }
  });

  const stateFile = join(tmpdir(), `mesh-test-${randomUUID()}.json`);
  return new AgentMesh({ registry, ranker, stateFile });
}

test('parseInlineAgentToolCalls extracts structured inter-agent tool calls', () => {
  const text = `
I will create a security agent and message coder:
[AGENT_TOOL: {"tool":"CreateAgent","args":{"id":"sec","name":"Security Bot","description":"Audits code"}}]
[AGENT_TOOL: {"tool":"SendToAgent","args":{"target_id":"coder","message":"Fix auth bug","priority":true}}]
`;
  const calls = parseInlineAgentToolCalls(text);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].name, 'CreateAgent');
  assert.equal(calls[0].args.id, 'sec');
  assert.equal(calls[1].name, 'SendToAgent');
  assert.equal(calls[1].args.target_id, 'coder');
  assert.equal(calls[1].args.priority, true);
});

test('AgentMesh supports GrokBot + Neko-Bot multi-agent delegation and priority steering', async () => {
  const mesh = createMockMesh();
  const initial = mesh.listAgents();
  assert.equal(initial.length, 3); // lead, coder, reviewer

  // Inject a priority steer into coder before lead delegates to it
  const steerRes = mesh.steerAgent('coder', 'Use zero external dependencies', 'commander');
  assert.equal(steerRes.ok, true);

  // Lead runs turn and automatically triggers SendToAgent -> coder
  const res = await mesh.sendToAgent({
    fromId: 'commander',
    targetId: 'lead',
    message: 'Please DELEGATE_TO_CODER now',
    wait: true
  });

  assert.equal(res.delivered, true);
  assert.match(res.reply, /Tool SendToAgent/);

  const coderCheck = mesh.checkAgent('coder');
  assert.equal(coderCheck.toolCallCount, 1);
  assert.equal(coderCheck.pendingSteers.length, 0); // Consumed during coder's turn!
});

test('AgentMesh Loopback HTTP MCP Bridge serves tools/list and tools/call', async () => {
  const mesh = createMockMesh();
  const bridge = await mesh.startMcpBridgeServer();
  try {
    // 1. tools/list
    const listRes = await fetch(bridge.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    }).then((r) => r.json());

    const toolNames = listRes.result.tools.map((t) => t.name);
    assert.ok(toolNames.includes('CreateAgent'));
    assert.ok(toolNames.includes('SendToAgent'));
    assert.ok(toolNames.includes('MessageSubagent'));

    // 2. tools/call -> CreateAgent
    const callRes = await fetch(bridge.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-agent-id': 'lead' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'CreateAgent',
          arguments: { id: 'db-expert', name: 'DB Specialist', description: 'Optimizes SQL' }
        }
      })
    }).then((r) => r.json());

    assert.equal(callRes.result.isError, false);
    const payload = JSON.parse(callRes.result.content[0].text);
    assert.equal(payload.id, 'db-expert');
    assert.equal(mesh.listAgents().length, 4);
  } finally {
    await bridge.close();
  }
});

test('getZeroKeyAuthStatus inspects local login states without throwing', async () => {
  const status = await getZeroKeyAuthStatus();
  assert.ok('codex' in status);
  assert.ok('claude' in status);
  assert.ok('opencode' in status);
  assert.ok('antigravity' in status);
});

test('AgentMergeWorktree from an agent requires human approval (Spec 08 C1-C3)', async () => {
  const mesh = createMockMesh();

  // 1. Agent-initiated merge → awaiting_review, nothing merged yet
  const req = await mesh.executeMeshTool(
    'MergeAgentWorktree',
    { agent_id: 'coder', verify_cmd: 'npm test' },
    { callerAgentId: 'coder' }
  );
  assert.equal(req.awaiting_review, true);
  assert.equal(req.success, false);
  assert.ok(req.approval_id);
  assert.ok(req.hash);

  const pending = mesh.listApprovals().filter((a) => a.status === 'pending');
  assert.equal(pending.length, 1);
  assert.equal(pending[0].action, 'MergeAgentWorktree');
  assert.equal(pending[0].callerId, 'coder');

  // 2. Approving with a wrong hash → 409 hash_mismatch
  const badHash = await mesh.decideApproval(req.approval_id, {
    decision: 'approve',
    hash: 'wrong-hash-000',
    note: ''
  });
  assert.equal(badHash.ok, false);
  assert.equal(badHash.status, 409);
  assert.equal(badHash.error, 'hash_mismatch');

  // 3. Approving with the correct hash executes exactly once, then is decided
  const good = await mesh.decideApproval(req.approval_id, {
    decision: 'approve',
    hash: req.hash,
    note: 'looks good'
  });
  assert.equal(good.ok, true);
  assert.equal(good.approval.status, 'succeeded');

  const second = await mesh.decideApproval(req.approval_id, { decision: 'approve', hash: req.hash });
  assert.equal(second.ok, false);
  assert.equal(second.error, 'already_decided');

  // 4. Deny flow steers the caller back
  const req2 = await mesh.executeMeshTool(
    'MergeAgentWorktree',
    { agent_id: 'coder' },
    { callerAgentId: 'reviewer' }
  );
  assert.equal(req2.awaiting_review, true);
  const denied = await mesh.decideApproval(req2.approval_id, { decision: 'deny', note: 'not ready' });
  assert.equal(denied.ok, true);
  assert.equal(denied.approval.status, 'denied');
  const reviewerAgent = mesh.agents.get('reviewer');
  assert.ok(reviewerAgent.pendingSteers.some((s) => s.includes('denied')));

  // 5. Destructive verify_cmd is refused by policy — no approval is even created
  const refused = await mesh.executeMeshTool(
    'MergeAgentWorktree',
    { agent_id: 'coder', verify_cmd: 'rm -rf /' },
    { callerAgentId: 'coder' }
  );
  assert.equal(refused.success, false);
  assert.equal(refused.reason, 'POLICY_REFUSED');
  assert.equal(refused.awaiting_review, undefined);
  assert.equal(mesh.listApprovals().filter((a) => a.status === 'pending').length, 0);

  // 6. Expired approval cannot be decided
  const req3 = await mesh.executeMeshTool(
    'MergeAgentWorktree',
    { agent_id: 'coder' },
    { callerAgentId: 'coder' }
  );
  const entry = mesh.approvals.get(req3.approval_id);
  entry.expiresAt = Date.now() - 1000;
  const expired = await mesh.decideApproval(req3.approval_id, { decision: 'approve', hash: req3.hash });
  assert.equal(expired.ok, false);
  assert.equal(expired.error, 'expired');
});

test('Commander-initiated merge bypasses the approval gate (Spec 08 C1)', async () => {
  const mesh = createMockMesh();
  const out = await mesh.executeMeshTool(
    'MergeAgentWorktree',
    { agent_id: 'coder', verify_cmd: null },
    { callerAgentId: 'commander' }
  );
  // Non-git test workspace → merge short-circuits with success (no approval round-trip)
  assert.equal(out.awaiting_review, undefined);
  assert.equal(mesh.listApprovals().length, 0);
});
