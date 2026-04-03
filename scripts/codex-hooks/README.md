# Codex Hooks Runtime

This directory contains the machine-level hooks adapters for `dynamic_memory`.

Installation:

```bash
scripts/codex-hooks/install-hooks.sh
```

Active agent binding:

- `OBSIDIAN_AGENT_MEMORY_SERVER_ACTIVE_AGENT_ID`
- `<repo>/.codex/agent-memory/active-agent.json`
- `<repo>/.codex/agent-memory/active-agent-id.txt`

The runtime is intentionally thin. Hooks decide when to refresh memory; the existing `agents` CLI decides how to write and verify it.
