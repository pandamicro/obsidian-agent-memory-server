# Reve MVP3 Episode Quality Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve `raw_capture -> Episode` quality in `projects/reve` by adding raw-capture anchors, cheap prefiltering, selective context hydration, and a conservative distill prompt.

**Architecture:** Keep `raw_capture` lightweight and add only lookup anchors. In `reve distill`, first reject obviously low-value inputs without model work, then hydrate only candidate inputs through a backend-agnostic `ContextHydrator`, and finally run a stricter distill prompt that treats rejection as the default valid outcome. Preserve graceful fallback so hydration failure degrades to raw-only distill rather than aborting the run.

**Tech Stack:** Node.js 24, TypeScript via `--experimental-strip-types`, file-based agent memory layout, Node test runner, local Codex rollout files as the first hydration adapter.

---

### Task 1: Add raw-capture anchor fields for later hydration

**Files:**
- Modify: `projects/cli/src/cli.ts`
- Modify: `projects/cli/test/cli.test.ts`
- Modify: `scripts/codex-hooks/contracts.ts`
- Modify: `scripts/codex-hooks/driver.ts`

**Step 1: Write the failing tests**

Add tests that assert newly written `raw_capture` objects persist anchor fields:

```ts
assert.equal(rawCaptureEvent.session_id, 'session-123');
assert.equal(rawCaptureEvent.thread_id, 'thread-456');
assert.equal(rawCaptureEvent.turn_id, 'turn-789');
assert.equal(rawCaptureEvent.event, 'direct-input');
assert.equal(rawCaptureEvent.workspace_root, workspaceRoot);
```

Also add a hook-envelope-focused assertion:

```ts
assert.equal(envelope.thread_id, 'thread-456');
assert.equal(envelope.turn_id, 'turn-789');
```

**Step 2: Run tests to verify they fail**

Run:

```bash
npm --prefix projects/cli test
```

Expected: FAIL because the new fields are not yet emitted or persisted.

**Step 3: Write the minimal implementation**

Update the CLI parser and writer so direct input and hook-derived raw captures emit:

```ts
thread_id: parsedInput.thread_id ?? null,
turn_id: parsedInput.turn_id ?? null,
event: parsedInput.event ?? 'direct-input',
workspace_root: workspaceRoot,
```

Update hook contracts and driver so the normalized envelope always carries `thread_id` / `turn_id` when available and writes a stable event label into the raw-capture payload.

**Step 4: Run tests to verify they pass**

Run:

```bash
npm --prefix projects/cli test
```

Expected: PASS, including the new raw-capture field assertions.

**Step 5: Commit**

```bash
git add projects/cli/src/cli.ts projects/cli/test/cli.test.ts scripts/codex-hooks/contracts.ts scripts/codex-hooks/driver.ts
git commit -m "feat: add raw capture anchors for hydration"
```

### Task 2: Add distill prefilter with explicit rejection reasons

**Files:**
- Modify: `projects/reve/src/cli.ts`
- Modify: `projects/reve/test/reve.test.ts`

**Step 1: Write the failing tests**

Add tests that cover:

- direct-input raw capture with no anchors and no outcome signal is rejected before provider work
- run summary records prefilter counts

Example assertions:

```ts
assert.match(result.stdout, /Distilled short-term records: 0/);
assert.equal(runSummary.prefilter_rejected, 1);
assert.equal(runSummary.rejected_low_signal, 1);
```

If using the local test responses server, also assert it received zero requests for prefilter-rejected input.

**Step 2: Run tests to verify they fail**

Run:

```bash
npm --prefix projects/reve test
```

Expected: FAIL because `distill` currently sends every pending raw capture directly into model distillation.

**Step 3: Write the minimal implementation**

Add a prefilter stage in `handleDistill` or a small helper near `distillRawCapture`:

```ts
type PrefilterResult =
  | { decision: 'reject'; reason: 'low_signal' | 'missing_anchor' }
  | { decision: 'candidate'; hydration: 'raw_only' | 'needs_hydration' };
```

Implement the first-pass rules from the design:

- reject empty or trivial direct input
- reject records missing both reusable summary and hydration anchors
- allow hook flush or anchored records into the candidate pool

Write rejection counts into the distill run summary.

**Step 4: Run tests to verify they pass**

Run:

```bash
npm --prefix projects/reve test
```

Expected: PASS with new prefilter coverage.

**Step 5: Commit**

```bash
git add projects/reve/src/cli.ts projects/reve/test/reve.test.ts
git commit -m "feat: add reve distill prefilter"
```

### Task 3: Add backend-agnostic context hydrator and Codex rollout adapter

**Files:**
- Create: `projects/reve/src/context-hydrator.ts`
- Create: `projects/reve/src/codex-rollout-hydrator.ts`
- Modify: `projects/reve/src/cli.ts`
- Modify: `projects/reve/test/reve.test.ts`

**Step 1: Write the failing tests**

Add tests for:

- `ContextHydrator` returns `unavailable` when rollout lookup fails
- Codex rollout adapter can build a minimal context bundle from `thread_id` + `turn_id`
- `distill` falls back to raw-only when hydration is unavailable instead of failing the command

Example assertions:

```ts
assert.equal(hydration.status, 'success');
assert.match(hydration.context_window.assistant_summary ?? '', /license/i);
assert.equal(runSummary.hydration_attempted, 1);
assert.equal(runSummary.hydration_unavailable, 1);
```

Use temp files to simulate:

- a small `state_5.sqlite` lookup stub or injected lookup function
- a tiny `rollout-*.jsonl` fixture with user/assistant/tool events

**Step 2: Run tests to verify they fail**

Run:

```bash
npm --prefix projects/reve test
```

Expected: FAIL because no hydrator abstraction or rollout reader exists yet.

**Step 3: Write the minimal implementation**

Introduce a narrow abstraction:

```ts
export type HydrationResult =
  | { status: 'success'; context_window: HydratedContext; evidence_refs: string[] }
  | { status: 'unavailable'; reason: string };
```

Add a `CodexRolloutHydrator` that:

- resolves `rollout_path` from thread/session lookup
- reads the rollout JSONL file
- slices a minimal window around the target turn/event
- returns only a compact evidence bundle

Wire `handleDistill` so only `candidate_needs_hydration` records call the hydrator.

**Step 4: Run tests to verify they pass**

Run:

```bash
npm --prefix projects/reve test
```

Expected: PASS with successful hydration and fallback coverage.

**Step 5: Commit**

```bash
git add projects/reve/src/context-hydrator.ts projects/reve/src/codex-rollout-hydrator.ts projects/reve/src/cli.ts projects/reve/test/reve.test.ts
git commit -m "feat: add reve context hydration"
```

### Task 4: Tighten distill prompt and output schema for conservative episode creation

**Files:**
- Modify: `projects/reve/src/cli.ts`
- Modify: `projects/reve/test/reve.test.ts`

**Step 1: Write the failing tests**

Add tests that assert the provider request body contains the stricter prompt and response schema:

```ts
assert.match(JSON.stringify(requestBody), /most raw_capture records should be rejected/i);
assert.deepEqual(schema.required, ['status', 'reason', 'episode']);
```

Add tests for new result categories:

```ts
assert.equal(episode.quality.status, 'rejected');
assert.match(episode.parser_reason, /insufficient_context|multi_signal/);
```

**Step 2: Run tests to verify they fail**

Run:

```bash
npm --prefix projects/reve test
```

Expected: FAIL because the current prompt is still biased toward producing short-term summaries and does not expose the new output categories.

**Step 3: Write the minimal implementation**

Update the distill prompt so it explicitly says:

- rejection is the correct default outcome
- lack of reusable outcome or evidence should fail
- multi-signal inputs should fail instead of being merged

Update the provider response schema to emit a top-level result object similar to:

```ts
{
  status: 'episode_created' | 'rejected_low_signal' | 'rejected_insufficient_context' | 'rejected_multi_signal' | 'rejected_no_reusable_outcome',
  reason: string,
  episode: Episode | null
}
```

Map these outputs into stored episode records and run summary counters.

**Step 4: Run tests to verify they pass**

Run:

```bash
npm --prefix projects/reve test
```

Expected: PASS, including request-body schema assertions.

**Step 5: Commit**

```bash
git add projects/reve/src/cli.ts projects/reve/test/reve.test.ts
git commit -m "feat: tighten reve distill prompt"
```

### Task 5: Expand distill run summaries and operator-facing docs

**Files:**
- Modify: `projects/reve/src/cli.ts`
- Modify: `projects/reve/test/reve.test.ts`
- Modify: `projects/reve/README.md`
- Modify: `docs/research-memory.md`

**Step 1: Write the failing tests**

Add or extend tests so run summaries must include:

```ts
assert.equal(runSummary.hydration_attempted, 1);
assert.equal(runSummary.episodes_created_hydrated, 1);
assert.equal(runSummary.rejected_multi_signal, 0);
```

**Step 2: Run tests to verify they fail**

Run:

```bash
npm --prefix projects/reve test
```

Expected: FAIL because these counters are not yet persisted consistently.

**Step 3: Write the minimal implementation**

Update run summary serialization and CLI output text to include:

- prefilter counts
- hydration counts
- raw-only vs hydrated episode counts
- rejection reason counts

Update `projects/reve/README.md` with operator guidance for:

- when rejection-heavy runs are healthy
- how to inspect hydration failures
- how to interpret `episode_created_raw_only` vs `episode_created_hydrated`

Append a research-memory entry with real-sample validation notes once the implementation is exercised.

**Step 4: Run tests to verify they pass**

Run:

```bash
npm --prefix projects/reve test
```

Expected: PASS with the new summary fields.

**Step 5: Commit**

```bash
git add projects/reve/src/cli.ts projects/reve/test/reve.test.ts projects/reve/README.md docs/research-memory.md
git commit -m "docs: record reve mvp3 distill evaluation"
```

### Task 6: Run real-provider validation on representative agent data

**Files:**
- Modify: `docs/research-memory.md`
- Modify: `projects/reve/README.md`

**Step 1: Prepare the validation fixtures**

Use isolated temp roots built from real agent data:

- `research-agent`
- `unity-optimization-agent`

Copy only:

- `identity/`
- `memory/raw-capture/`

Do not copy pre-existing `short-term` or `long-term`.

**Step 2: Run real validation**

Run:

```bash
./bin/reve distill --agent-id research-agent --limit 20
./bin/reve distill --agent-id unity-optimization-agent --limit 20
```

Expected:

- some inputs are rejected before provider work
- hydrated episode quality is higher than raw-only direct-input output
- no command-level failure when hydration is unavailable

**Step 3: Inspect the outputs**

Check:

- `agents/<id>/memory/short-term/`
- `agents/<id>/runs/`

Look for:

- rejection ratios
- evidence ref quality
- reduction in multi-signal episodes

**Step 4: Record findings**

Append a research-memory entry that distinguishes:

- verified improvements
- remaining weaknesses
- assumptions that still need evidence

Update `projects/reve/README.md` if the operator workflow changed during validation.

**Step 5: Commit**

```bash
git add docs/research-memory.md projects/reve/README.md
git commit -m "docs: record reve mvp3 validation findings"
```
