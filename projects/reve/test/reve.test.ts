import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const revePath = resolve(fileURLToPath(new URL('../src/cli.ts', import.meta.url)));
const launcherPath = resolve(fileURLToPath(new URL('../../../bin/agents', import.meta.url)));

async function runReve(args: string[], cwd: string, env: NodeJS.ProcessEnv = {}) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolvePromise) => {
    const child = spawn(process.execPath, ['--experimental-strip-types', revePath, ...args], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('close', (code) => {
      resolvePromise({ code, stdout, stderr });
    });
  });
}

async function runLauncher(args: string[], cwd: string, env: NodeJS.ProcessEnv = {}) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolvePromise) => {
    const child = spawn(launcherPath, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('close', (code) => {
      resolvePromise({ code, stdout, stderr });
    });
  });
}

test('distill converts pending raw-capture records into short-term memory via mock model', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-reve-distill-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-reve-shared-'));
  const sharedEnv = {
    OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
  };
  assert.equal((await runLauncher(['init', '--agent-id', 'research-agent'], workspaceRoot, sharedEnv)).code, 0);

  assert.equal(
    (
      await runLauncher(
        ['run', '--agent-id', 'research-agent', '--input', '[hook flush] session=s1\nassistant=done\ncandidates:\n- environmental_outcome/supporting: Bash ok [turn:t1]'],
        workspaceRoot,
        sharedEnv,
      )
    ).code,
    0,
  );

  const distillResult = await runReve(
    ['distill', '--agent-id', 'research-agent', '--limit', '10'],
    workspaceRoot,
    { ...sharedEnv, OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_PROVIDER: 'mock' },
  );
  assert.equal(distillResult.code, 0);
  assert.match(distillResult.stdout, /Distilled short-term records: 1/);

  const agentRoot = join(sharedRoot, 'agents', 'research-agent');
  const shortTermFiles = await readdir(join(agentRoot, 'memory', 'short-term'));
  assert.equal(shortTermFiles.length, 1);
  const shortTerm = JSON.parse(await readFile(join(agentRoot, 'memory', 'short-term', shortTermFiles[0]!), 'utf8'));
  assert.equal(shortTerm.filtered_by_model, true);
  assert.equal(shortTerm.identity_id, 'research-agent');
  assert.equal(shortTerm.source_message_id?.length > 0, true);
});

test('distill provider/model can be resolved from ~/.codex/config.toml', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-reve-distill-config-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-reve-config-shared-'));
  const sharedEnv = {
    OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
  };
  const fakeHome = await mkdtemp(join(tmpdir(), 'agent-reve-home-'));
  const codexDir = join(fakeHome, '.codex');
  await mkdir(codexDir, { recursive: true });
  await writeFile(
    join(codexDir, 'config.toml'),
    [
      'model = "mock-model-from-config"',
      'model_provider = "mock"',
      '',
    ].join('\n'),
    'utf8',
  );

  assert.equal((await runLauncher(['init', '--agent-id', 'research-agent'], workspaceRoot, sharedEnv)).code, 0);
  assert.equal(
    (
      await runLauncher(
        ['run', '--agent-id', 'research-agent', '--input', 'capture for config provider test'],
        workspaceRoot,
        sharedEnv,
      )
    ).code,
    0,
  );

  const distillResult = await runReve(
    ['distill', '--agent-id', 'research-agent', '--limit', '10'],
    workspaceRoot,
    { ...sharedEnv, HOME: fakeHome },
  );
  assert.equal(distillResult.code, 0);

  const agentRoot = join(sharedRoot, 'agents', 'research-agent');
  const shortTermFiles = await readdir(join(agentRoot, 'memory', 'short-term'));
  assert.equal(shortTermFiles.length, 1);
  const shortTerm = JSON.parse(await readFile(join(agentRoot, 'memory', 'short-term', shortTermFiles[0]!), 'utf8'));
  assert.equal(shortTerm.model_provider, 'mock');
  assert.equal(shortTerm.model_name, 'mock-model-from-config');
});
