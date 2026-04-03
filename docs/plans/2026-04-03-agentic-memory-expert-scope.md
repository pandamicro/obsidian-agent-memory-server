# Agentic Memory Expert Scope Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a repo-local `agentic-memory-expert` identity that is the default development/test agent for this repository, while keeping it hidden and unusable from Codex sessions running in other repositories.

**Architecture:** Keep `agent_identity` as the stable identity object, and add a tiny repo-local scope sidecar that declares which workspace root is allowed to see and use the agent. The global `agents` launcher passes the caller workspace root into the CLI, the CLI filters `list` output by scope, and `run` / `verify` reject calls from non-matching workspaces. The repository-local Codex binding defaults to `agentic-memory-expert` so this repo’s hooks and sessions automatically use it.

**Tech Stack:** Node.js 24+, TypeScript with `node --experimental-strip-types`, POSIX shell launcher, `node:test`, existing `agents` CLI and Codex hooks runtime.

---

### Task 1: Add the scoped agent identity assets

**Files:**
- Create: `agents/agentic-memory-expert/identity/agent_identity.json`
- Create: `agents/agentic-memory-expert/identity/agent_scope.json`
- Create: `agents/agentic-memory-expert/README.md`
- Modify: `agents/README.md`

**Step 1: Write the failing validation check**

Add a test that enumerates agent identities from a different workspace and asserts `agentic-memory-expert` is not visible there, while the current repository workspace can still see it.

**Step 2: Run it to confirm the scoped agent does not exist yet**

Run:
```bash
npm --prefix projects/cli test
```
Expected: existing tests continue to pass, but the new scoped-agent test fails until the identity and scope files are added.

**Step 3: Add the minimal identity and scope files**

Create `agent_identity.json` with the new canonical identity:
- `agent_id: agentic-memory-expert`
- `canonical_name: Agentic Memory Expert`
- `specialization: agentic-memory`
- `mission`: develop and harden the agentic-memory framework
- `lineage`: `origin:agentic-memory-expert:v1`

Create `agent_scope.json` with repo-local visibility and the canonical workspace root of this repository.

**Step 4: Re-run the validation**

Run:
```bash
npm --prefix projects/cli test
```
Expected: the new scoped-agent visibility test passes.

### Task 2: Teach the CLI to respect repo-local scope

**Files:**
- Modify: `projects/cli/src/cli.ts`
- Modify: `projects/cli/test/cli.test.ts`
- Modify: `projects/cli/README.md`

**Step 1: Write the failing tests**

Add tests for:
- `agents list` hides repo-local scoped agents outside the canonical workspace root
- `agents run` rejects a scoped agent from the wrong workspace
- `agents verify` rejects a scoped agent from the wrong workspace

**Step 2: Run the tests to confirm they fail**

Run:
```bash
npm --prefix projects/cli test
```
Expected: fail on the new scope-aware assertions.

**Step 3: Implement minimal scope handling**

Add workspace-root resolution via `OBSIDIAN_AGENT_MEMORY_SERVER_WORKSPACE_ROOT`, with `process.cwd()` as fallback.
Add a small scope reader that loads `identity/agent_scope.json` when present.
Filter `list` output and gate `run` / `verify` on workspace-root match.

**Step 4: Re-run the tests**

Run:
```bash
npm --prefix projects/cli test
```
Expected: pass.

### Task 3: Make the global launcher pass the caller workspace root

**Files:**
- Modify: `bin/agents`
- Modify: `scripts/codex-hooks/README.md`
- Modify: `scripts/codex-hooks/state.ts`
- Modify: `scripts/codex-hooks/driver.ts`

**Step 1: Write the failing test or smoke precondition**

Add a launcher test that proves the caller workspace root is available to the CLI through an environment variable, not inferred from the shared root.

**Step 2: Run it to confirm the environment is not wired yet**

Run:
```bash
npm --prefix projects/cli test
```
Expected: the launcher scope test fails until the launcher exports the caller workspace root.

**Step 3: Wire the caller workspace root**

Update `bin/agents` to export the launching shell’s working directory as `OBSIDIAN_AGENT_MEMORY_SERVER_WORKSPACE_ROOT`.
Update hooks state resolution to prefer that root when choosing the active agent binding and when loading workspace-local state.

**Step 4: Re-run the tests**

Run:
```bash
npm --prefix projects/cli test
node --test --experimental-strip-types scripts/codex-hooks/test/*.test.ts
```
Expected: pass.

### Task 4: Default this repository to `agentic-memory-expert`

**Files:**
- Modify: `.codex/agent-memory/active-agent.json`
- Modify: `.codex/agent-memory/active-agent-id.txt`
- Modify: scripts and docs that still mention the old default binding

**Step 1: Write the failing smoke precondition**

Add or update a hook/state test that confirms this repository’s default binding resolves to `agentic-memory-expert`.

**Step 2: Run it to confirm the default binding is still the old one**

Run:
```bash
node --test --experimental-strip-types scripts/codex-hooks/test/*.test.ts
```
Expected: fail until the repo binding changes.

**Step 3: Switch the repo-local binding**

Update the repository-local active-agent binding to `agentic-memory-expert`.
Keep `research-agent` and `unity-optimization-agent` as available identities, but stop using `research-agent` as the repo default.

**Step 4: Re-run the tests**

Run:
```bash
node --test --experimental-strip-types scripts/codex-hooks/test/*.test.ts
```
Expected: pass.

### Task 5: Update docs and record the decision

**Files:**
- Modify: `docs/research-memory.md`
- Modify: `docs/portable-agent-contract/agent-identity.md`
- Modify: `docs/portable-agent-contract/relationship-map.md`
- Modify: `docs/portable-agent-contract/dynamic-memory/codex-hooks-memory-registration.md`

**Step 1: Record the design decision**

Document that `agentic-memory-expert` is the repo-local development/test identity and that repo-local scope is what prevents cross-repo Codex exposure.

**Step 2: Keep the contract narrow**

Do not widen `agent_identity`; only add the minimum scope metadata and launcher/CLI behavior needed to enforce visibility.

