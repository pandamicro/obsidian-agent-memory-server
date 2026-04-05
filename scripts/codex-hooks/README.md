# Codex Hooks Runtime

This directory contains the machine-level hooks adapters for `dynamic_memory`.

Installation:

```bash
scripts/codex-hooks/install-hooks.sh
```

Primary flow:

- Install the machine-level registry with `scripts/codex-hooks/install-hooks.sh`
- Let `SessionStart` ask for identity selection inside the Codex session
- Let the user reply with `数字` / `agent_id` / `no identity`
- Let `UserPromptSubmit` complete initialization inside the session

Compatibility flow:

```bash
agents mount
```

`agents mount` remains available as a compatibility/debug command. It can still pre-write a workspace binding and install `<workspace>/.codex/hooks.json`, but it is no longer the recommended main interaction path.

Active agent binding:

- `OBSIDIAN_AGENT_MEMORY_SERVER_ACTIVE_AGENT_ID`
- `<repo>/.codex/agent-memory/active-agent.json`
- `<repo>/.codex/agent-memory/active-agent-id.txt`

The runtime is intentionally thin. Hooks decide when to refresh memory; the existing `agents` CLI decides how to write and verify it.
