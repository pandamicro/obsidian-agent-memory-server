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

test('consolidate builds a long-term learning record from short-term episodes', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-reve-consolidate-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-reve-consolidate-shared-'));
  const sharedEnv = {
    OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
  };

  assert.equal((await runLauncher(['init', '--agent-id', 'research-agent'], workspaceRoot, sharedEnv)).code, 0);

  const agentRoot = join(sharedRoot, 'agents', 'research-agent');
  const shortTermDir = join(agentRoot, 'memory', 'short-term');
  await mkdir(shortTermDir, { recursive: true });

  const episodeIds = ['learning-episode-1', 'learning-episode-2', 'learning-episode-3'];
  for (const episodeId of episodeIds) {
    const episode = {
      schema_version: '1',
      message_id: episodeId,
      identity_id: 'research-agent',
      object_kind: 'episode',
      event_type: 'captured',
      summary: `Episode ${episodeId}`,
    };
    await writeFile(join(shortTermDir, `${episodeId}.json`), `${JSON.stringify(episode, null, 2)}\n`, 'utf8');
  }

  const consolidateResult = await runReve(
    ['consolidate', '--agent-id', 'research-agent', '--limit', '10', '--batch-size', '5'],
    workspaceRoot,
    sharedEnv,
  );
  assert.equal(consolidateResult.code, 0);

  const longTermDir = join(agentRoot, 'memory', 'long-term');
  const longTermFiles = await readdir(longTermDir);
  assert.equal(longTermFiles.length, 1);
  const learningFile = join(longTermDir, longTermFiles[0]!);
  const learning = JSON.parse(await readFile(learningFile, 'utf8'));
  assert.equal(learning.object_kind, 'learning');
  assert.equal(learning.identity_id, 'research-agent');
  assert.deepEqual(learning.source_episode_ids.sort(), episodeIds.slice().sort());

  const runsDir = join(agentRoot, 'runs');
  const runFiles = await readdir(runsDir);
  assert.equal(runFiles.length, 1);
  const runSummary = JSON.parse(await readFile(join(runsDir, runFiles[0]!), 'utf8'));
  assert.equal(runSummary.agent_id, 'research-agent');
  assert.equal(runSummary.selected, episodeIds.length);
  assert.equal(runSummary.limit, 10);
  assert.equal(runSummary.batch_size, 5);
});

test('distill rejects non-integer limit values', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-reve-distill-limit-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-reve-shared-limit-'));
  const sharedEnv = {
    OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
  };

  assert.equal((await runLauncher(['init', '--agent-id', 'research-agent'], workspaceRoot, sharedEnv)).code, 0);

  const invalidLimitResult = await runReve(
    ['distill', '--agent-id', 'research-agent', '--limit', '10abc'],
    workspaceRoot,
    sharedEnv,
  );
  assert.equal(invalidLimitResult.code, 1);
  assert.match(invalidLimitResult.stderr, /Invalid --limit value: 10abc/);
});

test('consolidate only uses episode records with stable ids', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-reve-consolidate-filter-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-reve-consolidate-filter-shared-'));
  const sharedEnv = {
    OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
  };

  assert.equal((await runLauncher(['init', '--agent-id', 'research-agent'], workspaceRoot, sharedEnv)).code, 0);

  const agentRoot = join(sharedRoot, 'agents', 'research-agent');
  const shortTermDir = join(agentRoot, 'memory', 'short-term');
  await mkdir(shortTermDir, { recursive: true });

  const episodes = [
    {
      filename: 'valid.json',
      entry: {
        schema_version: '1',
        message_id: 'valid-episode-id',
        identity_id: 'research-agent',
        object_kind: 'episode',
        event_type: 'captured',
        summary: 'Valid episode',
      },
    },
    {
      filename: 'wrong-kind.json',
      entry: {
        schema_version: '1',
        message_id: 'note-id',
        identity_id: 'research-agent',
        object_kind: 'note',
      },
    },
    {
      filename: 'other-identity.json',
      entry: {
        schema_version: '1',
        message_id: 'other-agent-id',
        identity_id: 'other-agent',
        object_kind: 'episode',
      },
    },
    {
      filename: 'ref-only.json',
      entry: {
        schema_version: '1',
        object_ref: 'ref-episode',
        identity_id: 'research-agent',
        object_kind: 'episode',
      },
    },
    {
      filename: 'missing-id.json',
      entry: {
        schema_version: '1',
        identity_id: 'research-agent',
        object_kind: 'episode',
      },
    },
  ];

  for (const episode of episodes) {
    await writeFile(join(shortTermDir, episode.filename), `${JSON.stringify(episode.entry, null, 2)}\n`, 'utf8');
  }

  const consolidateResult = await runReve(
    ['consolidate', '--agent-id', 'research-agent', '--limit', '10', '--batch-size', '5'],
    workspaceRoot,
    sharedEnv,
  );
  assert.equal(consolidateResult.code, 0);

  const longTermDir = join(agentRoot, 'memory', 'long-term');
  const longTermFiles = await readdir(longTermDir);
  assert.equal(longTermFiles.length, 1);
  const learning = JSON.parse(await readFile(join(longTermDir, longTermFiles[0]!), 'utf8'));
  assert.equal(learning.object_kind, 'learning');
  assert.equal(learning.identity_id, 'research-agent');
  assert.deepEqual(learning.source_episode_ids.sort(), ['valid-episode-id', 'ref-episode'].sort());

  const runsDir = join(agentRoot, 'runs');
  const runFiles = await readdir(runsDir);
  assert.equal(runFiles.length, 1);
  const runSummary = JSON.parse(await readFile(join(runsDir, runFiles[0]!), 'utf8'));
  assert.equal(runSummary.selected, 2);
});

test('consolidate with no valid episodes skips learning file but still records run', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-reve-consolidate-empty-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-reve-consolidate-empty-shared-'));
  const sharedEnv = {
    OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
  };

  assert.equal((await runLauncher(['init', '--agent-id', 'research-agent'], workspaceRoot, sharedEnv)).code, 0);

  const agentRoot = join(sharedRoot, 'agents', 'research-agent');
  const shortTermDir = join(agentRoot, 'memory', 'short-term');
  await mkdir(shortTermDir, { recursive: true });

  const invalidEpisode = {
    schema_version: '1',
    identity_id: 'research-agent',
    object_kind: 'note',
  };
  await writeFile(join(shortTermDir, 'invalid.json'), `${JSON.stringify(invalidEpisode, null, 2)}\n`, 'utf8');

  const consolidateResult = await runReve(
    ['consolidate', '--agent-id', 'research-agent', '--limit', '10', '--batch-size', '5'],
    workspaceRoot,
    sharedEnv,
  );
  assert.equal(consolidateResult.code, 0);

  const longTermDir = join(agentRoot, 'memory', 'long-term');
  const longTermFiles = await readdir(longTermDir);
  assert.equal(longTermFiles.length, 0);

  const runsDir = join(agentRoot, 'runs');
  const runFiles = await readdir(runsDir);
  assert.equal(runFiles.length, 1);
  const runSummary = JSON.parse(await readFile(join(runsDir, runFiles[0]!), 'utf8'));
  assert.equal(runSummary.selected, 0);
  assert.equal(runSummary.limit, 10);
  assert.equal(runSummary.batch_size, 5);
});
