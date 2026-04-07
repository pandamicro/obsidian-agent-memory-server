import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { isDerivedSignalsEnabled } from '../contracts.ts';
import { createMemoryHookDriver } from '../driver.ts';
import { bindAgent, repoRoot, spawnAgents } from './helpers.ts';

test('derived signals env defaults to disabled and supports explicit opt-in tokens', () => {
  assert.equal(isDerivedSignalsEnabled({}), false);
  assert.equal(isDerivedSignalsEnabled({ OBSIDIAN_AGENT_MEMORY_SERVER_HOOK_DERIVED_SIGNALS: '0' }), false);
  assert.equal(isDerivedSignalsEnabled({ OBSIDIAN_AGENT_MEMORY_SERVER_HOOK_DERIVED_SIGNALS: '1' }), true);
  assert.equal(isDerivedSignalsEnabled({ OBSIDIAN_AGENT_MEMORY_SERVER_HOOK_DERIVED_SIGNALS: 'true' }), true);
  assert.equal(isDerivedSignalsEnabled({ OBSIDIAN_AGENT_MEMORY_SERVER_HOOK_DERIVED_SIGNALS: 'on' }), true);
});

test('enabling derived signals does not change native memory refresh path in MVP', async () => {
  const prev = process.env.OBSIDIAN_AGENT_MEMORY_SERVER_HOOK_DERIVED_SIGNALS;
  process.env.OBSIDIAN_AGENT_MEMORY_SERVER_HOOK_DERIVED_SIGNALS = '1';

  try {
    const sharedRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-derived-shared-'));
    assert.equal(spawnAgents(['init', '--agent-id', 'research-agent'], sharedRoot).status, 0);
    assert.equal(
      spawnAgents(['run', '--agent-id', 'research-agent', '--input', 'seed derived toggle test'], sharedRoot).status,
      0,
    );

    const workspaceRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-derived-workspace-'));
    await bindAgent(workspaceRoot, 'research-agent');
    const stateRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-derived-state-'));
    const driver = createMemoryHookDriver({
      sourceRepoRoot: repoRoot,
      sharedRoot,
      stateRoot,
    });

    const response = driver.handleUserPromptSubmit({
      hook_event_name: 'UserPromptSubmit',
      session_id: 'session-derived',
      turn_id: 'turn-derived',
      cwd: workspaceRoot,
      prompt: 'please summarize the memory context',
    });

    assert.ok(response);
    assert.match(response?.hookSpecificOutput?.additionalContext ?? '', /Mounted identity: research-agent/);
  } finally {
    if (prev === undefined) {
      delete process.env.OBSIDIAN_AGENT_MEMORY_SERVER_HOOK_DERIVED_SIGNALS;
    } else {
      process.env.OBSIDIAN_AGENT_MEMORY_SERVER_HOOK_DERIVED_SIGNALS = prev;
    }
  }
});
