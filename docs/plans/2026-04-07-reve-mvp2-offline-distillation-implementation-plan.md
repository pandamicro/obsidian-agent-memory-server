# Reve MVP2 Offline Distillation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the first-pass offline `raw_capture -> Episode -> Learning` driver to `projects/reve`, with manual `distill / consolidate / drive` commands, stable file outputs, and enough test coverage to iterate on real-model memory quality safely.

**Architecture:** Keep `projects/reve` as a short-lived CLI process. Reuse the existing `distill` path for `raw_capture -> Episode`, add a separate `consolidate` path for `Episode -> Learning`, and layer a thin `drive` orchestrator on top. Use file-based idempotency, per-agent lock files, and run summaries instead of introducing queues, background workers, or retrieval logic.

**Tech Stack:** Node.js 24+, TypeScript with `node --experimental-strip-types`, `node:test`, JSON file storage under `agents/<agent_id>/`, existing `bin/reve` launcher and provider/config loading.

---

### Task 1: Add failing tests for `consolidate` CLI shape and long-term output

**Files:**
- Modify: `projects/reve/test/reve.test.ts`
- Modify: `projects/reve/src/cli.ts`

**Step 1: Write the failing tests**

Add tests that:

- seed one agent with multiple `Episode` files under `memory/short-term/`
- run `bin/reve consolidate --agent-id research-agent --limit 10 --batch-size 5`
- assert that:
  - `memory/long-term/` is created
  - exactly one `Learning` file is written for the happy-path fixture
  - the `Learning` object has:
    - `object_kind = "learning"`
    - `identity_id = "research-agent"`
    - `source_episode_ids` containing the source `Episode` ids
  - a consolidate run summary is written under `runs/`

Use a mock-provider fixture first. The new test should fail because `consolidate` does not exist yet.

**Step 2: Run the tests to verify they fail**

Run:

```bash
npm --prefix projects/reve test
```

Expected: FAIL with an unknown command error or missing `long-term` output assertion.

**Step 3: Implement the minimal CLI and output path**

In [cli.ts](/Users/screamcart-agent0/obsidian-agent-memory-server/projects/reve/src/cli.ts):

- extend argument handling with `consolidate`
- add helpers to:
  - read `Episode` files from `memory/short-term/`
  - create `memory/long-term/`
  - write a minimal run summary for consolidate
- implement the smallest possible mock-only `Episode -> Learning` path that converts the seeded happy-path fixture into one `Learning`

Keep the implementation narrow:

- no lock file yet
- no idempotency yet
- no `drive` command yet

**Step 4: Re-run the tests**

Run:

```bash
npm --prefix projects/reve test
```

Expected: PASS for the new `consolidate` happy-path test and all existing tests.

**Step 5: Commit**

```bash
git add projects/reve/src/cli.ts projects/reve/test/reve.test.ts
git commit -m "feat: add basic reve consolidate command"
```

### Task 2: Define `Learning` object shape and real consolidation parsing

**Files:**
- Modify: `projects/reve/src/cli.ts`
- Modify: `projects/reve/test/reve.test.ts`
- Modify: `projects/reve/README.md`

**Step 1: Write the failing tests**

Add tests that assert the `Learning` object contains the approved minimum fields:

- `message_id`
- `identity_id`
- `object_kind`
- `object_ref`
- `source_episode_ids`
- `summary`
- `applicability`
- `failure_conditions`
- `evidence_refs`
- `confidence`
- `quality`
- `observed_at`
- `consolidation_run_id`

Also add a test for the zero-output case:

- a batch with weak `Episode` evidence should produce no `Learning`
- the run summary should record `no_learning = 1`

**Step 2: Run the tests to verify they fail**

Run:

```bash
npm --prefix projects/reve test
```

Expected: FAIL on missing fields and missing `no_learning` accounting.

**Step 3: Implement the minimal `Learning` schema and parser**

In [cli.ts](/Users/screamcart-agent0/obsidian-agent-memory-server/projects/reve/src/cli.ts):

- add a `DistilledLearning` type for model output
- add a `Learning` storage object type
- implement a mock consolidator that can emit:
  - `learning_created`
  - `no_learning`
  - `needs_more_evidence`
- add a real-provider consolidation prompt and parser using the same provider resolution pattern already used by `distill`

In [README.md](/Users/screamcart-agent0/obsidian-agent-memory-server/projects/reve/README.md):

- document the new `consolidate` command
- document that `Learning` is the only first-pass long-term output in MVP2

**Step 4: Re-run the tests**

Run:

```bash
npm --prefix projects/reve test
```

Expected: PASS with stable `Learning` fields and correct `no_learning` accounting.

**Step 5: Commit**

```bash
git add projects/reve/src/cli.ts projects/reve/test/reve.test.ts projects/reve/README.md
git commit -m "feat: define learning outputs for reve consolidation"
```

### Task 3: Add batch selection and `Episode` grouping rules

**Files:**
- Modify: `projects/reve/src/cli.ts`
- Modify: `projects/reve/test/reve.test.ts`

**Step 1: Write the failing tests**

Add tests for:

- `--limit` caps how many pending `Episode` files are scanned
- `--batch-size` splits inputs into fixed windows
- batches are processed in timestamp order
- a partial final batch is still processed

Use fixture data with 6-7 `Episode` objects so batch order is obvious.

**Step 2: Run the tests to verify they fail**

Run:

```bash
npm --prefix projects/reve test
```

Expected: FAIL on incorrect batch counts or output ordering.

**Step 3: Implement fixed-window batching**

In [cli.ts](/Users/screamcart-agent0/obsidian-agent-memory-server/projects/reve/src/cli.ts):

- add helpers to:
  - list `Episode` files in stable order
  - filter out already-promoted inputs later in the plan
  - slice batches by `batch-size`
- keep grouping simple:
  - timestamp order only
  - no topic clustering
  - no session-aware bucketing

Make batch stats visible in the consolidate run summary:

- `batches_scanned`
- `episodes_scanned`
- `learning_created`
- `no_learning`
- `needs_more_evidence`

**Step 4: Re-run the tests**

Run:

```bash
npm --prefix projects/reve test
```

Expected: PASS with deterministic batch ordering.

**Step 5: Commit**

```bash
git add projects/reve/src/cli.ts projects/reve/test/reve.test.ts
git commit -m "feat: add fixed-window batching for reve consolidation"
```

### Task 4: Add `Learning` idempotency and stable source fingerprints

**Files:**
- Modify: `projects/reve/src/cli.ts`
- Modify: `projects/reve/test/reve.test.ts`

**Step 1: Write the failing tests**

Add tests for:

- re-running `consolidate` with the same source `Episode` set does not create duplicate `Learning`
- the fingerprint is stable even if source files are read in different filesystem order
- a batch that produced `no_learning` can still be retried later if more `Episode` files are added

**Step 2: Run the tests to verify they fail**

Run:

```bash
npm --prefix projects/reve test
```

Expected: FAIL because duplicate `Learning` files are currently written or because retries are blocked incorrectly.

**Step 3: Implement source-set fingerprinting**

In [cli.ts](/Users/screamcart-agent0/obsidian-agent-memory-server/projects/reve/src/cli.ts):

- sort `source_episode_ids`
- derive a deterministic fingerprint from the sorted ids
- store the fingerprint on each `Learning`
- skip writing when an existing `Learning` already has the same fingerprint

Do not persist a separate “processed forever” marker for `no_learning`; keep retries possible when future evidence changes.

**Step 4: Re-run the tests**

Run:

```bash
npm --prefix projects/reve test
```

Expected: PASS with duplicate prevention only for already-created `Learning`.

**Step 5: Commit**

```bash
git add projects/reve/src/cli.ts projects/reve/test/reve.test.ts
git commit -m "feat: add learning idempotency to reve"
```

### Task 5: Add lock files and failure-safe run behavior

**Files:**
- Modify: `projects/reve/src/cli.ts`
- Modify: `projects/reve/test/reve.test.ts`

**Step 1: Write the failing tests**

Add tests for:

- `consolidate` exits cleanly when `runtime/locks/consolidate.lock` already exists
- `distill` and `consolidate` use separate lock paths
- if model parsing throws, no partial `Learning` file is left behind
- run summaries record failures and skip reasons explicitly

**Step 2: Run the tests to verify they fail**

Run:

```bash
npm --prefix projects/reve test
```

Expected: FAIL on missing lock behavior and partial-write protection.

**Step 3: Implement lock and rollback behavior**

In [cli.ts](/Users/screamcart-agent0/obsidian-agent-memory-server/projects/reve/src/cli.ts):

- create `agents/<agent_id>/runtime/locks/`
- add lock acquisition/release helpers for:
  - `distill.lock`
  - `consolidate.lock`
- make the command fail fast with a clear message when a lock exists
- ensure output files are only written after parsing and validation succeed
- record errors in run summaries without writing half-complete objects

Keep the lock simple:

- one file per command per agent
- no stale-PID recovery yet
- no shared scheduler semantics

**Step 4: Re-run the tests**

Run:

```bash
npm --prefix projects/reve test
```

Expected: PASS with no partial long-term writes on failure.

**Step 5: Commit**

```bash
git add projects/reve/src/cli.ts projects/reve/test/reve.test.ts
git commit -m "feat: add reve lock files and failure-safe runs"
```

### Task 6: Add the `drive` command and end-to-end offline flow

**Files:**
- Modify: `projects/reve/src/cli.ts`
- Modify: `projects/reve/test/reve.test.ts`
- Modify: `projects/reve/README.md`

**Step 1: Write the failing tests**

Add an end-to-end test that:

- seeds `raw_capture`
- runs `bin/reve drive --agent-id research-agent --limit 10 --batch-size 5`
- asserts that:
  - `Episode` files are created
  - `Learning` files are created
  - a `drive` run summary is written
  - re-running `drive` is idempotent for already-created outputs

**Step 2: Run the tests to verify they fail**

Run:

```bash
npm --prefix projects/reve test
```

Expected: FAIL because `drive` does not exist yet.

**Step 3: Implement the thin orchestrator**

In [cli.ts](/Users/screamcart-agent0/obsidian-agent-memory-server/projects/reve/src/cli.ts):

- add `drive`
- call the existing `distill` and `consolidate` handlers in sequence
- aggregate child command counts into one top-level summary

In [README.md](/Users/screamcart-agent0/obsidian-agent-memory-server/projects/reve/README.md):

- document:
  - `distill`
  - `consolidate`
  - `drive`
- document recommended manual evaluation flow:
  1. inspect `Episode`
  2. inspect `Learning`
  3. use `drive` for regression

**Step 4: Re-run the tests**

Run:

```bash
npm --prefix projects/reve test
```

Expected: PASS with stable end-to-end offline flow.

**Step 5: Commit**

```bash
git add projects/reve/src/cli.ts projects/reve/test/reve.test.ts projects/reve/README.md
git commit -m "feat: add reve offline drive workflow"
```

### Task 7: Run real-provider manual validation and capture the results

**Files:**
- Modify: `docs/research-memory.md`
- Modify: `projects/reve/README.md`

**Step 1: Prepare a real validation fixture**

Use existing agent data or manually create a small batch that includes:

- multiple `raw_capture`
- meaningful `evidence_refs`
- at least one batch that should produce `Learning`
- at least one batch that should produce `no_learning` or `needs_more_evidence`

**Step 2: Run the real commands**

Run:

```bash
bin/reve distill --agent-id research-agent --limit 10
bin/reve consolidate --agent-id research-agent --limit 10 --batch-size 5
bin/reve drive --agent-id research-agent --limit 10 --batch-size 5
```

Expected:

- commands exit `0`
- real provider metadata is visible in outputs
- `Learning` files are created only when evidence is strong enough

**Step 3: Record the evidence**

In [docs/research-memory.md](/Users/screamcart-agent0/obsidian-agent-memory-server/docs/research-memory.md):

- add one research log entry for:
  - real-provider `Episode` quality
  - real-provider `Learning` quality
  - any empty-output or over-generalization failures

In [README.md](/Users/screamcart-agent0/obsidian-agent-memory-server/projects/reve/README.md):

- add the validated command sequence for manual operator testing

**Step 4: Commit**

```bash
git add docs/research-memory.md projects/reve/README.md
git commit -m "docs: record reve offline validation workflow"
```

## Execution Notes

- Keep `projects/reve/src/cli.ts` readable. If command branching becomes hard to follow, extract small helpers before adding more behavior.
- Do not introduce a database, queue, embeddings, or background worker in this plan.
- Prefer failing closed for malformed consolidation output, but keep raw inputs untouched so the batch can be retried.
- Real-provider manual validation is required before claiming MVP2 is complete.
