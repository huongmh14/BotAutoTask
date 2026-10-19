#!/usr/bin/env node
import { createRuntime, LocalDaemon } from './local-daemon.js';
import { findLatestAntigravityTranscript } from '../core/log-reader.js';
import { SupervisorLoop } from '../core/supervisor.js';

const [, , subcommand = 'help', ...rest] = process.argv;

function parseCliFlags(tokens) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith('--')) {
      const key = t.slice(2);
      const val = tokens[i + 1] && !tokens[i + 1].startsWith('--') ? tokens[++i] : 'true';
      flags[key] = val;
    } else {
      positional.push(t);
    }
  }
  return { flags, text: positional.join(' ').trim() };
}

async function main() {
  const { ranker, registry } = createRuntime();

  if (subcommand === 'cores') {
    console.log('=== Registered Pluggable AI Cores (Harnesses) ===');
    for (const h of registry.list()) {
      const ok = await h.isAvailable();
      console.log(`- ${h.id.padEnd(15)} : ${ok ? 'READY (Available)' : 'OFFLINE / NOT INSTALLED'}`);
    }
    return;
  }

  if (subcommand === 'models') {
    console.log('=== Best Available Free / Idle Models (Ranked) ===');
    const candidates = await registry.getCandidates(ranker);
    if (candidates.length === 0) {
      console.log('No active CLI harnesses detected on PATH. Static priority list:');
      for (const m of ranker.priorityModels) {
        console.log(`  * ${m} (score: ${ranker.scoreModelId(m, true)})`);
      }
      return;
    }
    for (const c of candidates.slice(0, 15)) {
      console.log(`- [${c.harnessId}] ${c.modelId.padEnd(42)} (score: ${c.score})`);
    }
    return;
  }

  if (subcommand === 'logs') {
    const { flags } = parseCliFlags(rest);
    const info = findLatestAntigravityTranscript({ conversationId: flags.conv || null });
    if (!info) {
      console.log('No Antigravity transcript.jsonl found.');
      return;
    }
    console.log(`=== Antigravity IDE Real-Time Log (${info.conversationId}) ===`);
    console.log(`File         : ${info.transcriptPath}`);
    console.log(`Total Steps  : ${info.summary.stepCount} | Latest Status: ${info.summary.lastStatus}`);
    console.log(`Last Prompt  : ${info.summary.lastUserPrompt.slice(0, 200)}`);
    console.log(`Tools Called : ${info.summary.toolCalls.slice(-8).join(', ') || 'none'}`);
    console.log(`Last Response: ${info.summary.lastAgentResponse.slice(0, 400)}`);
    return;
  }

  if (subcommand === 'supervise') {
    const { flags, text } = parseCliFlags(rest);
    if (!text) {
      console.error(
        'Usage: botautotask supervise "<goal>" [--path D:\\repo] [--supervisor opencode/deepseek-v4.1-flash-free] [--worker opencode:freemodel/claude-sonnet-4-6] [--check "npm test"]'
      );
      process.exit(1);
    }
    const candidates = await registry.getCandidates(ranker, flags.worker || 'auto');
    if (candidates.length === 0) {
      console.error('No available worker harness found.');
      process.exit(1);
    }
    const chosen = candidates[0];
    const loop = new SupervisorLoop({
      workerHarness: chosen.harness,
      workerModelId: chosen.modelId,
      supervisorModelId: flags.supervisor || 'opencode/deepseek-v4.1-flash-free',
      onNotify: (msg) => console.log(msg)
    });
    const res = await loop.runSupervisedGoal({
      id: `sup-${Date.now().toString(36)}`,
      title: text.slice(0, 70),
      target_prompt: text,
      repo_path: flags.path || process.cwd(),
      acceptance_cmd: flags.check || null,
      max_steps: Number(flags.steps || 8)
    });
    console.log(`[SupervisorLoop] Result: ${res.status} (${res.stepsRun} steps)`);
    return;
  }

  if (subcommand === 'submit' || subcommand === 'run') {
    const { flags, text } = parseCliFlags(rest);
    if (!text) {
      console.error('Usage: botautotask run "<target prompt>" [--path D:\\repo] [--core opencode:deepseek-v4.1-flash-free] [--check "npm test"]');
      process.exit(1);
    }
    const daemon = new LocalDaemon({ workerId: flags.worker || 'local-pc' });
    const goal = daemon.enqueueLocalGoal({
      target_prompt: text,
      repo_path: flags.path || process.cwd(),
      preferred_core: flags.core || 'auto',
      acceptance_cmd: flags.check || null
    });
    console.log(`[BotAutoTask] Queued Goal ${goal.id}: "${goal.title}" (preferred core: ${goal.preferred_core})`);

    if (subcommand === 'run') {
      const res = await daemon.runOnce(goal.id);
      console.log(`[BotAutoTask] Finished with status: ${res?.status} (${res?.stepsRun} steps)`);
    }
    return;
  }

  if (subcommand === 'daemon') {
    const { flags } = parseCliFlags(rest);
    const daemon = new LocalDaemon({ workerId: flags.worker || 'local-pc' });
    if (flags.once === 'true') {
      await daemon.runOnce(flags['goal-id'] || null);
      return;
    }
    console.log('[BotAutoTask] Starting continuous network-aware daemon...');
    while (true) {
      await daemon.runOnce();
      await new Promise((r) => setTimeout(r, 15_000));
    }
  }

  console.log(`BotAutoTask CLI — Pluggable Multi-Core & Free-Model Orchestrator
Commands:
  botautotask cores                                         List all pluggable AI cores & health
  botautotask models                                        Discover & rank best free/idle models
  botautotask logs [--conv <id>]                            Read latest Antigravity IDE transcript.jsonl
  botautotask supervise "<goal>" [--worker <id>] [--check]  Supervisor reads IDE logs & issues directives
  botautotask submit "<goal>" [--core <id>]                 Queue a goal persistently (runs when online)
  botautotask run "<goal>" [--core <id>]                    Queue and immediately execute a goal
  botautotask daemon [--once] [--goal-id <id>]              Run background daemon / Cloud Worker
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
