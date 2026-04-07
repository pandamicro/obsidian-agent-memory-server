import assert from 'node:assert/strict';
import { chmod, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { createMemoryHookDriver } from '../driver.ts';
import { bindAgent } from './helpers.ts';

const repoRoot = resolve(fileURLToPath(new URL('../../../', import.meta.url)));

async function createFailingVerifyRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'codex-hooks-fail-verify-repo-'));
  const binDir = join(root, 'bin');
  const agentsPath = join(binDir, 'agents');
  await mkdir(binDir, { recursive: true });
  await writeFile(
    agentsPath,
    `#!/bin/sh
cmd="$1"
if [ "$cmd" = "list" ]; then
  echo '[{"agent_id":"research-agent"}]'
  exit 0
fi
if [ "$cmd" = "verify" ]; then
  echo "verify failed" >&2
  exit 11
fi
exec "${repoRoot}/bin/agents" "$@"
`,
    'utf8',
  );
  await chmod(agentsPath, 0o755);
  return root;
}

test('UserPromptSubmit suppresses repeated verify failures after first surfaced error', async () => {
  const sourceRepoRoot = await createFailingVerifyRepo();
  const sharedRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-fail-shared-'));
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-fail-workspace-'));
  const stateRoot = await mkdtemp(join(tmpdir(), 'codex-hooks-fail-state-'));
  await bindAgent(workspaceRoot, 'research-agent');

  const driver = createMemoryHookDriver({
    sourceRepoRoot,
    sharedRoot,
    stateRoot,
  });

  const first = driver.handleUserPromptSubmit({
    hook_event_name: 'UserPromptSubmit',
    session_id: 'session-fail',
    turn_id: 'turn-1',
    cwd: workspaceRoot,
    prompt: 'please summarize memory context',
  });

  assert.ok(first);
  assert.match(first?.systemMessage ?? '', /memory verify failed/i);

  const second = driver.handleUserPromptSubmit({
    hook_event_name: 'UserPromptSubmit',
    session_id: 'session-fail',
    turn_id: 'turn-2',
    cwd: workspaceRoot,
    prompt: 'please summarize memory context again',
  });

  assert.ok(second);
  assert.equal(second?.continue, true);
  assert.equal(second?.systemMessage, undefined);
});
