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

async function setupSharedAgents(agentIds: string[]) {
  const sharedRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-shared-multi-'));
  for (const agentId of agentIds) {
    assert.equal(spawnAgents(['init', '--agent-id', agentId], sharedRoot).status, 0);
    assert.equal(
      spawnAgents(['run', '--agent-id', agentId, '--input', `seed memory for ${agentId}`], sharedRoot).status,
      0,
    );
  }
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

test('SessionStart stays inert when no explicit agent binding exists', async () => {
  const sharedRoot = await setupSharedAgent();
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-unbound-workspace-'));
  const stateRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-unbound-state-'));
  const driver = createMemoryHookDriver({
    sourceRepoRoot: repoRoot,
    sharedRoot,
    stateRoot,
  });

  const response = driver.handleSessionStart({
    hook_event_name: 'SessionStart',
    session_id: 'session-unbound',
    cwd: workspaceRoot,
    source: 'startup',
  });

  assert.ok(response);
  assert.match(response?.systemMessage ?? '', /choose an agent identity/i);
  assert.match(response?.systemMessage ?? '', /0\. no identity/i);
  assert.match(response?.systemMessage ?? '', /not applicable agent identity/i);
});

test('UserPromptSubmit binds selected identity and keeps the remaining task in-band', async () => {
  const sharedRoot = await setupSharedAgents(['research-agent', 'unity-optimization-agent']);
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-select-workspace-'));
  const stateRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-select-state-'));
  const driver = createMemoryHookDriver({
    sourceRepoRoot: repoRoot,
    sharedRoot,
    stateRoot,
  });

  const response = driver.handleUserPromptSubmit({
    hook_event_name: 'UserPromptSubmit',
    session_id: 'session-select',
    turn_id: 'turn-select',
    cwd: workspaceRoot,
    prompt: '1 summarize what we know',
  });

  assert.ok(response);
  assert.match(response?.hookSpecificOutput?.additionalContext ?? '', /Mounted identity: research-agent/);
  assert.match(response?.systemMessage ?? '', /remaining request/i);
  assert.match(response?.systemMessage ?? '', /summarize what we know/i);
});

test('UserPromptSubmit accepts explicit no identity and keeps later turns inert', async () => {
  const sharedRoot = await setupSharedAgents(['research-agent']);
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-no-identity-workspace-'));
  const stateRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-no-identity-state-'));
  const driver = createMemoryHookDriver({
    sourceRepoRoot: repoRoot,
    sharedRoot,
    stateRoot,
  });

  const chooseNone = driver.handleUserPromptSubmit({
    hook_event_name: 'UserPromptSubmit',
    session_id: 'session-none',
    turn_id: 'turn-none-1',
    cwd: workspaceRoot,
    prompt: '0 draft the plan without agent identity',
  });

  assert.ok(chooseNone);
  assert.match(chooseNone?.systemMessage ?? '', /no identity/i);
  assert.match(chooseNone?.systemMessage ?? '', /draft the plan without agent identity/i);

  const laterPrompt = driver.handleUserPromptSubmit({
    hook_event_name: 'UserPromptSubmit',
    session_id: 'session-none',
    turn_id: 'turn-none-2',
    cwd: workspaceRoot,
    prompt: 'please summarize the memory',
  });

  assert.equal(laterPrompt, null);
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
