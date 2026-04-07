import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const installScript = join(repoRoot, 'scripts', 'codex-hooks', 'install-hooks.sh');

function runInstall(args: string[], homeDir: string) {
  return spawnSync(installScript, args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      HOME: homeDir,
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

test('install-hooks installs machine-level registry to HOME/.codex/hooks.json', async () => {
  const homeDir = await mkdtemp(join(tmpdir(), 'codex-hooks-home-'));
  const result = runInstall([], homeDir);
  assert.equal(result.status, 0, result.stderr);

  const installed = await readFile(join(homeDir, '.codex', 'hooks.json'), 'utf8');
  assert.match(installed, /"SessionStart"/);
  assert.match(result.stdout, /Installed Codex hooks registry/);
});

test('install-hooks detects workspace repo-local hooks conflict unless --force is set', async () => {
  const homeDir = await mkdtemp(join(tmpdir(), 'codex-hooks-home-conflict-'));
  const workspace = await mkdtemp(join(tmpdir(), 'codex-hooks-workspace-conflict-'));
  await mkdir(join(workspace, '.codex'), { recursive: true });
  await writeFile(join(workspace, '.codex', 'hooks.json'), '{"hooks":{}}', 'utf8');

  const blocked = runInstall(['--workspace', workspace], homeDir);
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /dual-active hook registries/i);

  const forced = runInstall(['--workspace', workspace, '--force'], homeDir);
  assert.equal(forced.status, 0, forced.stderr);
  assert.match(forced.stdout, /Installed Codex hooks registry/);
});
