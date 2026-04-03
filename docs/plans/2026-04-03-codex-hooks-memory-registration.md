# Codex Hooks Memory Registration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Register Codex hooks so other sessions can automatically refresh short-term feedback and long-term memory through the existing `agents` CLI.

**Architecture:** Keep the active hook registry at the machine level in `~/.codex/hooks.json`, but make the repo the source of truth for the hook logic. Each hook event delegates to a thin TypeScript adapter, all adapters share one driver for state, identity binding, and CLI calls, and the driver writes only through `agents run` / `agents verify`. Turn-scope hooks handle retrieval and feedback capture; Bash-only hooks stay as evidence guardrails.

**Tech Stack:** Node.js 24+, TypeScript with `node --experimental-strip-types`, POSIX shell for installation, existing `agents` CLI, `node:test`.

---

### Task 1: Add the hook registry template and installer

**Files:**
- Create: `.codex/hooks.json`
- Create: `scripts/codex-hooks/install-hooks.sh`
- Create: `scripts/codex-hooks/README.md`

**Step 1: Write the failing validation check**

Add a small JSON validation test or command that proves the template contains the expected hook events and points at the repo-managed scripts.

**Step 2: Run it to make sure it fails before implementation**

Run:
```bash
node -e 'const fs=require("fs"); JSON.parse(fs.readFileSync(".codex/hooks.json","utf8"))'
```
Expected: fail until the template exists.

**Step 3: Write the minimal registry and installer**

Create a template registry that only routes to the repo-managed scripts, and add an installer that copies or links it into `~/.codex/hooks.json` without creating duplicate active registries.

**Step 4: Run the validation again**

Run:
```bash
node -e 'const fs=require("fs"); console.log(Object.keys(JSON.parse(fs.readFileSync(".codex/hooks.json","utf8")).hooks))'
```
Expected: prints the supported hook events.

### Task 2: Implement the shared hook driver and session state

**Files:**
- Create: `scripts/codex-hooks/driver.ts`
- Create: `scripts/codex-hooks/state.ts`
- Create: `scripts/codex-hooks/contracts.ts`
- Create: `scripts/codex-hooks/test/driver.test.ts`

**Step 1: Write the failing tests**

Add tests for:
- event dispatch to the right action
- identity binding resolution
- per-session state read/write
- idempotent turn deduplication

**Step 2: Run the tests to confirm they fail**

Run:
```bash
node --test --experimental-strip-types scripts/codex-hooks/test/driver.test.ts
```
Expected: fail until the driver exists.

**Step 3: Implement the minimal shared driver**

Add a driver that:
- parses hook stdin
- resolves the active `agent_id`
- loads and updates session state
- de-duplicates repeated hook invocations
- shells out to `agents list`, `agents verify`, and `agents run`

**Step 4: Re-run the driver tests**

Run:
```bash
node --test --experimental-strip-types scripts/codex-hooks/test/driver.test.ts
```
Expected: pass.

### Task 3: Add the event adapters for memory refresh and feedback capture

**Files:**
- Create: `scripts/codex-hooks/session-start.ts`
- Create: `scripts/codex-hooks/user-prompt-submit.ts`
- Create: `scripts/codex-hooks/stop.ts`
- Create: `scripts/codex-hooks/pre-tool-use.ts`
- Create: `scripts/codex-hooks/post-tool-use.ts`
- Create: `scripts/codex-hooks/test/event-adapters.test.ts`

**Step 1: Write the failing adapter tests**

Add fixture tests that assert:
- `SessionStart` emits bootstrap context
- `UserPromptSubmit` performs retrieval only when the trigger conditions match
- `Stop` flushes pending writes
- `PreToolUse` only guards Bash
- `PostToolUse` records evidence refs and short-term feedback

**Step 2: Run the adapter tests to confirm they fail**

Run:
```bash
node --test --experimental-strip-types scripts/codex-hooks/test/event-adapters.test.ts
```
Expected: fail until the adapters exist.

**Step 3: Implement the thin adapters**

Keep each adapter small and route all real behavior through the shared driver.

**Step 4: Re-run the adapter tests**

Run:
```bash
node --test --experimental-strip-types scripts/codex-hooks/test/event-adapters.test.ts
```
Expected: pass.

### Task 4: Wire the adapters into the documented dynamic-memory contract

**Files:**
- Modify: `docs/portable-agent-contract/dynamic-memory/short-term-feedback.md`
- Modify: `docs/portable-agent-contract/dynamic-memory/long-term-memory-index.md`
- Modify: `docs/portable-agent-contract/dynamic-memory/codex-hooks-memory-registration.md` if the implementation forces a contract adjustment

**Step 1: Update the hook mapping**

Record the final hook-to-memory mapping after implementation settles:
- short-term feedback: `UserPromptSubmit`, `PostToolUse`, `Stop`
- long-term index: `SessionStart`, `UserPromptSubmit`, `Stop`

**Step 2: Keep the contract narrow**

Do not expand the object model just because hooks now exist. The hooks should only trigger existing contract operations.

### Task 5: Smoke test cross-session behavior

**Files:**
- None

**Step 1: Install the registry locally**

Run the installer so the active Codex session uses the repo-managed hooks.

**Step 2: Exercise the hooks from another workspace**

Start Codex in a different repo, then confirm:
- `SessionStart` refreshes the baseline
- `UserPromptSubmit` can retrieve memory
- `Stop` flushes pending updates

**Step 3: Verify shared memory writes**

Run the existing `agents` commands from that second workspace and confirm writes still land in the shared root.

