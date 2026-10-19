---
name: botautotask
description: Orchestrates multi-core AI agents (OpenCode free models like deepseek-v4.1-flash-free & gpt-luna, Antigravity, Claude Code, Codex, Neko Core, or custom cores) to pursue a target goal with automatic rate-limit failover, network-aware execution, Windows wake timers, and Cloudflare/GitHub Actions offline fallback. Use when the user asks to run a background goal across multiple AI cores, auto-switch models on rate limits, check best free models, or queue tasks to run when online/off-PC.
---

# BotAutoTask Skill (`D:\BotAutoTask`)

Use this skill whenever the user wants to:
1. Discover or rank the best currently available free/idle AI models across CLIs (`deepseek-v4.1-flash-free`, `gpt-luna`, `openrouter/*:free`, `gemini-2.5-pro`, etc.).
2. Submit or run a target-driven task (`goal`) that automatically switches AI cores/models if one hits a rate limit (`429` / quota exceeded).
3. Queue work to execute automatically when network connection is available or continue via Cloud Core (Cloudflare Worker + GitHub Actions) when the local PC is turned off.
4. Add, swap, or configure pluggable AI cores (such as replacing `neko-core` or adding a self-developed AI runtime in `D:\BotAutoTask\config\default-config.json`).

## Quick CLI Commands

- **List registered pluggable AI cores and their availability:**
  ```powershell
  node "D:\BotAutoTask\src\daemon\cli.js" cores
  ```
- **Discover and rank the best free/idle models right now:**
  ```powershell
  node "D:\BotAutoTask\src\daemon\cli.js" models
  ```
- **Queue and immediately execute a target goal with auto-failover:**
  ```powershell
  node "D:\BotAutoTask\src\daemon\cli.js" run "<target prompt>" --path "<workspace_dir>" --core "<auto_or_harness:model>" --check "<optional_verification_cmd>"
  ```
- **Queue a goal persistently (runs as soon as internet is available or on next wake/boot):**
  ```powershell
  node "D:\BotAutoTask\src\daemon\cli.js" submit "<target prompt>" --path "<workspace_dir>"
  ```
- **Register Windows Scheduled Task (WakeToRun + RunOnlyIfNetworkAvailable):**
  ```powershell
  powershell -ExecutionPolicy Bypass -File "D:\BotAutoTask\scripts\register-windows-task.ps1"
  ```

## Swapping or Adding New AI Cores

`BotAutoTask` uses a hexagonal `AgentHarness` contract (`D:\BotAutoTask\src\core\harness-registry.js`).
- To add or replace a core without touching orchestrator logic, edit `D:\BotAutoTask\config\default-config.json` under `customHarnesses` or add an adapter in `D:\BotAutoTask\src\harnesses\`.
