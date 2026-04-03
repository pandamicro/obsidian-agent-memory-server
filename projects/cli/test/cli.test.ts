import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const cliPath = resolve(fileURLToPath(new URL('../src/cli.ts', import.meta.url)));
const launcherPath = resolve(fileURLToPath(new URL('../../../bin/agents', import.meta.url)));
const repoBindingPath = resolve(fileURLToPath(new URL('../../../.codex/agent-memory/active-agent.json', import.meta.url)));

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

async function runLauncher(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = {},
) {
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

async function writeRepoLocalScope(sharedRoot: string, agentId: string, workspaceRoot: string) {
  const scopeDir = join(sharedRoot, 'agents', agentId, 'identity');
  await mkdir(scopeDir, { recursive: true });
  await writeFile(
    join(scopeDir, 'agent_scope.json'),
    `${JSON.stringify(
      {
        scope_type: 'repo-local',
        workspace_root: workspaceRoot,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
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

test('launcher writes into the shared root and leaves the caller workspace untouched', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-launcher-workspace-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-launcher-shared-'));

  const result = await runLauncher(
    ['init', '--agent-id', 'shared-launcher-agent'],
    workspaceRoot,
    {
      OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
    },
  );

  assert.equal(result.code, 0);

  const agentRoot = join(sharedRoot, 'agents', 'shared-launcher-agent');
  const identityPath = join(agentRoot, 'identity', 'agent_identity.json');

  const identity = JSON.parse(await readFile(identityPath, 'utf8'));
  assert.equal(identity.agent_id, 'shared-launcher-agent');
  assert.equal(identity.canonical_name, 'Shared Launcher Agent');
  assert.equal(identity.specialization, 'shared-launcher');

  const runResult = await runLauncher(
    ['run', '--agent-id', 'shared-launcher-agent', '--input', 'shared root check'],
    workspaceRoot,
    {
      OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
    },
  );

  assert.equal(runResult.code, 0);
  assert.deepEqual(await readdir(join(workspaceRoot)), []);
  assert.equal((await readdir(join(agentRoot, 'memory', 'short-term'))).length, 1);
  assert.equal((await readdir(join(agentRoot, 'memory', 'long-term'))).length, 1);
});

test('launcher list discovers shared agents from another workspace', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-launcher-list-workspace-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-launcher-list-shared-'));

  assert.equal(
    (
      await runLauncher(['init', '--agent-id', 'research-agent'], workspaceRoot, {
        OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
      })
    ).code,
    0,
  );
  assert.equal(
    (
      await runLauncher(['init', '--agent-id', 'unity-optimization-agent'], workspaceRoot, {
        OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
      })
    ).code,
    0,
  );

  const listResult = await runLauncher(['list'], workspaceRoot, {
    OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
  });

  assert.equal(listResult.code, 0);

  const listed = JSON.parse(listResult.stdout) as Array<{ agent_id: string }>;
  assert.deepEqual(
    listed.map((entry) => entry.agent_id),
    ['research-agent', 'unity-optimization-agent'],
  );
});

test('repo-local scoped agents are visible only from their canonical workspace', async () => {
  const canonicalWorkspace = await mkdtemp(join(tmpdir(), 'agent-scope-canonical-'));
  const foreignWorkspace = await mkdtemp(join(tmpdir(), 'agent-scope-foreign-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-scope-shared-'));

  assert.equal(
    (
      await runLauncher(['init', '--agent-id', 'agentic-memory-expert'], canonicalWorkspace, {
        OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
      })
    ).code,
    0,
  );
  await writeRepoLocalScope(sharedRoot, 'agentic-memory-expert', canonicalWorkspace);

  const canonicalList = await runLauncher(['list'], canonicalWorkspace, {
    OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
  });
  assert.equal(canonicalList.code, 0);
  assert.match(canonicalList.stdout, /agentic-memory-expert/);

  const foreignList = await runLauncher(['list'], foreignWorkspace, {
    OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
  });
  assert.equal(foreignList.code, 0);
  assert.doesNotMatch(foreignList.stdout, /agentic-memory-expert/);

  const foreignRun = await runLauncher(
    ['run', '--agent-id', 'agentic-memory-expert', '--input', 'scope check'],
    foreignWorkspace,
    {
      OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
    },
  );
  assert.notEqual(foreignRun.code, 0);
  assert.match(foreignRun.stderr, /scoped/i);

  const foreignVerify = await runLauncher(['verify', '--agent-id', 'agentic-memory-expert'], foreignWorkspace, {
    OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
  });
  assert.notEqual(foreignVerify.code, 0);
  assert.match(foreignVerify.stderr, /scoped/i);
});

test('repository default binding points to agentic-memory-expert', async () => {
  const binding = JSON.parse(await readFile(repoBindingPath, 'utf8')) as { agent_id?: string };
  assert.equal(binding.agent_id, 'agentic-memory-expert');
});
