# Hooks Direct Raw Capture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `scripts/codex-hooks` write structured `raw_capture` directly at `Stop`, so hooks-collected assistant/tool evidence reliably reaches the memory pipeline.

**Architecture:** Keep `pending_feedback` as the in-memory/session-state aggregation buffer. Add a hooks-side raw-capture writer that serializes one stop-aggregated `raw_capture` compatible with the existing CLI schema, and only clear feedback after a successful write.

**Tech Stack:** Node.js 24, TypeScript via `--experimental-strip-types`, file-based shared agent memory layout, Node test runner.

---

### Task 1: Add failing tests for stop-flush raw-capture writing

**Files:**
- Modify: `scripts/codex-hooks/test/driver.test.ts`
- Modify: `scripts/codex-hooks/test/stop-contract.test.ts`

**Step 1: Write the failing tests**

Add tests for:

- `PostToolUse + Stop` writes one `raw_capture` file under `agents/<agent>/memory/raw-capture/`
- written object has `source_kind='hook_flush'`, non-null `session_id`, `assistant_summary`, and populated `candidates`
- `Stop` with neither assistant summary nor pending feedback does not write a raw-capture file

**Step 2: Run tests to verify they fail**

Run:

```bash
npm --prefix scripts/codex-hooks test
```

Expected: FAIL because `Stop` currently does not write `raw_capture`.

**Step 3: Write the minimal implementation**

Implement the smallest hooks-side writer path needed to satisfy the tests.

**Step 4: Run tests to verify they pass**

Run:

```bash
npm --prefix scripts/codex-hooks test
```

Expected: PASS for the new stop-flush coverage.

**Step 5: Commit**

```bash
git add scripts/codex-hooks/test/driver.test.ts scripts/codex-hooks/test/stop-contract.test.ts scripts/codex-hooks/driver.ts
git commit -m "feat: write raw capture directly from hooks stop"
```

### Task 2: Preserve pending feedback on write failure

**Files:**
- Modify: `scripts/codex-hooks/test/driver.test.ts`
- Modify: `scripts/codex-hooks/driver.ts`

**Step 1: Write the failing test**

Add a test that simulates raw-capture write failure and asserts:

- `pending_feedback` remains in saved session state
- hook returns `continue: true`

**Step 2: Run tests to verify it fails**

Run:

```bash
npm --prefix scripts/codex-hooks test
```

Expected: FAIL because current stop flow clears `pending_feedback` unconditionally.

**Step 3: Write the minimal implementation**

Only clear `pending_feedback` after successful raw-capture write.

**Step 4: Run tests to verify they pass**

Run:

```bash
npm --prefix scripts/codex-hooks test
```

Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/codex-hooks/test/driver.test.ts scripts/codex-hooks/driver.ts
git commit -m "fix: preserve hook feedback when raw capture write fails"
```

### Task 3: Document the new hooks write path

**Files:**
- Modify: `scripts/codex-hooks/README.md`
- Modify: `docs/research-memory.md`

**Step 1: Update docs**

Document:

- hooks now write stop-aggregated `raw_capture` directly
- `projects/cli run` remains a compatibility/manual path
- `pending_feedback` is cleared only after successful write

**Step 2: Run targeted verification**

Run:

```bash
npm --prefix scripts/codex-hooks test
```

Expected: PASS.

**Step 3: Commit**

```bash
git add scripts/codex-hooks/README.md docs/research-memory.md
git commit -m "docs: record direct raw capture hook flow"
```
