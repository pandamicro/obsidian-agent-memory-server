import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createMemoryHookDriver } from '../driver.ts';
import { bindAgent } from './helpers.ts';

async function createFakeAgentsRepo(scriptBody: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'codex-hooks-fake-repo-'));
  const binDir = join(root, 'bin');
  const agentsPath = join(binDir, 'agents');
  await mkdir(binDir, { recursive: true });
  await writeFile(agentsPath, scriptBody, 'utf8');
  await chmod(agentsPath, 0o755);
  return root;
}

test('SessionStart degrades fail-open when agents verify times out', async () => {
  const fakeRepo = await createFakeAgentsRepo(`#!/bin/sh
cmd="$1"
if [ "$cmd" = "list" ]; then
  echo '[{"agent_id":"research-agent"}]'
  exit 0
fi
if [ "$cmd" = "verify" ]; then
  sleep 2
  exit 0
fi
exit 0
`);

  const sharedRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-timeout-shared-'));
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-timeout-workspace-'));
  const stateRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-timeout-state-'));
  await bindAgent(workspaceRoot, 'research-agent');

  const driver = createMemoryHookDriver({
    sourceRepoRoot: fakeRepo,
    sharedRoot,
    stateRoot,
    agentsTimeoutMs: 1000,
  });

  const response = driver.handleSessionStart({
    hook_event_name: 'SessionStart',
    session_id: 'session-timeout',
    cwd: workspaceRoot,
    source: 'startup',
  });

  assert.ok(response);
  assert.equal(response?.continue, true);
  assert.match(response?.systemMessage ?? '', /timed out/i);
});
