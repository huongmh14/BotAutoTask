import { createServer } from 'node:http';
import { randomUUID, createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { OUTCOME } from './types.js';
import { findLatestAntigravityTranscript } from './log-reader.js';
import { WorktreeManager } from './worktree-manager.js';
import { atomicWriteJsonSync } from './atomic-write.js';

/**
 * Multi-Agent Mesh & Routed Loopback MCP Bridge (v2)
 * Features:
 * 1. Grok Bot & Neko-Bot schema:
 *    - 3 Delivery Modes: "send" | "interrupt" | "queue"
 *    - Subagent timeout & status: complete | still_running | not_found | error
 *    - Loop guard (detects 3 identical repeated calls)
 * 2. Parallel Isolated Git Worktrees per Writer Agent:
 *    - Writers get dedicated `.botautotask/worktrees/<agentId>`
 *    - Readers/reviewers inspect shared workspace
 *    - Verified isolated merge back into base branch
 * 3. Crash-safe atomic state writes via `atomicWriteJsonSync`
 */

export const MESH_TOOLS = [
  {
    name: 'CreateAgent',
    description:
      'Create a new specialist teammate agent with a name, role ("writer" | "reader"), persona/description, and optional preferred core. Returns the new agent id.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Optional short slug id (e.g. "architect", "coder", "qa").' },
        name: { type: 'string', description: 'Human-readable name for the teammate agent.' },
        description: { type: 'string', description: 'Persona and instructions for this teammate.' },
        role: {
          type: 'string',
          enum: ['writer', 'reader'],
          description: 'Role of agent: "writer" gets an isolated git worktree; "reader" inspects shared repo.'
        },
        preferred_core: {
          type: 'string',
          description: 'Optional preferred runtime: "claude", "codex", "opencode", "antigravity", or "auto".'
        },
        base_branch: { type: 'string', description: 'Base git branch to fork worktree from.' }
      },
      required: ['name']
    }
  },
  {
    name: 'ListAgents',
    description:
      'List all teammate agents in the mesh, including their id, name, role, worktree path, live status, and recent activity.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'SendToAgent',
    description:
      'Send a task or message to another teammate agent. Supports 3 delivery modes: "send" (normal turn), "interrupt" (abort running turn and steer immediately), or "queue" (append to pending queue).',
    inputSchema: {
      type: 'object',
      properties: {
        target_id: { type: 'string', description: 'Target agent id from ListAgents (or "all" for broadcast).' },
        message: { type: 'string', description: 'Actionable instruction or handoff message for the teammate.' },
        delivery: {
          type: 'string',
          enum: ['send', 'interrupt', 'queue'],
          description: 'Delivery mode: "send" (default), "interrupt" (steer/stop current turn), or "queue" (enqueue for later).'
        },
        priority: {
          type: 'boolean',
          description: 'Legacy alias: when true, maps to delivery="interrupt".'
        },
        wait: {
          type: 'boolean',
          description: 'When true (default for "send"), awaits the target agent turn and returns reply.'
        }
      },
      required: ['target_id', 'message']
    }
  },
  {
    name: 'CheckSubagent',
    description:
      'Check how a running or completed subagent is doing. Supports timeout_ms to await completion or return still_running.',
    inputSchema: {
      type: 'object',
      properties: {
        subagent_id: {
          type: 'string',
          description: 'Agent ID to inspect. Omit to list all agents and their status.'
        },
        timeout_ms: {
          type: 'number',
          description: 'Optional milliseconds to wait for subagent to complete before returning still_running.'
        }
      }
    }
  },
  {
    name: 'MessageSubagent',
    description:
      'Inject a mid-run steering instruction into an agent without losing its context (alias for SendToAgent with delivery="queue" or "send").',
    inputSchema: {
      type: 'object',
      properties: {
        subagent_id: { type: 'string', description: 'Agent ID to steer.' },
        message: { type: 'string', description: 'Course-correction instruction to inject.' }
      },
      required: ['subagent_id', 'message']
    }
  },
  {
    name: 'StopSubagent',
    description: 'Abort a running agent that is stuck, looping, or no longer needed.',
    inputSchema: {
      type: 'object',
      properties: {
        subagent_id: { type: 'string', description: 'Agent ID to stop.' }
      },
      required: ['subagent_id']
    }
  },
  {
    name: 'MergeAgentWorktree',
    description: 'Atomically verifies and merges a writer agent isolated git worktree back into the main branch.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Agent ID whose worktree branch should be merged.' },
        verify_cmd: { type: 'string', description: 'Optional test/acceptance command to verify in worktree before merge.' }
      },
      required: ['agent_id']
    }
  }
];

export function slugifyId(text) {
  return (
    String(text || 'agent')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || `agent-${randomUUID().slice(0, 6)}`
  );
}

export function parseInlineAgentToolCalls(rawText = '') {
  const calls = [];
  const regex = /\[AGENT_TOOL:\s*(\{.+?\})\]/gs;
  let match;
  while ((match = regex.exec(rawText)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.tool) {
        calls.push({
          name: parsed.tool,
          args: parsed.args || {}
        });
      }
    } catch {}
  }
  return calls;
}

export class AgentMesh {
  constructor({
    registry,
    ranker,
    workspaceDir = process.cwd(),
    stateFile = null,
    onEvent = () => {}
  } = {}) {
    this.registry = registry;
    this.ranker = ranker;
    this.workspaceDir = workspaceDir;
    this.stateFile = stateFile || `${workspaceDir}/.botautotask/mesh-state.json`;
    this.onEvent = onEvent;
    this.agents = new Map();
    this.handoffs = [];
    this.mcpBridge = null;
    this.worktreeManager = new WorktreeManager({ repoPath: workspaceDir });
    this.loopGuardCounts = new Map();
    this.approvals = new Map();

    this._seedDefaultTeam();
  }

  _seedDefaultTeam() {
    this.createAgent({
      id: 'lead',
      name: 'Team Lead (Orchestrator)',
      description:
        'Coordinates tasks under the human commander, decomposes goals, delegates to coder/reviewer, and verifies completion.',
      role: 'reader',
      preferredCore: 'auto'
    });
    this.createAgent({
      id: 'coder',
      name: 'Senior Implementation Engineer',
      description:
        'Writes clean, minimal, production-ready code and unit tests in isolated worktree using Codex / Claude / OpenCode.',
      role: 'writer',
      preferredCore: 'auto'
    });
    this.createAgent({
      id: 'reviewer',
      name: 'Adversarial Reviewer & QA',
      description:
        'Reviews git diff, runs verification checks, inspects IDE logs, and sends surgical fix requests back to coder.',
      role: 'reader',
      preferredCore: 'auto'
    });
  }

  createAgent({ id, name, description = '', role = null, preferredCore = 'auto', baseBranch = null }) {
    const cleanId = id ? slugifyId(id) : slugifyId(name);
    const existing = this.agents.get(cleanId);
    if (existing) {
      if (name) existing.name = name;
      if (description) existing.description = description;
      if (role) existing.role = role;
      if (preferredCore) existing.preferredCore = preferredCore;
      this._persistState();
      return existing;
    }

    const agent = {
      id: cleanId,
      name: name || cleanId,
      description,
      role: role === 'reader' ? 'reader' : 'writer',
      preferredCore: preferredCore || 'auto',
      baseBranch: baseBranch || null,
      worktreePath: null,
      status: 'idle',
      startedAtMs: null,
      finishedAtMs: null,
      toolCallCount: 0,
      recentActivity: [],
      pendingSteers: [],
      inbox: [],
      transcript: [],
      aborted: false,
      _abortController: null
    };
    this.agents.set(cleanId, agent);
    this._persistState();
    this.onEvent({ type: 'agent_created', agentId: cleanId, name: agent.name, role: agent.role });
    return agent;
  }

  listAgents() {
    return Array.from(this.agents.values()).map((a) => {
      const lastAct = a.recentActivity.length > 0 ? a.recentActivity[a.recentActivity.length - 1] : '';
      return {
        id: a.id,
        name: a.name,
        role: a.role,
        description: a.description,
        preferredCore: a.preferredCore,
        status: a.status,
        worktreePath: a.worktreePath,
        startedAtMs: a.startedAtMs || null,
        finishedAtMs: a.finishedAtMs || null,
        elapsedMs: a.status === 'running' && a.startedAtMs ? Date.now() - a.startedAtMs : 0,
        doing: String(lastAct || a.description || '').slice(0, 120),
        toolCallCount: a.toolCallCount,
        recentActivity: a.recentActivity.slice(-5),
        pendingSteers: a.pendingSteers.length,
        inboxCount: a.inbox.length,
        inboxPreview: a.inbox.slice(0, 8).map((item, idx) => ({
          index: idx,
          fromId: item.fromId,
          message: String(item.message || '').slice(0, 120),
          timestamp: item.timestamp
        }))
      };
    });
  }

  removeInboxItem(agentId, index) {
    const agent = this.agents.get(agentId);
    if (!agent) return { ok: false, error: `No agent "${agentId}" found.` };
    const idx = Number(index);
    if (!Number.isInteger(idx) || idx < 0 || idx >= agent.inbox.length) {
      return { ok: false, error: 'Invalid inbox index' };
    }
    const [removed] = agent.inbox.splice(idx, 1);
    this._persistState();
    return { ok: true, removed, inboxCount: agent.inbox.length };
  }

  listApprovals() {
    const now = Date.now();
    for (const app of this.approvals.values()) {
      if (app.status === 'pending' && app.expiresAt && now > app.expiresAt) {
        app.status = 'expired';
      }
    }
    return Array.from(this.approvals.values()).slice(-30);
  }

  proposeApproval({ action, args = {}, callerId = 'coder' }) {
    const id = `appr-${randomUUID().slice(0, 8)}`;
    const hash = createHash('sha256')
      .update(JSON.stringify({ action, args }))
      .digest('hex')
      .slice(0, 16);
    const entry = {
      id,
      action,
      args,
      callerId,
      hash,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + 30 * 60 * 1000,
      decidedAt: null,
      note: null,
      result: null
    };
    this.approvals.set(id, entry);
    this._persistState();
    this.onEvent({ type: 'approval_request', approval: entry });
    return entry;
  }

  async decideApproval(id, { decision, hash, note = '' } = {}) {
    const entry = this.approvals.get(id);
    if (!entry) return { ok: false, status: 404, error: 'Approval not found' };
    if (entry.status !== 'pending') {
      return { ok: false, status: 409, error: 'already_decided', currentStatus: entry.status, approval: entry };
    }
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      entry.status = 'expired';
      this._persistState();
      return { ok: false, status: 410, error: 'expired', approval: entry };
    }
    if (hash && hash !== entry.hash) {
      return { ok: false, status: 409, error: 'hash_mismatch', approval: entry };
    }

    entry.decidedAt = new Date().toISOString();
    entry.note = note || '';

    if (decision === 'deny') {
      entry.status = 'denied';
      this._persistState();
      this.steerAgent(entry.callerId, `Approval ${id} (${entry.action}) denied${note ? ': ' + note : '.'}`, 'commander');
      this.onEvent({ type: 'approval_decided', approval: entry });
      return { ok: true, approval: entry };
    }

    // Atomic claim in synchronous tick
    entry.status = 'executing';
    this._persistState();
    try {
      const out = await this.executeMeshTool(entry.action, entry.args, { callerAgentId: 'commander' });
      entry.status = out && out.success === false ? 'failed' : 'succeeded';
      entry.result = out;
    } catch (err) {
      entry.status = 'failed';
      entry.result = { error: err.message };
    }
    this._persistState();
    this.onEvent({ type: 'approval_decided', approval: entry });
    return { ok: true, approval: entry };
  }

  steerAgent(agentId, message, from = 'commander') {
    const agent = this.agents.get(agentId);
    if (!agent) return { ok: false, reason: `No agent "${agentId}" found.` };
    const steerNote = `[PRIORITY STEER from ${from}]: ${message}`;
    agent.pendingSteers.push(steerNote);
    agent.recentActivity.push(`Steered by ${from}: ${message.slice(0, 80)}`);
    this._persistState();
    this.onEvent({ type: 'agent_steered', agentId, from, message });
    return {
      ok: true,
      status: agent.status,
      message: `Delivered priority steer to ${agent.name} (${agent.id}). Context preserved.`
    };
  }

  stopAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) return { ok: false, reason: `No agent "${agentId}" found.` };
    agent.aborted = true;
    agent.status = 'aborted';
    if (agent._abortController) {
      try { agent._abortController.abort(); } catch {}
    }
    agent.recentActivity.push('Aborted by StopSubagent.');
    this._persistState();
    this.onEvent({ type: 'agent_stopped', agentId });
    return { ok: true, message: `Stopped agent ${agent.name} (${agent.id}).` };
  }

  _checkAgentSync(agentId) {
    if (!agentId) {
      return {
        agents: this.listAgents(),
        latestIdeLog: this._readLatestIdeSummary()
      };
    }
    const agent = this.agents.get(agentId);
    if (!agent) {
      return { status: 'not_found', error: `No agent "${agentId}" found.`, available: this.listAgents().map((a) => a.id) };
    }

    return {
      status: agent.status === 'running' ? 'still_running' : agent.aborted ? 'error' : 'complete',
      id: agent.id,
      name: agent.name,
      role: agent.role,
      worktreePath: agent.worktreePath,
      elapsedMs: agent.startedAtMs ? Date.now() - agent.startedAtMs : 0,
      toolCallCount: agent.toolCallCount,
      recentActivity: agent.recentActivity.slice(-10),
      pendingSteers: agent.pendingSteers,
      inboxCount: agent.inbox.length,
      lastTranscriptEntry: agent.transcript.slice(-1)[0] || null,
      latestIdeLog: this._readLatestIdeSummary()
    };
  }

  async _checkAgentAsync(agentId, timeoutMs) {
    const agent = this.agents.get(agentId);
    if (!agent) return this._checkAgentSync(agentId);

    if (agent.status === 'running') {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (agent.status !== 'running') break;
        await new Promise((r) => setTimeout(r, 50));
      }
      if (agent.status === 'running') {
        return {
          status: 'still_running',
          agent_id: agentId,
          elapsedMs: agent.startedAtMs ? Date.now() - agent.startedAtMs : 0,
          toolCallCount: agent.toolCallCount
        };
      }
    }
    return this._checkAgentSync(agentId);
  }

  checkAgent(agentId, timeoutMs = 0) {
    if (timeoutMs > 0) {
      return this._checkAgentAsync(agentId, timeoutMs);
    }
    return this._checkAgentSync(agentId);
  }

  _readLatestIdeSummary() {
    try {
      const info = findLatestAntigravityTranscript();
      if (!info) return null;
      return {
        conversationId: info.conversationId,
        status: info.summary.lastStatus,
        toolCalls: info.summary.toolCalls.slice(-5),
        lastResponse: (info.summary.lastAgentResponse || '').slice(0, 300)
      };
    } catch {
      return null;
    }
  }

  async _resolveAgentHarness(agent) {
    const candidates = await this.registry.getCandidates(this.ranker, agent.preferredCore || 'auto');
    if (candidates.length > 0) {
      return { harness: candidates[0].harness, modelId: candidates[0].modelId };
    }
    throw new Error('No available AI core found for AgentMesh execution.');
  }

  /**
   * Sends a message to another agent with support for 3 delivery modes:
   * - "send": runs turn normally or queues if waiting is false.
   * - "interrupt": aborts ongoing turn and steers immediately.
   * - "queue": queues message without interrupting active work.
   */
  async sendToAgent({
    fromId = 'commander',
    targetId,
    message,
    delivery = null,
    priority = false,
    wait = true,
    depth = 0
  }) {
    if (targetId === 'all') {
      const targets = Array.from(this.agents.keys()).filter((id) => id !== fromId);
      const replies = [];
      for (const id of targets) {
        const res = await this.sendToAgent({
          fromId,
          targetId: id,
          message,
          delivery,
          priority,
          wait,
          depth
        });
        replies.push({ targetId: id, ...res });
      }
      return { delivered: true, broadcast: replies };
    }

    const target = this.agents.get(targetId);
    if (!target) {
      return {
        delivered: false,
        error: `Unknown target_id "${targetId}". Known agents: ${Array.from(this.agents.keys()).join(', ')}`
      };
    }

    if (fromId === targetId) {
      return {
        delivered: false,
        error: 'An agent cannot SendToAgent to itself. Pick a teammate id.'
      };
    }

    // Loop Guard: detect identical (target, sha256(message)) repeated >= 3 times
    const msgHash = createHash('sha256').update(message).digest('hex').slice(0, 16);
    const loopKey = `${fromId}->${targetId}:${msgHash}`;
    const seenCount = (this.loopGuardCounts.get(loopKey) || 0) + 1;
    this.loopGuardCounts.set(loopKey, seenCount);
    if (seenCount >= 3) {
      return {
        delivered: false,
        error: `Loop detected: same message sent to "${targetId}" 3 times. Operation rejected.`
      };
    }

    // Resolve delivery mode
    const resolvedDelivery = delivery || (priority ? 'interrupt' : 'send');

    const handoff = {
      schema: 'neko.session-handoff/v1',
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      fromAgentId: fromId,
      targetAgentId: targetId,
      delivery: resolvedDelivery,
      priority: resolvedDelivery === 'interrupt',
      summary: message
    };
    this.handoffs.push(handoff);

    if (resolvedDelivery === 'interrupt') {
      if (target.status === 'running' && target._abortController) {
        try { target._abortController.abort(); } catch {}
        target.status = 'interrupted';
      }
      target.pendingSteers.push(`[INTERRUPT STEER from ${fromId}]: ${message}`);
      target.recentActivity.push(`Interrupted by ${fromId}: ${message.slice(0, 80)}`);
    } else if (resolvedDelivery === 'queue') {
      target.inbox.push({ fromId, message, timestamp: handoff.createdAt });
      target.recentActivity.push(`Queued message from ${fromId}: ${message.slice(0, 80)}`);
    } else {
      target.inbox.push({ fromId, message, timestamp: handoff.createdAt });
      target.recentActivity.push(`Received task from ${fromId}: ${message.slice(0, 80)}`);
    }

    this._persistState();
    this.onEvent({
      type: 'agent_message',
      id: handoff.id,
      fromId,
      targetId,
      delivery: resolvedDelivery,
      message
    });

    if (!wait || resolvedDelivery === 'queue') {
      return {
        delivered: true,
        handoffId: handoff.id,
        status: 'queued',
        delivery: resolvedDelivery,
        message: `Message ${resolvedDelivery}ed for ${target.name} (${target.id}).`
      };
    }

    const turnResult = await this.runAgentTurn(targetId, message, { fromId, depth });
    const replyText = turnResult.summary || `Completed turn (${turnResult.outcome})`;
    const replyHandoff = {
      schema: 'neko.session-handoff/v1',
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      fromAgentId: targetId,
      targetAgentId: fromId,
      delivery: 'send',
      priority: false,
      core: turnResult.harnessId ? `${turnResult.harnessId}:${turnResult.modelId || ''}` : null,
      summary: replyText
    };
    this.handoffs.push(replyHandoff);
    this._persistState();
    this.onEvent({
      type: 'team_step',
      id: replyHandoff.id,
      fromId: targetId,
      targetId: fromId,
      delivery: 'send',
      message: replyText,
      harnessId: turnResult.harnessId,
      modelId: turnResult.modelId
    });

    return {
      delivered: true,
      handoffId: handoff.id,
      replyHandoffId: replyHandoff.id,
      status: turnResult.outcome,
      reply: replyText,
      harnessId: turnResult.harnessId,
      modelId: turnResult.modelId
    };
  }

  /**
   * Orchestrates a full multi-agent squad mission across @lead -> @coder -> @reviewer -> merge,
   * streaming every inter-agent handoff in real time to the Messenger feed.
   */
  async runTeamMission({ goal, check = null } = {}) {
    const coderBefore = this.agents.get('coder')?.toolCallCount || 0;
    const reviewerBefore = this.agents.get('reviewer')?.toolCallCount || 0;
    const checkNote = check ? `\nVerification command: \`${check}\`` : '';

    // 1. Commander -> @lead (Architecture & Spec Decomposition)
    const leadRes = await this.sendToAgent({
      fromId: 'commander',
      targetId: 'lead',
      message: `${goal}${checkNote}\nDo NOT call any tools (no bash/read/glob). Immediately output a concise 4-bullet implementation specification for @coder.`,
      delivery: 'send',
      wait: true
    });

    // 2. @lead -> @coder (Isolated Git Worktree Implementation) if @lead didn't already invoke @coder inline
    const coderAfterLead = this.agents.get('coder')?.toolCallCount || 0;
    let coderRes = null;
    if (coderAfterLead === coderBefore && this.agents.has('coder')) {
      coderRes = await this.sendToAgent({
        fromId: 'lead',
        targetId: 'coder',
        message: `Task Goal: ${goal}${checkNote}\n\nLead Specification:\n${leadRes.reply}\n\nVerify and summarize the implemented changes in your isolated worktree in one concise response (do not run slow multi-step loops).`,
        delivery: 'send',
        wait: true
      });
    }

    // 3. @coder -> @reviewer (QA Verification & Diff Review)
    const reviewerAfterCoder = this.agents.get('reviewer')?.toolCallCount || 0;
    let verifyReport = '';
    if (check) {
      const vRes = this.worktreeManager.verify('coder', check);
      verifyReport = `\n\nAutomated Worktree Check (\`${check}\`): ${vRes.passed ? 'PASSED (exit 0)' : 'FAILED (exit ' + vRes.exitCode + ')'}\nOutput:\n${(vRes.stdout || vRes.stderr || '').slice(-600)}`;
    }
    if (reviewerAfterCoder === reviewerBefore && this.agents.has('reviewer')) {
      await this.sendToAgent({
        fromId: 'coder',
        targetId: 'reviewer',
        message: `Implemented changes on branch \`botautotask/agent-coder\`.\nSummary:\n${coderRes ? coderRes.reply : leadRes.reply}${verifyReport}\n\nDo NOT call any tools. Review the verification output above and confirm readiness to merge in 3 concise bullet points.`,
        delivery: 'send',
        wait: true
      });
    }

    // 4. Auto-verify & merge @coder worktree into main branch
    const mergeOut = this.worktreeManager.merge('coder', { verifyCmd: check || null });
    const finalMsg = mergeOut.success
      ? `[MISSION COMPLETE & MERGED] Branch \`botautotask/agent-coder\` passed verification and merged into main (commit: ${(mergeOut.sha || 'HEAD').slice(0, 7)}).`
      : `[MISSION VERIFICATION NOTE] Worktree merge status: ${mergeOut.reason || 'skipped'} ${mergeOut.error ? '— ' + mergeOut.error.slice(0, 240) : ''}`;

    const finalHandoff = {
      schema: 'neko.session-handoff/v1',
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      fromAgentId: 'lead',
      targetAgentId: 'commander',
      delivery: 'send',
      priority: false,
      core: 'worktree:merger',
      summary: finalMsg
    };
    this.handoffs.push(finalHandoff);
    this._persistState();
    this.onEvent({
      type: 'team_step',
      id: finalHandoff.id,
      fromId: 'lead',
      targetId: 'commander',
      delivery: 'send',
      message: finalMsg,
      harnessId: 'worktree',
      modelId: 'merger'
    });

    return { ok: mergeOut.success, mergeOut, leadRes, coderRes };
  }

  /**
   * Executes a single turn for `agentId`, isolating writers into git worktrees.
   */
  async runAgentTurn(agentId, incomingPrompt, { fromId = 'commander', depth = 0, maxDepth = 3 } = {}) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent "${agentId}" does not exist.`);

    agent.aborted = false;
    agent.status = 'running';
    agent.startedAtMs = Date.now();
    agent.toolCallCount += 1;
    agent._abortController = new AbortController();
    this._persistState();
    this.onEvent({ type: 'agent_status', agentId, status: 'running' });

    // Isolated Worktree for writers
    let runDir = this.workspaceDir;
    if (agent.role === 'writer') {
      try {
        const wtInfo = this.worktreeManager.ensure(agent.id, agent.baseBranch || undefined);
        runDir = wtInfo.path;
        agent.worktreePath = wtInfo.path;
      } catch (err) {
        agent.recentActivity.push(`Worktree ensure warning: ${err.message}`);
      }
    }

    const steers = agent.pendingSteers.splice(0, agent.pendingSteers.length);
    const inboxItems = agent.inbox.splice(0, agent.inbox.length);

    const teammatesList = this.listAgents()
      .filter((a) => a.id !== agentId)
      .map((a) => `- id: "${a.id}" | name: "${a.name}" | role: ${a.role} | instructions: ${a.description}`)
      .join('\n');

    const promptLines = [
      `# AGENT IDENTITY`,
      `You are "${agent.name}" (id: "${agent.id}", role: "${agent.role}").`,
      `Role & Instructions: ${agent.description}`,
      agent.worktreePath ? `Isolated Worktree: ${agent.worktreePath}` : `Workspace: ${runDir}`,
      ``,
      `# TEAMMATES IN MESH (You can control/delegate to them)`,
      teammatesList || '(No other teammates yet)',
      ``,
      `# INTER-AGENT CONTROL PROTOCOL`,
      `You may delegate to other agents by calling MCP tools or outputting an inline directive:`,
      `[AGENT_TOOL: {"tool":"SendToAgent","args":{"target_id":"coder","message":"Implement X","delivery":"send"}}]`,
      `[AGENT_TOOL: {"tool":"CreateAgent","args":{"id":"qa","name":"QA Tester","role":"reader","description":"Runs unit tests"}}]`,
      `[AGENT_TOOL: {"tool":"MessageSubagent","args":{"subagent_id":"coder","message":"Switch to node:crypto"}}]`,
      ``
    ];

    if (steers.length > 0) {
      promptLines.push(`# URGENT STEERING DIRECTIVES (APPLY IMMEDIATELY)`);
      promptLines.push(...steers);
      promptLines.push(``);
    }

    if (inboxItems.length > 0) {
      promptLines.push(`# PENDING TEAMMATE MESSAGES`);
      for (const item of inboxItems) {
        promptLines.push(`- From ${item.fromId}: ${item.message}`);
      }
      promptLines.push(``);
    }

    promptLines.push(`# CURRENT DIRECTIVE (from ${fromId})`);
    promptLines.push(incomingPrompt);

    const fullPrompt = promptLines.join('\n');
    const primary = await this._resolveAgentHarness(agent);
    let fallbackCandidates = [];
    try {
      if (this.registry && this.ranker) {
        const allCands = await this.registry.getCandidates(this.ranker, agent.preferredCore || 'auto');
        fallbackCandidates = allCands.filter(
          (c) => !(c.harness.id === primary.harness.id && c.modelId === primary.modelId)
        );
      }
    } catch {}

    const candidates = [primary, ...fallbackCandidates];
    let stepResult = null;
    let activeHarnessId = primary.harness.id;
    let activeModelId = primary.modelId;

    for (let i = 0; i < candidates.length; i++) {
      const { harness, modelId } = candidates[i];
      activeHarnessId = harness.id;
      activeModelId = modelId;

      agent.recentActivity.push(`Running turn on ${harness.id}:${modelId} in ${runDir}`);
      this._persistState();

      try {
        stepResult = await harness.executeStep({
          goal: fullPrompt,
          journal: agent.transcript.slice(-5),
          workspaceDir: runDir,
          modelId,
          role: agent.role,
          signal: agent._abortController.signal
        });
      } catch (err) {
        stepResult = {
          outcome: OUTCOME.ERROR,
          summary: `Harness execution error: ${err.message}`,
          harnessId: harness.id,
          modelId
        };
      }

      if (agent.aborted) break;

      if (stepResult.outcome === OUTCOME.RATE_LIMITED && i + 1 < candidates.length) {
        this.ranker?.markCooldown?.(harness.id, modelId);
        agent.recentActivity.push(`Rate limited on ${harness.id}:${modelId}, failing over...`);
        continue;
      }

      if (stepResult.outcome === OUTCOME.ERROR && i + 1 < candidates.length) {
        this.ranker?.markCooldown?.(harness.id, modelId, 5 * 60 * 1000);
        agent.recentActivity.push(`Error on ${harness.id}:${modelId}, failing over...`);
        continue;
      }

      break;
    }

    agent._abortController = null;

    if (agent.aborted) {
      return {
        outcome: OUTCOME.ERROR,
        summary: `Agent ${agent.id} was aborted mid-turn.`,
        harnessId: activeHarnessId,
        modelId: activeModelId
      };
    }

    // Auto-commit any edits made by a writer agent in its isolated worktree
    if (agent.role === 'writer' && agent.worktreePath) {
      try {
        const commitRes = this.worktreeManager.commit(
          agent.id,
          `feat(${agent.id}): turn ${agent.toolCallCount} via ${activeHarnessId}/${activeModelId}`
        );
        if (commitRes.committed) {
          agent.recentActivity.push(`Committed worktree (${commitRes.sha.slice(0, 7)})`);
        }
      } catch {}
    }

    const rawOutput = stepResult.rawOutput || stepResult.summary || '';
    const inlineCalls = depth < maxDepth ? parseInlineAgentToolCalls(rawOutput) : [];
    const subResults = [];

    for (const call of inlineCalls) {
      agent.toolCallCount += 1;
      const toolOut = await this.executeMeshTool(call.name, call.args, {
        callerAgentId: agentId,
        depth: depth + 1
      });
      subResults.push(`[Tool ${call.name} -> ${JSON.stringify(toolOut).slice(0, 300)}]`);
    }

    const combinedSummary =
      subResults.length > 0
        ? `${stepResult.summary}\n${subResults.join('\n')}`
        : stepResult.summary;

    const entry = {
      step: agent.transcript.length + 1,
      fromId,
      harnessId: activeHarnessId,
      modelId: activeModelId,
      outcome: stepResult.outcome,
      summary: combinedSummary,
      timestamp: new Date().toISOString()
    };
    agent.transcript.push(entry);
    agent.finishedAtMs = Date.now();
    agent.status = stepResult.outcome === OUTCOME.ERROR ? 'error' : 'idle';
    agent.recentActivity.push(`Completed turn (${stepResult.outcome})`);
    this._persistState();
    this.onEvent({ type: 'agent_status', agentId, status: agent.status, finishedAtMs: agent.finishedAtMs });

    return {
      ...stepResult,
      summary: combinedSummary,
      harnessId: activeHarnessId,
      modelId: activeModelId
    };
  }

  async executeMeshTool(toolName, args = {}, { callerAgentId = 'commander', depth = 0 } = {}) {
    switch (toolName) {
      case 'CreateAgent': {
        const created = this.createAgent({
          id: args.id,
          name: args.name,
          description: args.description || '',
          role: args.role || 'writer',
          preferredCore: args.preferred_core || 'auto',
          baseBranch: args.base_branch || null
        });
        return {
          created: true,
          id: created.id,
          name: created.name,
          role: created.role,
          message: `Created agent "${created.name}" (id: ${created.id}, role: ${created.role}). Message it with SendToAgent.`
        };
      }
      case 'ListAgents': {
        return { agents: this.listAgents() };
      }
      case 'SendToAgent': {
        return await this.sendToAgent({
          fromId: callerAgentId,
          targetId: args.target_id,
          message: args.message,
          delivery: args.delivery || null,
          priority: Boolean(args.priority),
          wait: args.wait !== false,
          depth
        });
      }
      case 'CheckSubagent': {
        return await this.checkAgent(args.subagent_id, Number(args.timeout_ms || 0));
      }
      case 'MessageSubagent': {
        return this.steerAgent(args.subagent_id, args.message, callerAgentId);
      }
      case 'StopSubagent': {
        return this.stopAgent(args.subagent_id);
      }
      case 'MergeAgentWorktree': {
        const mergeOut = this.worktreeManager.merge(args.agent_id, { verifyCmd: args.verify_cmd });
        const msg = mergeOut.success
          ? `[MISSION COMPLETE & MERGED] Branch \`${this.worktreeManager.getBranchName(args.agent_id)}\` passed verification and merged into main (commit: ${(mergeOut.sha || 'HEAD').slice(0, 7)}).`
          : `[MERGE FAILED] ${mergeOut.reason || 'error'}${mergeOut.error ? ': ' + mergeOut.error.slice(0, 240) : ''}`;
        const h = {
          schema: 'neko.session-handoff/v1',
          id: randomUUID(),
          createdAt: new Date().toISOString(),
          fromAgentId: args.agent_id || 'coder',
          targetAgentId: 'commander',
          delivery: 'send',
          priority: false,
          core: 'worktree:merger',
          summary: msg
        };
        this.handoffs.push(h);
        this._persistState();
        this.onEvent({
          type: 'team_step',
          id: h.id,
          fromId: h.fromAgentId,
          targetId: 'commander',
          delivery: 'send',
          message: msg,
          harnessId: 'worktree',
          modelId: 'merger'
        });
        return mergeOut;
      }
      default:
        throw new Error(`Unknown AgentMesh tool: ${toolName}`);
    }
  }

  async startMcpBridgeServer() {
    if (this.mcpBridge) return this.mcpBridge;
    const secret = randomUUID();

    const server = createServer(async (req, res) => {
      if (req.method !== 'POST' || !req.url?.startsWith(`/mcp/${secret}`)) {
        res.writeHead(404).end();
        return;
      }

      let body = '';
      for await (const chunk of req) {
        body += String(chunk);
        if (body.length > 1_048_576) {
          res.writeHead(413).end();
          return;
        }
      }

      let msg;
      try {
        msg = JSON.parse(body);
      } catch {
        res.writeHead(400).end();
        return;
      }

      if (msg.method === 'notifications/initialized') {
        res.writeHead(202).end();
        return;
      }

      const reply = (result) => {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }));
      };

      try {
        if (msg.method === 'initialize') {
          reply({
            protocolVersion: '2025-03-26',
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: 'botautotask-agent-mesh', version: '2.0.0' }
          });
          return;
        }
        if (msg.method === 'tools/list') {
          reply({ tools: MESH_TOOLS });
          return;
        }
        if (msg.method === 'tools/call') {
          const name = msg.params?.name;
          const toolArgs = msg.params?.arguments || {};
          const callerId = req.headers['x-agent-id'] || 'mcp-peer';
          const out = await this.executeMeshTool(name, toolArgs, {
            callerAgentId: String(callerId)
          });
          reply({
            isError: false,
            content: [{ type: 'text', text: JSON.stringify(out, null, 2) }]
          });
          return;
        }
        reply({});
      } catch (err) {
        reply({
          isError: true,
          content: [{ type: 'text', text: err.message || String(err) }]
        });
      }
    });

    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    const addr = server.address();
    const url = `http://127.0.0.1:${addr.port}/mcp/${secret}`;
    this.mcpBridge = {
      url,
      port: addr.port,
      close: () =>
        new Promise((resolve) => {
          server.closeAllConnections?.();
          server.close(() => resolve());
          this.mcpBridge = null;
        })
    };
    return this.mcpBridge;
  }

  _persistState() {
    try {
      mkdirSync(dirname(this.stateFile), { recursive: true });
      const snapshot = {
        updatedAt: new Date().toISOString(),
        workspaceDir: this.workspaceDir,
        agents: Array.from(this.agents.values()).map((a) => {
          const { _abortController, ...clean } = a;
          return clean;
        }),
        handoffs: this.handoffs.slice(-50)
      };
      atomicWriteJsonSync(this.stateFile, snapshot);
    } catch {
      // Non-fatal in read-only environments
    }
  }

  loadPersistedState() {
    try {
      if (!existsSync(this.stateFile)) return false;
      const raw = JSON.parse(readFileSync(this.stateFile, 'utf8'));
      if (Array.isArray(raw?.agents)) {
        for (const a of raw.agents) {
          if (a && typeof a.id === 'string') {
            this.agents.set(a.id, {
              ...a,
              status: a.status === 'running' ? 'idle' : a.status || 'idle',
              pendingSteers: Array.isArray(a.pendingSteers) ? a.pendingSteers : [],
              inbox: Array.isArray(a.inbox) ? a.inbox : [],
              transcript: Array.isArray(a.transcript) ? a.transcript : [],
              recentActivity: Array.isArray(a.recentActivity) ? a.recentActivity : []
            });
          }
        }
      }
      if (Array.isArray(raw?.handoffs)) {
        this.handoffs = raw.handoffs;
      }
      return true;
    } catch {
      return false;
    }
  }
}
