import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
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
});
