import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createMemoryHookDriver } from '../driver.ts';
import { bindAgent, repoRoot, spawnAgents } from './helpers.ts';

async function setupDriver() {
  const sharedRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-adapter-shared-'));
  assert.equal(spawnAgents(['init', '--agent-id', 'research-agent'], sharedRoot).status, 0);
  assert.equal(
    spawnAgents(['run', '--agent-id', 'research-agent', '--input', 'seed memory for adapters'], sharedRoot).status,
    0,
  );

  const workspaceRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-adapter-workspace-'));
  await bindAgent(workspaceRoot, 'research-agent');
  const stateRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-adapter-state-'));
  const driver = createMemoryHookDriver({
    sourceRepoRoot: repoRoot,
    sharedRoot,
    stateRoot,
  });

  return { driver, sharedRoot, workspaceRoot, stateRoot };
}

test('PreToolUse blocks obviously destructive Bash commands', async () => {
  const { driver, workspaceRoot } = await setupDriver();

  const response = driver.handlePreToolUse({
    hook_event_name: 'PreToolUse',
    session_id: 'session-pre',
    turn_id: 'turn-pre',
    tool_name: 'Bash',
    tool_use_id: 'tool-pre',
    cwd: workspaceRoot,
    tool_input: { command: 'rm -rf /' },
  });

  assert.ok(response);
  assert.equal(response?.hookSpecificOutput?.permissionDecision, 'deny');
  assert.match(response?.hookSpecificOutput?.permissionDecisionReason ?? '', /refusing/);
});

test('PostToolUse records Bash evidence for later flush', async () => {
  const { driver, workspaceRoot, stateRoot } = await setupDriver();

  const response = driver.handlePostToolUse({
    hook_event_name: 'PostToolUse',
    session_id: 'session-post',
    turn_id: 'turn-post',
    tool_name: 'Bash',
    tool_use_id: 'tool-post',
    cwd: workspaceRoot,
    tool_input: { command: 'echo hello' },
    tool_response: 'hello world',
  });

  assert.ok(response);
  assert.match(response?.hookSpecificOutput?.additionalContext ?? '', /Captured Bash evidence/);

  const statePath = join(stateRoot, 'workspaces');
  const workspaceDirs = await readdir(statePath);
  assert.equal(workspaceDirs.length, 1);
});

test('SessionStart and UserPromptSubmit produce memory context when bound', async () => {
  const { driver, workspaceRoot } = await setupDriver();

  const sessionResponse = driver.handleSessionStart({
    hook_event_name: 'SessionStart',
    session_id: 'session-bound',
    cwd: workspaceRoot,
    source: 'startup',
  });

  assert.ok(sessionResponse);
  assert.match(sessionResponse?.hookSpecificOutput?.additionalContext ?? '', /research-agent/);

  const promptResponse = driver.handleUserPromptSubmit({
    hook_event_name: 'UserPromptSubmit',
    session_id: 'session-bound',
    turn_id: 'turn-bound',
    cwd: workspaceRoot,
    prompt: 'please summarize the memory',
  });

  assert.ok(promptResponse);
  assert.match(promptResponse?.hookSpecificOutput?.additionalContext ?? '', /Latest summary:/);
});

