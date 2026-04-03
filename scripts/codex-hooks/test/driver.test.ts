import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createMemoryHookDriver } from '../driver.ts';
import { bindAgent, repoRoot, spawnAgents } from './helpers.ts';

async function setupSharedAgent() {
  const sharedRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-shared-'));
  assert.equal(spawnAgents(['init', '--agent-id', 'research-agent'], sharedRoot).status, 0);
  assert.equal(
    spawnAgents(['run', '--agent-id', 'research-agent', '--input', 'remember the contract rules'], sharedRoot).status,
    0,
  );
  return sharedRoot;
}

test('SessionStart loads the latest long-term summary', async () => {
  const sharedRoot = await setupSharedAgent();
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-workspace-'));
  await bindAgent(workspaceRoot, 'research-agent');

  const stateRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-state-'));
  const driver = createMemoryHookDriver({
    sourceRepoRoot: repoRoot,
    sharedRoot,
    stateRoot,
  });

  const response = driver.handleSessionStart({
    hook_event_name: 'SessionStart',
    session_id: 'session-1',
    cwd: workspaceRoot,
    source: 'startup',
  });

  assert.ok(response);
  assert.equal(response?.continue, true);
  assert.match(response?.hookSpecificOutput?.additionalContext ?? '', /research-agent/);
  assert.match(response?.hookSpecificOutput?.additionalContext ?? '', /Latest summary:/);
});

test('UserPromptSubmit refreshes memory on task-like prompts', async () => {
  const sharedRoot = await setupSharedAgent();
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-workspace-'));
  await bindAgent(workspaceRoot, 'research-agent');

  const stateRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-state-'));
  const driver = createMemoryHookDriver({
    sourceRepoRoot: repoRoot,
    sharedRoot,
    stateRoot,
  });

  const response = driver.handleUserPromptSubmit({
    hook_event_name: 'UserPromptSubmit',
    session_id: 'session-1',
    turn_id: 'turn-2',
    cwd: workspaceRoot,
    prompt: 'What do we know about the contract memory?',
  });

  assert.ok(response);
  assert.match(response?.hookSpecificOutput?.additionalContext ?? '', /research-agent/);
  assert.match(response?.hookSpecificOutput?.additionalContext ?? '', /Latest long-term ref:/);
});

test('Stop flushes pending candidates into the shared long-term store', async () => {
  const sharedRoot = await setupSharedAgent();
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-workspace-'));
  await bindAgent(workspaceRoot, 'research-agent');

  const stateRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-state-'));
  const driver = createMemoryHookDriver({
    sourceRepoRoot: repoRoot,
    sharedRoot,
    stateRoot,
  });

  const beforeFiles = await readdir(join(sharedRoot, 'agents', 'research-agent', 'memory', 'long-term'));

  const postResponse = driver.handlePostToolUse({
    hook_event_name: 'PostToolUse',
    session_id: 'session-1',
    turn_id: 'turn-3',
    tool_name: 'Bash',
    tool_use_id: 'tool-1',
    cwd: workspaceRoot,
    tool_input: { command: 'echo hello' },
    tool_response: 'hello',
  });

  assert.ok(postResponse);

  const stopResponse = driver.handleStop({
    hook_event_name: 'Stop',
    session_id: 'session-1',
    turn_id: 'turn-3',
    cwd: workspaceRoot,
    last_assistant_message: 'Done for now.',
  });

  assert.equal(stopResponse.continue, true);

  const afterFiles = await readdir(join(sharedRoot, 'agents', 'research-agent', 'memory', 'long-term'));
  assert.equal(afterFiles.length, beforeFiles.length + 1);
});

test('duplicate hook events are ignored after the first processing pass', async () => {
  const sharedRoot = await setupSharedAgent();
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-workspace-'));
  await bindAgent(workspaceRoot, 'research-agent');

  const stateRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-state-'));
  const driver = createMemoryHookDriver({
    sourceRepoRoot: repoRoot,
    sharedRoot,
    stateRoot,
  });

  const input = {
    hook_event_name: 'PostToolUse' as const,
    session_id: 'session-dup',
    turn_id: 'turn-dup',
    tool_name: 'Bash' as const,
    tool_use_id: 'tool-dup',
    cwd: workspaceRoot,
    tool_input: { command: 'echo duplicate' },
    tool_response: 'duplicate',
  };

  const first = driver.handlePostToolUse(input);
  const second = driver.handlePostToolUse(input);

  assert.ok(first);
  assert.equal(second, null);
});
