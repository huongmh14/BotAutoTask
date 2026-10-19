import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { OUTCOME } from './types.js';
import { findLatestAntigravityTranscript, parseAntigravityTranscript } from './log-reader.js';

/**
 * Multi-Agent Mesh & Routed Loopback MCP Bridge
 * Combines:
 * 1. Grok Bot 0.18 (`routed-mcp-bridge.ts`, `sand-agent-management-tools.ts`, `sand-subagent-management-tools.ts`)
 *    - Loopback HTTP MCP Server (`http://127.0.0.1:<port>/mcp/<secret>`)
 *    - Inter-agent tools: `CreateAgent`, `ListAgents`, `SendToAgent`, `CheckSubagent`, `MessageSubagent`, `StopSubagent`
 * 2. Neko-Bot (`REQ-PB-006 Autonomous coworkers` + `session-handoff.ts`)
 *    - Multi-bot persona roster, durable handoff envelopes, and priority steering under human commander control.
 */

export const MESH_TOOLS = [
  {
    name: 'CreateAgent',
    description:
      'Create a new specialist teammate agent with a name, persona/description, and optional preferred core (claude, codex, opencode, antigravity, or auto). Returns the new agent id.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Optional short slug id (e.g. "architect", "coder", "qa").' },
        name: { type: 'string', description: 'Human-readable name for the teammate agent.' },
        description: { type: 'string', description: 'Persona and instructions for this teammate.' },
        preferred_core: {
          type: 'string',
          description: 'Optional preferred runtime: "claude", "codex", "opencode", "antigravity", or "auto".'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'ListAgents',
    description:
      'List all teammate agents in the mesh, including their id, name, role, preferred core, live status, and recent activity.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'SendToAgent',
    description:
      'Send a task or message to another teammate agent by its target_id (or "all" for group broadcast). Pass priority=true to interrupt/steer its current work immediately.',
    inputSchema: {
      type: 'object',
      properties: {
        target_id: { type: 'string', description: 'Target agent id from ListAgents.' },
        message: { type: 'string', description: 'Actionable instruction or handoff message for the teammate.' },
        priority: {
          type: 'boolean',
          description: 'When true, interrupts/steers the target agent immediately.'
        },
        wait: {
          type: 'boolean',
          description: 'When true (default), runs the target agent turn and returns its reply.'
        }
      },
      required: ['target_id', 'message']
    }
  },
  {
    name: 'CheckSubagent',
    description:
      'Check how a running or completed teammate/subagent is doing, including elapsed time, tool call count, recent activity, and live IDE transcript.',
    inputSchema: {
      type: 'object',
      properties: {
        subagent_id: {
          type: 'string',
          description: 'Agent ID to inspect. Omit to list all agents and their current status.'
        }
      }
    }
  },
  {
    name: 'MessageSubagent',
    description:
      'Inject a mid-run steering instruction into an agent without losing its context. The agent incorporates your message on its current/next step.',
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
  }
];

function slugifyId(text) {
  return (
    String(text || 'agent')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || `agent-${randomUUID().slice(0, 6)}`
  );
}

/**
 * Parses inline agent tool directives emitted by CLI models that don't use HTTP MCP directly, e.g.:
 * [AGENT_TOOL: {"tool":"SendToAgent","args":{"target_id":"coder","message":"..."}}]
 */
export function parseInlineAgentToolCalls(outputText = '') {
  const calls = [];
  const regex = /\[AGENT_TOOL:\s*(\{[\s\S]*?\})\s*\]/g;
  let match;
  while ((match = regex.exec(outputText)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && typeof parsed.tool === 'string') {
        calls.push({
          name: parsed.tool,
          args: parsed.args || {}
        });
      }
    } catch {
      // Ignore malformed inline JSON
    }
  }
  return calls;
}

export class AgentMesh {
  constructor({
    registry,
    ranker,
    workspaceDir = process.cwd(),
    stateFile = join(homedir(), '.botautotask', 'mesh-state.json'),
    onEvent = () => {}
  } = {}) {
    this.registry = registry;
    this.ranker = ranker;
    this.workspaceDir = workspaceDir;
    this.stateFile = stateFile;
    this.onEvent = onEvent;
    this.agents = new Map();
    this.handoffs = [];
    this.mcpBridge = null;

    this._seedDefaultTeam();
  }

  _seedDefaultTeam() {
    this.createAgent({
      id: 'lead',
      name: 'Team Lead (Orchestrator)',
      description:
        'Coordinates tasks under the human commander, decomposes goals, delegates to coder/reviewer, and verifies completion.',
      preferredCore: 'auto'
    });
    this.createAgent({
      id: 'coder',
      name: 'Senior Implementation Engineer',
      description:
        'Writes clean, minimal, production-ready code and unit tests in the workspace using Codex / Claude / OpenCode.',
      preferredCore: 'auto'
    });
    this.createAgent({
      id: 'reviewer',
      name: 'Adversarial Reviewer & QA',
      description:
        'Reviews git diff, runs verification checks, inspects IDE logs, and sends surgical fix requests back to coder.',
      preferredCore: 'auto'
    });
  }

  createAgent({ id, name, description = '', preferredCore = 'auto' }) {
    const cleanId = id ? slugifyId(id) : slugifyId(name);
    const existing = this.agents.get(cleanId);
    if (existing) {
      if (name) existing.name = name;
      if (description) existing.description = description;
      if (preferredCore) existing.preferredCore = preferredCore;
      this._persistState();
      return existing;
    }

    const agent = {
      id: cleanId,
      name: name || cleanId,
      description,
      preferredCore: preferredCore || 'auto',
      status: 'idle',
      startedAtMs: null,
      toolCallCount: 0,
      recentActivity: [],
      pendingSteers: [],
      inbox: [],
      transcript: [],
      aborted: false
    };
    this.agents.set(cleanId, agent);
    this._persistState();
    this.onEvent({ type: 'agent_created', agentId: cleanId, name: agent.name });
    return agent;
  }

  listAgents() {
    return Array.from(this.agents.values()).map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      preferredCore: a.preferredCore,
      status: a.status,
      elapsedMs: a.startedAtMs ? Date.now() - a.startedAtMs : 0,
      toolCallCount: a.toolCallCount,
      recentActivity: a.recentActivity.slice(-5),
      pendingSteers: a.pendingSteers.length,
      inboxCount: a.inbox.length
    }));
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
    agent.recentActivity.push('Aborted by StopSubagent.');
    this._persistState();
    this.onEvent({ type: 'agent_stopped', agentId });
    return { ok: true, message: `Stopped agent ${agent.name} (${agent.id}).` };
  }

  checkAgent(agentId) {
    if (!agentId) {
      return {
        agents: this.listAgents(),
        latestIdeLog: this._readLatestIdeSummary()
      };
    }
    const agent = this.agents.get(agentId);
    if (!agent) {
      return { error: `No agent "${agentId}" found.`, available: this.listAgents().map((a) => a.id) };
    }
    return {
      id: agent.id,
      name: agent.name,
      status: agent.status,
      preferredCore: agent.preferredCore,
      elapsedMs: agent.startedAtMs ? Date.now() - agent.startedAtMs : 0,
      toolCallCount: agent.toolCallCount,
      recentActivity: agent.recentActivity.slice(-10),
      pendingSteers: agent.pendingSteers,
      lastTranscriptEntry: agent.transcript.slice(-1)[0] || null,
      latestIdeLog: this._readLatestIdeSummary()
    };
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

  /**
   * Selects the best execution harness & model for a given agent based on its `preferredCore`
   * and the live `FreeModelRanker`.
   */
  async _resolveAgentHarness(agent) {
    const candidates = await this.registry.getCandidates(this.ranker, agent.preferredCore || 'auto');
    if (candidates.length > 0) {
      return { harness: candidates[0].harness, modelId: candidates[0].modelId };
    }
    throw new Error('No available AI core found for AgentMesh execution.');
  }

  /**
   * Sends a message from one agent (or the user commander) to another agent,
   * creating a durable Neko-style SessionHandoff envelope and optionally running the target's turn.
   */
  async sendToAgent({ fromId = 'commander', targetId, message, priority = false, wait = true, depth = 0 }) {
    if (targetId === 'all') {
      const targets = Array.from(this.agents.keys()).filter((id) => id !== fromId);
      const replies = [];
      for (const id of targets) {
        const res = await this.sendToAgent({
          fromId,
          targetId: id,
          message,
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

    const handoff = {
      schema: 'neko.session-handoff/v1',
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      fromAgentId: fromId,
      targetAgentId: targetId,
      priority: Boolean(priority),
      summary: message
    };
    this.handoffs.push(handoff);

    if (priority) {
      target.pendingSteers.push(`[PRIORITY from ${fromId}]: ${message}`);
    } else {
      target.inbox.push({ fromId, message, timestamp: handoff.createdAt });
    }
    target.recentActivity.push(`Received message from ${fromId}: ${message.slice(0, 80)}`);
    this._persistState();
    this.onEvent({ type: 'agent_message', fromId, targetId, priority, message });

    if (!wait) {
      return {
        delivered: true,
        handoffId: handoff.id,
        status: 'queued',
        message: `Message queued for ${target.name} (${target.id}).`
      };
    }

    const turnResult = await this.runAgentTurn(targetId, message, { fromId, depth });
    return {
      delivered: true,
      handoffId: handoff.id,
      status: turnResult.outcome,
      reply: turnResult.summary,
      harnessId: turnResult.harnessId,
      modelId: turnResult.modelId
    };
  }

  /**
   * Executes a single turn for `agentId` using its resolved CLI/IDE harness,
   * injecting teammate roster, pending steers, and processing any inter-agent tool calls.
   */
  async runAgentTurn(agentId, incomingPrompt, { fromId = 'commander', depth = 0, maxDepth = 3 } = {}) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent "${agentId}" does not exist.`);

    agent.aborted = false;
    agent.status = 'running';
    agent.startedAtMs = Date.now();
    agent.toolCallCount += 1;

    const steers = agent.pendingSteers.splice(0, agent.pendingSteers.length);
    const inboxItems = agent.inbox.splice(0, agent.inbox.length);

    const teammatesList = this.listAgents()
      .filter((a) => a.id !== agentId)
      .map((a) => `- id: "${a.id}" | name: "${a.name}" | role: ${a.description}`)
      .join('\n');

    const promptLines = [
      `# AGENT IDENTITY`,
      `You are "${agent.name}" (id: "${agent.id}").`,
      `Role & Instructions: ${agent.description}`,
      ``,
      `# TEAMMATES IN MESH (You can control/delegate to them)`,
      teammatesList || '(No other teammates yet)',
      ``,
      `# INTER-AGENT CONTROL PROTOCOL`,
      `If you need to create a teammate, delegate a task to another agent, or steer/check a subagent, you may either call the MCP tool directly OR output an inline directive on its own line:`,
      `[AGENT_TOOL: {"tool":"SendToAgent","args":{"target_id":"coder","message":"Implement X"}}]`,
      `[AGENT_TOOL: {"tool":"CreateAgent","args":{"id":"security","name":"Security Auditor","description":"Audits auth code"}}]`,
      `[AGENT_TOOL: {"tool":"MessageSubagent","args":{"subagent_id":"coder","message":"Use node:crypto instead"}}]`,
      ``
    ];

    if (steers.length > 0) {
      promptLines.push(`# URGENT STEERING DIRECTIVES (HIGHEST PRIORITY — APPLY IMMEDIATELY)`);
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
    const { harness, modelId } = await this._resolveAgentHarness(agent);

    agent.recentActivity.push(`Running turn on ${harness.id}:${modelId}`);
    this._persistState();

    const stepResult = await harness.executeStep({
      goal: fullPrompt,
      journal: agent.transcript.slice(-5),
      workspaceDir: this.workspaceDir,
      modelId
    });

    if (agent.aborted) {
      return {
        outcome: OUTCOME.ERROR,
        summary: `Agent ${agent.id} was aborted mid-turn.`,
        harnessId: harness.id,
        modelId
      };
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
      harnessId: harness.id,
      modelId,
      outcome: stepResult.outcome,
      summary: combinedSummary,
      timestamp: new Date().toISOString()
    };
    agent.transcript.push(entry);
    agent.status = stepResult.outcome === OUTCOME.ERROR ? 'error' : 'idle';
    agent.recentActivity.push(`Completed turn (${stepResult.outcome})`);
    this._persistState();

    return {
      ...stepResult,
      summary: combinedSummary,
      harnessId: harness.id,
      modelId
    };
  }

  /**
   * Executes one of the 6 GrokBot/NekoBot inter-agent tools (`CreateAgent`, `ListAgents`,
   * `SendToAgent`, `CheckSubagent`, `MessageSubagent`, `StopSubagent`).
   */
  async executeMeshTool(toolName, args = {}, { callerAgentId = 'commander', depth = 0 } = {}) {
    switch (toolName) {
      case 'CreateAgent': {
        const created = this.createAgent({
          id: args.id,
          name: args.name,
          description: args.description || '',
          preferredCore: args.preferred_core || 'auto'
        });
        return {
          created: true,
          id: created.id,
          name: created.name,
          message: `Created agent "${created.name}" (id: ${created.id}). Message it with SendToAgent.`
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
          priority: Boolean(args.priority),
          wait: args.wait !== false,
          depth
        });
      }
      case 'CheckSubagent': {
        return this.checkAgent(args.subagent_id);
      }
      case 'MessageSubagent': {
        return this.steerAgent(args.subagent_id, args.message, callerAgentId);
      }
      case 'StopSubagent': {
        return this.stopAgent(args.subagent_id);
      }
      default:
        throw new Error(`Unknown AgentMesh tool: ${toolName}`);
    }
  }

  /**
   * Starts a local loopback HTTP MCP Server (`http://127.0.0.1:<port>/mcp/<secret>`)
   * modeled after Grok Bot's `createRoutedMcpBridge` (`routed-mcp-bridge.ts`).
   * Any local agent (Claude Code, Codex, OpenCode, Antigravity) can connect and invoke
   * the 6 inter-agent orchestration tools over standard MCP JSON-RPC 2.0.
   */
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
            serverInfo: { name: 'botautotask-agent-mesh', version: '1.0.0' }
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
        agents: Array.from(this.agents.values()),
        handoffs: this.handoffs.slice(-50)
      };
      writeFileSync(this.stateFile, JSON.stringify(snapshot, null, 2), 'utf8');
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
