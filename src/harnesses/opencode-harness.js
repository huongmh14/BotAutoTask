import { OUTCOME, parseStepTags, buildHandoverPrompt } from '../core/types.js';
import { isRateLimitError } from '../core/rate-limit-detector.js';
import { runCliProcess, commandExists } from '../core/spawn-cli.js';
import { parseOpenCodeJsonStream } from '../core/log-reader.js';

/**
 * Default lightweight OpenCode runtime override that disables heavy external MCP servers
 * (e.g. 200-tool REA or Playwright headless servers) and duplicate global skills that
 * otherwise overflow context and trigger infinite compaction loops during automated runs.
 */
const FAST_OPENCODE_CONFIG = JSON.stringify({
  mcp: {
    playwright: { enabled: false },
    'code-review-graph': { enabled: false },
    rea: { enabled: false }
  },
  tools: {
    skill: false
  }
});

/**
 * OpenCode CLI Harness (`opencode run --pure --auto --format json -m <model> <prompt>`).
 * Supports structured NDJSON event stream parsing, session continuation (`--session`),
 * and optional attachment to a headless `opencode serve` instance (`--attach`).
 */
export class OpenCodeHarness {
  constructor({
    binary = 'opencode',
    ranker = null,
    useJsonFormat = true,
    attachUrl = process.env.OPENCODE_ATTACH_URL || null
  } = {}) {
    this.id = 'opencode';
    this.binary = binary;
    this.ranker = ranker;
    this.useJsonFormat = useJsonFormat;
    this.attachUrl = attachUrl;
    this.lastSessionId = null;
  }

  async isAvailable() {
    return commandExists(this.binary);
  }

  async discoverModels() {
    if (!this.ranker) {
      return [
        { harnessId: this.id, modelId: 'opencode/deepseek-v4.1-flash-free', isFree: true },
        { harnessId: this.id, modelId: 'opencode/big-pickle', isFree: true },
        { harnessId: this.id, modelId: 'freemodel/claude-sonnet-4-6', isFree: true }
      ];
    }
    const [cliModels, orModels] = await Promise.all([
      this.ranker.discoverOpenCodeCliModels(this.binary),
      this.ranker.discoverOpenRouterFreeModels()
    ]);
    const seen = new Set();
    const merged = [];
    for (const item of [...cliModels, ...orModels]) {
      if (!seen.has(item.modelId)) {
        seen.add(item.modelId);
        merged.push({ ...item, harnessId: this.id });
      }
    }
    return merged;
  }

  async executeStep({ goal, journal = [], workspaceDir = process.cwd(), modelId, signal = null }) {
    const prompt = buildHandoverPrompt(goal, journal);
    const args = ['run', '--pure', '--auto'];
    if (this.useJsonFormat) {
      args.push('--format', 'json');
    }
    if (this.attachUrl) {
      args.push('--attach', this.attachUrl);
    }
    if (this.lastSessionId && goal?.reuse_session) {
      args.push('--session', this.lastSessionId);
    }
    if (modelId) {
      args.push('-m', modelId);
    }
    args.push(prompt);

    const env = {
      ...process.env,
      OPENCODE_CONFIG_CONTENT: process.env.OPENCODE_CONFIG_CONTENT || FAST_OPENCODE_CONFIG
    };

    try {
      const { stdout, stderr } = await runCliProcess(this.binary, args, {
        cwd: workspaceDir,
        timeoutMs: 10 * 60 * 1000,
        env,
        signal
      });
      const combined = `${stdout || ''}\n${stderr || ''}`;
      if (isRateLimitError(combined, 0)) {
        return {
          outcome: OUTCOME.RATE_LIMITED,
          summary: `Rate limit on opencode (${modelId})`,
          harnessId: this.id,
          modelId,
          rawLog: combined.slice(-1000)
        };
      }

      const streamParsed = this.useJsonFormat
        ? parseOpenCodeJsonStream(stdout || stderr)
        : { textOutput: stdout || stderr, toolCalls: [], sessionId: null };

      if (streamParsed.sessionId) {
        this.lastSessionId = streamParsed.sessionId;
      }

      const fullText = streamParsed.textOutput || stdout || stderr || '';
      const parsed = parseStepTags(fullText);
      const rawLog = [
        streamParsed.toolCalls.length ? `Tools: ${streamParsed.toolCalls.join(', ')}` : '',
        fullText.slice(-800)
      ]
        .filter(Boolean)
        .join('\n');

      return {
        outcome: parsed.completed ? OUTCOME.GOAL_COMPLETED : OUTCOME.STEP_DONE,
        summary: parsed.summary,
        rawOutput: fullText,
        harnessId: this.id,
        modelId,
        sessionId: this.lastSessionId,
        rawLog
      };
    } catch (err) {
      const combined = `${err.stdout || ''}\n${err.stderr || ''}\n${err.message || ''}`;
      if (isRateLimitError(combined, err.code ?? 1)) {
        return {
          outcome: OUTCOME.RATE_LIMITED,
          summary: `Rate limit hit on opencode (${modelId})`,
          harnessId: this.id,
          modelId,
          rawLog: combined.slice(-1000)
        };
      }
      return {
        outcome: OUTCOME.ERROR,
        summary: combined.slice(-400).trim() || `OpenCode failed on ${modelId}`,
        harnessId: this.id,
        modelId,
        rawLog: combined.slice(-1000)
      };
    }
  }
}
