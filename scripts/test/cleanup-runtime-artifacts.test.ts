import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const scriptPath = resolve('scripts/cleanup-runtime-artifacts.sh');

async function setupRepo() {
  const repoRoot = await mkdtemp(join(tmpdir(), 'cleanup-runtime-repo-'));
  await execFileAsync('git', ['init', '-q'], { cwd: repoRoot });
  await execFileAsync('git', ['config', 'user.email', 'cleanup@example.com'], { cwd: repoRoot });
  await execFileAsync('git', ['config', 'user.name', 'Cleanup Test'], { cwd: repoRoot });

  await mkdir(join(repoRoot, 'agents', 'research-agent', 'memory', 'short-term'), { recursive: true });
  await mkdir(join(repoRoot, 'agents', 'research-agent', 'memory', 'long-term'), { recursive: true });
  await mkdir(join(repoRoot, 'agents', 'research-agent', 'runs'), { recursive: true });
  await mkdir(join(repoRoot, 'agents', 'unity-optimization-agent', 'memory', 'long-term'), { recursive: true });

  await writeFile(join(repoRoot, 'agents', 'research-agent', 'memory', 'short-term', '.gitkeep'), '', 'utf8');
  await writeFile(join(repoRoot, 'agents', 'research-agent', 'memory', 'long-term', '.gitkeep'), '', 'utf8');
  await writeFile(join(repoRoot, 'agents', 'research-agent', 'runs', '.gitkeep'), '', 'utf8');
  await writeFile(
    join(repoRoot, 'agents', 'unity-optimization-agent', 'memory', 'long-term', 'seed.json'),
    '{"seed":true}\n',
    'utf8',
  );

  await execFileAsync(
    'git',
    ['add', '.'],
    { cwd: repoRoot },
  );
  await execFileAsync('git', ['commit', '-qm', 'seed tracked runtime files'], { cwd: repoRoot });

  const generatedShortTerm = join(repoRoot, 'agents', 'research-agent', 'memory', 'short-term', 'generated.json');
  const generatedLongTerm = join(repoRoot, 'agents', 'research-agent', 'memory', 'long-term', 'generated.json');
  const generatedRun = join(repoRoot, 'agents', 'research-agent', 'runs', 'generated.json');

  await writeFile(generatedShortTerm, '{"runtime":true}\n', 'utf8');
  await writeFile(generatedLongTerm, '{"runtime":true}\n', 'utf8');
  await writeFile(generatedRun, '{"runtime":true}\n', 'utf8');

  return {
    repoRoot,
    generatedShortTerm,
    generatedLongTerm,
    generatedRun,
    trackedSeed: join(repoRoot, 'agents', 'unity-optimization-agent', 'memory', 'long-term', 'seed.json'),
  };
}

test('cleanup-runtime-artifacts dry-run reports untracked runtime files without deleting them', async () => {
  const setup = await setupRepo();

  const result = await execFileAsync(scriptPath, ['--repo-root', setup.repoRoot], {
    cwd: setup.repoRoot,
  });

  assert.match(result.stdout, /Dry run/);
  assert.match(result.stdout, /generated\.json/);
  assert.equal(await readFile(setup.generatedShortTerm, 'utf8'), '{"runtime":true}\n');
  assert.equal(await readFile(setup.trackedSeed, 'utf8'), '{"seed":true}\n');
});

test('cleanup-runtime-artifacts --apply removes only untracked runtime files', async () => {
  const setup = await setupRepo();

  const result = await execFileAsync(scriptPath, ['--repo-root', setup.repoRoot, '--apply'], {
    cwd: setup.repoRoot,
  });

  assert.match(result.stdout, /Removed 3 runtime artifact/);
  await assert.rejects(readFile(setup.generatedShortTerm, 'utf8'));
  await assert.rejects(readFile(setup.generatedLongTerm, 'utf8'));
  await assert.rejects(readFile(setup.generatedRun, 'utf8'));
  assert.equal(await readFile(setup.trackedSeed, 'utf8'), '{"seed":true}\n');

  await rm(setup.repoRoot, { recursive: true, force: true });
});
