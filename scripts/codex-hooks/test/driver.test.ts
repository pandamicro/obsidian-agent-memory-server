import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createMemoryHookDriver } from '../driver.ts';
import { getHookLogPath } from '../state.ts';
import { bindAgent, repoRoot, spawnAgents } from './helpers.ts';

async function countLongTermFiles(sharedRoot: string): Promise<number> {
  try {
    const files = await readdir(join(sharedRoot, 'agents', 'research-agent', 'memory', 'long-term'));
    return files.length;
  } catch (error) {
    const typed = error as NodeJS.ErrnoException;
    if (typed.code === 'ENOENT') {
      return 0;
    }
    throw error;
  }
}

async function setupSharedAgent() {
  const sharedRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-shared-'));
  assert.equal(spawnAgents(['init', '--agent-id', 'research-agent'], sharedRoot).status, 0);
  assert.equal(
    spawnAgents(['run', '--agent-id', 'research-agent', '--input', 'remember the contract rules'], sharedRoot).status,
    0,
  );
  assert.equal(
    spawnAgents(
      ['distill', '--agent-id', 'research-agent', '--limit', '10'],
      sharedRoot,
      { OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_PROVIDER: 'mock' },
    ).status,
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
    assert.equal(
      spawnAgents(
        ['distill', '--agent-id', agentId, '--limit', '10'],
        sharedRoot,
        { OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_PROVIDER: 'mock' },
      ).status,
      0,
    );
  }
  return sharedRoot;
}

test('SessionStart loads the latest short-term summary', async () => {
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
  assert.match(response?.hookSpecificOutput?.additionalContext ?? '', /Latest short-term ref:/);
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

  assert.equal(response, null);
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

test('UserPromptSubmit auto-mounts when strict specialization match is unique', async () => {
  const sharedRoot = await setupSharedAgents(['research-agent', 'unity-optimization-agent']);
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-auto-match-workspace-'));
  const stateRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-auto-match-state-'));
  const driver = createMemoryHookDriver({
    sourceRepoRoot: repoRoot,
    sharedRoot,
    stateRoot,
  });

  const response = driver.handleUserPromptSubmit({
    hook_event_name: 'UserPromptSubmit',
    session_id: 'session-auto-match',
    turn_id: 'turn-auto-match',
    cwd: workspaceRoot,
    prompt: 'Please investigate and research evidence for the best approach',
  });

  assert.ok(response);
  assert.match(response?.systemMessage ?? '', /auto-mounted identity research-agent/i);
  assert.match(response?.hookSpecificOutput?.additionalContext ?? '', /Mounted identity: research-agent/);
  assert.match(response?.hookSpecificOutput?.additionalContext ?? '', /strict match/i);
});

test('UserPromptSubmit keeps no-mount when strict match is ambiguous', async () => {
  const sharedRoot = await setupSharedAgents(['research-agent', 'unity-optimization-agent']);
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-auto-ambiguous-workspace-'));
  const stateRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-auto-ambiguous-state-'));
  const driver = createMemoryHookDriver({
    sourceRepoRoot: repoRoot,
    sharedRoot,
    stateRoot,
  });

  const response = driver.handleUserPromptSubmit({
    hook_event_name: 'UserPromptSubmit',
    session_id: 'session-auto-ambiguous',
    turn_id: 'turn-auto-ambiguous',
    cwd: workspaceRoot,
    prompt: 'Need research on Unity profiler GC allocation spikes and optimization options',
  });

  assert.equal(response, null);
});

test('Stop remains short-term-only and does not write long-term objects', async () => {
  const sharedRoot = await setupSharedAgent();
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-workspace-'));
  await bindAgent(workspaceRoot, 'research-agent');

  const stateRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-state-'));
  const driver = createMemoryHookDriver({
    sourceRepoRoot: repoRoot,
    sharedRoot,
    stateRoot,
  });

  const beforeFileCount = await countLongTermFiles(sharedRoot);

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

  const afterFileCount = await countLongTermFiles(sharedRoot);
  assert.equal(afterFileCount, beforeFileCount);
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

test('same event/session/turn is deduped even when tool_use_id differs', async () => {
  const sharedRoot = await setupSharedAgent();
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-workspace-dedupe-turn-'));
  await bindAgent(workspaceRoot, 'research-agent');

  const stateRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-state-dedupe-turn-'));
  const driver = createMemoryHookDriver({
    sourceRepoRoot: repoRoot,
    sharedRoot,
    stateRoot,
  });

  const first = driver.handlePostToolUse({
    hook_event_name: 'PostToolUse',
    session_id: 'session-dedupe-turn',
    turn_id: 'turn-9',
    tool_name: 'Bash',
    tool_use_id: 'tool-a',
    cwd: workspaceRoot,
    tool_input: { command: 'echo first' },
    tool_response: 'ok',
  });

  const second = driver.handlePostToolUse({
    hook_event_name: 'PostToolUse',
    session_id: 'session-dedupe-turn',
    turn_id: 'turn-9',
    tool_name: 'Bash',
    tool_use_id: 'tool-b',
    cwd: workspaceRoot,
    tool_input: { command: 'echo second' },
    tool_response: 'ok',
  });

  assert.ok(first);
  assert.equal(second, null);
});

test('SessionStart emits machine-level observability log entries', async () => {
  const sharedRoot = await setupSharedAgent();
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-log-workspace-'));
  await bindAgent(workspaceRoot, 'research-agent');

  const stateRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-log-state-'));
  const driver = createMemoryHookDriver({
    sourceRepoRoot: repoRoot,
    sharedRoot,
    stateRoot,
  });

  const response = driver.handleSessionStart({
    hook_event_name: 'SessionStart',
    session_id: 'session-log',
    cwd: workspaceRoot,
    source: 'startup',
  });

  assert.ok(response);
  const content = await readFile(getHookLogPath(stateRoot), 'utf8');
  assert.match(content, /"event":"session-start"/);
  assert.match(content, /"phase":"received"/);
});
