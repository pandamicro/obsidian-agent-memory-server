import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createMemoryHookDriver } from '../driver.ts';
import { bindAgent, repoRoot, spawnAgents } from './helpers.ts';

test('Stop remains side-effect oriented and does not require additionalContext output', async () => {
  const sharedRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-stop-contract-shared-'));
  assert.equal(spawnAgents(['init', '--agent-id', 'research-agent'], sharedRoot).status, 0);
  assert.equal(
    spawnAgents(['run', '--agent-id', 'research-agent', '--input', 'seed stop contract'], sharedRoot).status,
    0,
  );

  const workspaceRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-stop-contract-workspace-'));
  await bindAgent(workspaceRoot, 'research-agent');
  const stateRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-stop-contract-state-'));
  const driver = createMemoryHookDriver({
    sourceRepoRoot: repoRoot,
    sharedRoot,
    stateRoot,
  });
  const rawCaptureDir = join(sharedRoot, 'agents', 'research-agent', 'memory', 'raw-capture');
  const beforeFiles = new Set((await readdir(rawCaptureDir)).sort());

  driver.handlePostToolUse({
    hook_event_name: 'PostToolUse',
    session_id: 'session-stop-contract',
    turn_id: 'turn-stop-contract',
    tool_name: 'Bash',
    tool_use_id: 'tool-stop-contract',
    cwd: workspaceRoot,
    tool_input: { command: 'echo contract' },
    tool_response: 'contract',
  });

  const stop = driver.handleStop({
    hook_event_name: 'Stop',
    session_id: 'session-stop-contract',
    turn_id: 'turn-stop-contract',
    cwd: workspaceRoot,
    last_assistant_message: 'Done.',
  });

  assert.equal(stop.continue, true);
  assert.equal(stop.hookSpecificOutput, undefined);

  const afterFiles = (await readdir(rawCaptureDir)).sort();
  assert.equal(afterFiles.length, beforeFiles.size + 1);
  const createdFile = afterFiles.find((file) => !beforeFiles.has(file));
  assert.ok(createdFile);
  const latestRawPath = join(rawCaptureDir, createdFile!);
  const rawCapture = JSON.parse(await readFile(latestRawPath, 'utf8')) as {
    source_kind?: string;
    session_id?: string | null;
    assistant_summary?: string | null;
    candidates?: Array<unknown>;
  };

  assert.equal(rawCapture.source_kind, 'hook_flush');
  assert.equal(rawCapture.session_id, 'session-stop-contract');
  assert.equal(rawCapture.assistant_summary, 'Done.');
  assert.equal((rawCapture.candidates ?? []).length > 0, true);
});
