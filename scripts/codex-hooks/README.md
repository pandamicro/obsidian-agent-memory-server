# Codex Hooks Runtime

This directory contains the machine-level hooks adapters for `dynamic_memory`.

Installation:

```bash
scripts/codex-hooks/install-hooks.sh
```

Conflict-safe install (recommended when migrating old repo-local hooks):

```bash
scripts/codex-hooks/install-hooks.sh --workspace /path/to/workspace
```

If repo-local `.codex/hooks.json` still exists, installer exits with conflict unless `--force` is provided.

Primary flow:

- Install the machine-level registry with `scripts/codex-hooks/install-hooks.sh`
- Let `SessionStart` / first `UserPromptSubmit` attempt strict auto-match
- Auto-mount only when strict match is unique and high-confidence
- Keep session inert (no forced gate) when strict match is not sufficient
- Allow explicit override in-session with `数字` / `agent_id` / `no identity`

Compatibility flow:

```bash
agents mount
```

`agents mount` remains available as a compatibility/debug command. It can still pre-write a workspace binding and install `<workspace>/.codex/hooks.json`, but it is no longer the recommended main interaction path.

Active agent binding:

- `OBSIDIAN_AGENT_MEMORY_SERVER_ACTIVE_AGENT_ID`
- `<repo>/.codex/agent-memory/active-agent.json`
- `<repo>/.codex/agent-memory/active-agent-id.txt`

Machine-level hook state:

- default: `~/.codex/memories/obsidian-agent-memory-server/hooks`
- override via `OBSIDIAN_AGENT_MEMORY_SERVER_HOOKS_STATE_ROOT`
- fallback base may come from `XDG_STATE_HOME`
- observability logs: `<state-root>/logs/hooks-YYYY-MM-DD.jsonl`

Agents CLI timeout budget:

- env: `OBSIDIAN_AGENT_MEMORY_SERVER_HOOKS_AGENTS_TIMEOUT_MS`
- default: `12000` ms
- clamp range: `1000` - `120000` ms

Derived signals toggle (MVP placeholder):

- env: `OBSIDIAN_AGENT_MEMORY_SERVER_HOOK_DERIVED_SIGNALS`
- default: disabled
- current MVP behavior: native flow unchanged even when enabled; derived event emission is reserved for a later phase

Current implementation status:

- Implemented: strict auto-match/no-identity, machine-level state + logs, timeout/degrade, dedupe, repeated-failure suppression, conflict-safe install
- Partial: Hook envelope contract is implemented, but derived event production remains disabled by default
- Planned: derived signal generation and confidence-driven side effects

The runtime is intentionally thin. Hooks decide when to refresh memory and write `raw-capture`; `agents distill` is responsible for model-filtered `short-term` generation.
