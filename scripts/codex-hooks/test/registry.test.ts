import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import test from 'node:test';

const registryPath = resolve(fileURLToPath(new URL('../../../.codex/hooks.json', import.meta.url)));

test('Codex hooks registry exposes the expected events', () => {
  const parsed = JSON.parse(readFileSync(registryPath, 'utf8')) as {
    hooks: Record<string, unknown>;
  };

  assert.deepEqual(Object.keys(parsed.hooks).sort(), [
    'SessionStart',
    'Stop',
    'UserPromptSubmit',
  ]);

  const sessionStart = (parsed.hooks.SessionStart as Array<{ matcher?: string; hooks: Array<{ command: string }> }>)[0];
  assert.equal(sessionStart.matcher, 'startup|resume');
  assert.match(sessionStart.hooks[0]!.command, /scripts\/codex-hooks\/session-start\.ts/);

  const stop = (parsed.hooks.Stop as Array<{ hooks: Array<{ command: string }> }>)[0];
  assert.match(stop.hooks[0]!.command, /scripts\/codex-hooks\/stop\.ts/);
});
