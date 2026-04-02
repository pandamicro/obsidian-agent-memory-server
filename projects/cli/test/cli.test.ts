import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const cliPath = resolve(fileURLToPath(new URL('../src/cli.ts', import.meta.url)));

async function runCli(args: string[], cwd: string) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolvePromise) => {
    const child = spawn(process.execPath, ['--experimental-strip-types', cliPath, ...args], {
      cwd,
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

test('init creates agent directories and agent_identity.json', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-cli-init-'));

  const result = await runCli(['init', '--agent-id', 'research-agent'], workspaceRoot);

  assert.equal(result.code, 0);

  const agentRoot = join(workspaceRoot, 'agents', 'research-agent');
  const identityPath = join(agentRoot, 'identity', 'agent_identity.json');

  const identity = JSON.parse(await readFile(identityPath, 'utf8'));
  assert.equal(identity.agent_id, 'research-agent');
  assert.equal(identity.canonical_name, 'Research Agent');
  assert.equal(identity.specialization, 'research');
  assert.match(identity.mission, /research/i);
  assert.equal(identity.lineage, 'origin:research-agent:v1');

  assert.deepEqual((await readdir(join(agentRoot, 'memory'))).sort(), ['long-term', 'short-term']);
  assert.deepEqual(await readdir(join(agentRoot, 'runs')), []);
});

test('run writes short-term event, long-term placeholder, and run summary', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-cli-run-'));

  const initResult = await runCli(['init', '--agent-id', 'research-agent'], workspaceRoot);
  assert.equal(initResult.code, 0);

  const runResult = await runCli(
    ['run', '--agent-id', 'research-agent', '--input', 'summarize current contract research'],
    workspaceRoot,
  );

  assert.equal(runResult.code, 0);

  const agentRoot = join(workspaceRoot, 'agents', 'research-agent');
  const shortTermFiles = await readdir(join(agentRoot, 'memory', 'short-term'));
  const longTermFiles = await readdir(join(agentRoot, 'memory', 'long-term'));
  const runFiles = await readdir(join(agentRoot, 'runs'));

  assert.equal(shortTermFiles.length, 1);
  assert.equal(longTermFiles.length, 1);
  assert.equal(runFiles.length, 1);

  const shortTermEvent = JSON.parse(
    await readFile(join(agentRoot, 'memory', 'short-term', shortTermFiles[0]!), 'utf8'),
  );
  const longTermObject = JSON.parse(
    await readFile(join(agentRoot, 'memory', 'long-term', longTermFiles[0]!), 'utf8'),
  );
  const runSummary = JSON.parse(await readFile(join(agentRoot, 'runs', runFiles[0]!), 'utf8'));

  assert.equal(shortTermEvent.identity_id, 'research-agent');
  assert.equal(shortTermEvent.event_type, 'captured');
  assert.equal(shortTermEvent.object_kind, 'episode');
  assert.equal(longTermObject.identity_id, 'research-agent');
  assert.equal(longTermObject.source_message_id, shortTermEvent.message_id);
  assert.equal(runSummary.agent_id, 'research-agent');
  assert.equal(runSummary.latest_long_term_ref, longTermObject.object_ref);
});

test('verify checks structure and reads latest long-term object', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-cli-verify-'));

  assert.equal((await runCli(['init', '--agent-id', 'research-agent'], workspaceRoot)).code, 0);
  assert.equal(
    (await runCli(
      ['run', '--agent-id', 'research-agent', '--input', 'summarize current contract research'],
      workspaceRoot,
    )).code,
    0,
  );

  const verifyResult = await runCli(['verify', '--agent-id', 'research-agent'], workspaceRoot);

  assert.equal(verifyResult.code, 0);
  assert.match(verifyResult.stdout, /research-agent/);
  assert.match(verifyResult.stdout, /long-term:/);
});

test('run fails with init guidance when agent identity is missing', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-cli-missing-'));

  const runResult = await runCli(
    ['run', '--agent-id', 'research-agent', '--input', 'summarize current contract research'],
    workspaceRoot,
  );

  assert.equal(runResult.code, 1);
  assert.match(runResult.stderr, /run init first/i);
});
