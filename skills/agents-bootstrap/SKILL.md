---
name: agents-bootstrap
description: Use when a Codex session needs to discover shared agents and use the machine-level `agents` launcher to read or write shared memory.
---

# Agents Bootstrap

Use this skill when a Codex session should work with the shared `agents` command on this machine.

## Workflow

1. Run `agents list` to discover available shared agents.
2. Select the agent that matches the task.
3. Run `agents run --agent-id <id> --input <task>`.
4. Run `agents verify --agent-id <id>` when you need to confirm the shared memory state.

## Rules

- Treat `agents list` as the source of truth for discovery.
- Do not assume a per-session local identity if a shared identity exists.
- Read and write memory through the shared `agents` launcher.
- If the task needs a different shared root, set `OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT` explicitly.
