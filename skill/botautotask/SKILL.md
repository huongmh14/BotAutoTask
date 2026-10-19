---
name: botautotask
description: Orchestrates multi-core AI agents (OpenCode free models, Antigravity IDE, Claude Code, Codex Direct OAuth, Neko Core, or custom cores) with GrokBot+Neko-Bot Zero-API-Key local session routing, Loopback HTTP MCP Multi-Agent Mesh (CreateAgent, SendToAgent, MessageSubagent), Supervisor-Worker log analysis (transcript.jsonl & --format json), automatic 429 rate-limit failover, and Cloudflare/GitHub Actions offline fallback.
---

# BotAutoTask Skill (`botautotask` CLI / `D:\BotAutoTask`)

Use this skill whenever the user wants to:
1. Inspect or reuse **Zero-API-Key local login sessions** (`botautotask auth`) across Codex/ChatGPT (`~/.codex/auth.json` OAuth direct SSE), Claude Code (`~/.claude`), OpenCode (`opencode`), and Antigravity IDE.
2. Run a **GrokBot + Neko-Bot Multi-Agent Coworker Mesh** (`botautotask team`, `botautotask agents`, `botautotask steer`) where agents (`lead`, `coder`, `reviewer`, or dynamically created specialists) automatically control and message each other over a Loopback HTTP MCP Bridge (`CreateAgent`, `ListAgents`, `SendToAgent`, `CheckSubagent`, `MessageSubagent`, `StopSubagent`) under the user's command.
3. Run a **Supervisor $\leftrightarrow$ IDE Worker Loop** (`botautotask supervise`) where a lightweight free Supervisor agent reads real-time IDE logs (`transcript.jsonl` from Antigravity or `--format json` from OpenCode + `git diff` + test output), grades the result, and issues surgical follow-up directives (`.botautotask/DIRECTIVE.md` & CLI) to the Worker IDE.
4. Submit or run a target-driven task (`goal`) that automatically switches AI cores/models if one hits a rate limit (`429` / quota exceeded).

## Quick Global CLI Commands (`botautotask`)

- **Inspect Zero-API-Key local login sessions (`codex`, `claude`, `opencode`, `antigravity`):**
  ```powershell
  botautotask auth
  ```
- **List registered pluggable AI cores and their availability:**
  ```powershell
  botautotask cores
  ```
- **Discover and rank the best free/idle models right now:**
  ```powershell
  botautotask models
  ```
- **List Multi-Agent Mesh coworkers (`lead`, `coder`, `reviewer`, etc.) & status:**
  ```powershell
  botautotask agents
  ```
- **Run GrokBot + Neko-Bot Multi-Agent Coworker Team on a goal:**
  ```powershell
  botautotask team "<target goal>" --path "<workspace_dir>"
  ```
- **Inject a high-priority steering instruction (`MessageSubagent`) into an agent:**
  ```powershell
  botautotask steer <agentId> "<steering instruction>"
  ```
- **Read real-time Antigravity IDE execution logs (`transcript.jsonl`):**
  ```powershell
  botautotask logs
  ```
- **Run Supervisor $\leftrightarrow$ IDE Worker closed-loop (reads logs, evaluates test/diff, issues next directive):**
  ```powershell
  botautotask supervise "<target goal>" --path "<workspace_dir>" --supervisor "opencode/deepseek-v4.1-flash-free" --worker "opencode:freemodel/claude-sonnet-4-6" --check "<optional_test_cmd>"
  ```
- **Queue and immediately execute a target goal with multi-core auto-failover:**
  ```powershell
  botautotask run "<target prompt>" --path "<workspace_dir>" --core "<auto_or_harness:model>" --check "<optional_verification_cmd>"
  ```
