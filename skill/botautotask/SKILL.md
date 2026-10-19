---
name: botautotask
description: Orchestrates multi-core AI agents (OpenCode free models like deepseek-v4.1-flash-free, freemodel/claude-sonnet-4-6, gpt-5.6-luna, Antigravity IDE, Claude Code, Codex, Neko Core, or custom cores) to pursue a target goal with Supervisor-Worker log analysis (transcript.jsonl & --format json), automatic rate-limit failover, network-aware execution, Windows wake timers, and Cloudflare/GitHub Actions offline fallback.
---

# BotAutoTask Skill (`botautotask` CLI / `D:\BotAutoTask`)

Use this skill whenever the user wants to:
1. Discover or rank the best currently available free/idle AI models across CLIs (`opencode/deepseek-v4.1-flash-free`, `freemodel/claude-sonnet-4-6`, `freemodel/claude-opus-4-8`, `openai/gpt-5.6-luna`, etc.).
2. Run a **Supervisor $\leftrightarrow$ IDE Worker Loop** (`botautotask supervise`) where a lightweight free Supervisor agent reads real-time IDE logs (`transcript.jsonl` from Antigravity or `--format json` from OpenCode + `git diff` + test output), grades the result, and issues surgical follow-up directives (`.botautotask/DIRECTIVE.md` & CLI) to the Worker IDE.
3. Submit or run a target-driven task (`goal`) that automatically switches AI cores/models if one hits a rate limit (`429` / quota exceeded).
4. Add, swap, or configure pluggable AI cores (such as replacing `neko-core` or adding a self-developed AI runtime in `D:\BotAutoTask\config\default-config.json`).

## Quick Global CLI Commands (`botautotask`)

- **List registered pluggable AI cores and their availability:**
  ```powershell
  botautotask cores
  ```
- **Discover and rank the best free/idle models right now:**
  ```powershell
  botautotask models
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
- **Queue a goal persistently (runs as soon as internet is available or on next wake/boot):**
  ```powershell
  botautotask submit "<target prompt>" --path "<workspace_dir>"
  ```
