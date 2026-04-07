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

async function runCli(args: string[], cwd: string, stdinText?: string, env: NodeJS.ProcessEnv = {}) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolvePromise) => {
    const child = spawn(process.execPath, ['--experimental-strip-types', cliPath, ...args], {
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

    if (stdinText !== undefined) {
      child.stdin?.end(stdinText);
    }

    child.on('close', (code) => {
      resolvePromise({ code, stdout, stderr });
    });
  });
}

async function runLauncher(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = {},
  stdinText?: string,
) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolvePromise) => {
    const child = spawn(launcherPath, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.stdin.end(stdinText ?? '');

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

  assert.deepEqual((await readdir(join(agentRoot, 'memory'))).sort(), ['raw-capture', 'short-term']);
  assert.deepEqual(await readdir(join(agentRoot, 'runs')), []);
});

test('run writes raw-capture event and run summary', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-cli-run-'));

  const initResult = await runCli(['init', '--agent-id', 'research-agent'], workspaceRoot);
  assert.equal(initResult.code, 0);

  const runResult = await runCli(
    ['run', '--agent-id', 'research-agent', '--input', 'summarize current contract research'],
    workspaceRoot,
  );

  assert.equal(runResult.code, 0);

  const agentRoot = join(workspaceRoot, 'agents', 'research-agent');
  const rawCaptureFiles = await readdir(join(agentRoot, 'memory', 'raw-capture'));
  const shortTermFiles = await readdir(join(agentRoot, 'memory', 'short-term'));
  const runFiles = await readdir(join(agentRoot, 'runs'));

  assert.equal(rawCaptureFiles.length, 1);
  assert.equal(shortTermFiles.length, 0);
  assert.equal(runFiles.length, 1);

  const rawCaptureEvent = JSON.parse(
    await readFile(join(agentRoot, 'memory', 'raw-capture', rawCaptureFiles[0]!), 'utf8'),
  );
  const runSummary = JSON.parse(await readFile(join(agentRoot, 'runs', runFiles[0]!), 'utf8'));

  assert.equal(rawCaptureEvent.schema_version, '1');
  assert.equal(rawCaptureEvent.identity_id, 'research-agent');
  assert.equal(rawCaptureEvent.event_type, 'captured');
  assert.equal(rawCaptureEvent.object_kind, 'raw_capture');
  assert.equal(rawCaptureEvent.source_kind, 'direct_input');
  assert.equal(runSummary.agent_id, 'research-agent');
  assert.equal(runSummary.raw_capture_count, 1);
});

test('verify checks structure and reads latest short-term event', async () => {
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
  assert.match(verifyResult.stdout, /Latest short-term ref: <none>/);
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
  assert.equal((await readdir(join(agentRoot, 'memory', 'raw-capture'))).length, 1);
  assert.equal((await readdir(join(agentRoot, 'memory', 'short-term'))).length, 0);
});

test('run parses hook flush candidates into structured raw-capture fields', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-cli-hook-flush-'));

  const initResult = await runCli(['init', '--agent-id', 'research-agent'], workspaceRoot);
  assert.equal(initResult.code, 0);

  const flushInput = [
    '[hook flush] session=session-xyz',
    'agent=research-agent',
    `workspace=${workspaceRoot}`,
    'assistant=handled task',
    'candidates:',
    '- environmental_outcome/supporting: Bash result captured [turn:t-1, tool-use:tu-1]',
  ].join('\n');

  const runResult = await runCli(
    ['run', '--agent-id', 'research-agent', '--input', flushInput],
    workspaceRoot,
  );

  assert.equal(runResult.code, 0);

  const agentRoot = join(workspaceRoot, 'agents', 'research-agent');
  const rawFiles = await readdir(join(agentRoot, 'memory', 'raw-capture'));
  assert.equal(rawFiles.length, 1);
  const rawEvent = JSON.parse(
    await readFile(join(agentRoot, 'memory', 'raw-capture', rawFiles[0]!), 'utf8'),
  );

  assert.equal(rawEvent.source_kind, 'hook_flush');
  assert.equal(rawEvent.session_id, 'session-xyz');
  assert.equal(rawEvent.assistant_summary, 'handled task');
  assert.equal(rawEvent.candidates.length, 1);
  assert.equal(rawEvent.candidates[0].signal_type, 'environmental_outcome');
  assert.equal(rawEvent.candidates[0].polarity, 'supporting');
  assert.deepEqual(rawEvent.candidates[0].evidence_refs, ['turn:t-1', 'tool-use:tu-1']);
});

test('distill converts pending raw-capture records into short-term memory via mock model', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-cli-distill-'));
  assert.equal((await runCli(['init', '--agent-id', 'research-agent'], workspaceRoot)).code, 0);

  assert.equal(
    (
      await runCli(
        ['run', '--agent-id', 'research-agent', '--input', '[hook flush] session=s1\nassistant=done\ncandidates:\n- environmental_outcome/supporting: Bash ok [turn:t1]'],
        workspaceRoot,
      )
    ).code,
    0,
  );

  const distillResult = await runCli(
    ['distill', '--agent-id', 'research-agent', '--limit', '10'],
    workspaceRoot,
    undefined,
    { OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_PROVIDER: 'mock' },
  );
  assert.equal(distillResult.code, 0);
  assert.match(distillResult.stdout, /Distilled short-term records: 1/);

  const agentRoot = join(workspaceRoot, 'agents', 'research-agent');
  const shortTermFiles = await readdir(join(agentRoot, 'memory', 'short-term'));
  assert.equal(shortTermFiles.length, 1);
  const shortTerm = JSON.parse(await readFile(join(agentRoot, 'memory', 'short-term', shortTermFiles[0]!), 'utf8'));
  assert.equal(shortTerm.filtered_by_model, true);
  assert.equal(shortTerm.identity_id, 'research-agent');
  assert.equal(shortTerm.source_message_id?.length > 0, true);
});

test('distill provider/model can be resolved from ~/.codex/config.toml', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-cli-distill-config-'));
  const fakeHome = await mkdtemp(join(tmpdir(), 'agent-cli-home-'));
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

  assert.equal((await runCli(['init', '--agent-id', 'research-agent'], workspaceRoot)).code, 0);
  assert.equal(
    (
      await runCli(
        ['run', '--agent-id', 'research-agent', '--input', 'capture for config provider test'],
        workspaceRoot,
      )
    ).code,
    0,
  );

  const distillResult = await runCli(
    ['distill', '--agent-id', 'research-agent', '--limit', '10'],
    workspaceRoot,
    undefined,
    { HOME: fakeHome },
  );
  assert.equal(distillResult.code, 0);

  const agentRoot = join(workspaceRoot, 'agents', 'research-agent');
  const shortTermFiles = await readdir(join(agentRoot, 'memory', 'short-term'));
  assert.equal(shortTermFiles.length, 1);
  const shortTerm = JSON.parse(await readFile(join(agentRoot, 'memory', 'short-term', shortTermFiles[0]!), 'utf8'));
  assert.equal(shortTerm.model_provider, 'mock');
  assert.equal(shortTerm.model_name, 'mock-model-from-config');
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

test('mount requires an explicit selection and installs workspace hooks for the chosen agent', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-mount-workspace-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-mount-shared-'));

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

  const mountResult = await runLauncher(
    ['mount'],
    workspaceRoot,
    {
      OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
    },
    '2\n',
  );

  assert.equal(mountResult.code, 0);
  assert.match(mountResult.stdout, /Select an agent identity/);
  assert.match(mountResult.stdout, /0\) Do not mount hooks/);
  assert.match(mountResult.stdout, /Mounted hooks for unity-optimization-agent/);

  const bindingPath = join(workspaceRoot, '.codex', 'agent-memory', 'active-agent.json');
  const binding = JSON.parse(await readFile(bindingPath, 'utf8')) as { agent_id?: string };
  assert.equal(binding.agent_id, 'unity-optimization-agent');

  const hooksPath = join(workspaceRoot, '.codex', 'hooks.json');
  const hooks = JSON.parse(await readFile(hooksPath, 'utf8')) as { hooks?: Record<string, unknown> };
  assert.ok(hooks.hooks?.SessionStart);
});

test('mount no-mount option removes workspace hook registration and binding', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-mount-none-workspace-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-mount-none-shared-'));

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
      await runLauncher(
        ['mount'],
        workspaceRoot,
        {
          OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
        },
        '1\n',
      )
    ).code,
    0,
  );

  const noMountResult = await runLauncher(
    ['mount'],
    workspaceRoot,
    {
      OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
    },
    '0\n',
  );

  assert.equal(noMountResult.code, 0);
  assert.match(noMountResult.stdout, /Hooks not mounted for this workspace/);

  await assert.rejects(readFile(join(workspaceRoot, '.codex', 'hooks.json'), 'utf8'));
  await assert.rejects(readFile(join(workspaceRoot, '.codex', 'agent-memory', 'active-agent.json'), 'utf8'));
});
