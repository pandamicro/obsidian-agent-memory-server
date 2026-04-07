import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
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
  const consolidateEnv = {
    ...sharedEnv,
    OBSIDIAN_AGENT_MEMORY_SERVER_CONSOLIDATE_PROVIDER: 'mock',
    OBSIDIAN_AGENT_MEMORY_SERVER_CONSOLIDATE_MODEL: 'gpt-5.2',
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
      evidence_refs: [`evidence-${episodeId}`],
    };
    await writeFile(join(shortTermDir, `${episodeId}.json`), `${JSON.stringify(episode, null, 2)}\n`, 'utf8');
  }

  const consolidateResult = await runReve(
    ['consolidate', '--agent-id', 'research-agent', '--limit', '10', '--batch-size', '5'],
    workspaceRoot,
    consolidateEnv,
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
  assert.equal(typeof learning.message_id, 'string');
  assert.equal(typeof learning.object_ref, 'string');
  assert.equal(typeof learning.summary, 'string');
  assert.equal(typeof learning.applicability, 'string');
  assert.equal(typeof learning.failure_conditions, 'string');
  assert.deepEqual(learning.evidence_refs.sort(), episodeIds.map((id) => `evidence-${id}`));
  assert(typeof learning.confidence === 'number');
  assert.equal(learning.quality.status, 'pass');
  assert(Array.isArray(learning.quality.reasons));
  assert.deepEqual(learning.quality.reasons, []);
  assert.equal(typeof learning.observed_at, 'string');
  assert.equal(typeof learning.consolidation_run_id, 'string');

  const runsDir = join(agentRoot, 'runs');
  const runFiles = await readdir(runsDir);
  assert.equal(runFiles.length, 1);
  const runSummary = JSON.parse(await readFile(join(runsDir, runFiles[0]!), 'utf8'));
  assert.equal(runSummary.agent_id, 'research-agent');
  assert.equal(runSummary.episodes_scanned, episodeIds.length);
  assert.equal(runSummary.limit, 10);
  assert.equal(runSummary.batch_size, 5);
  assert.equal(runSummary.learning_created, 1);
  assert.equal(runSummary.no_learning, 0);
  assert.equal(runSummary.needs_more_evidence, 0);
  assert.equal(runSummary.provider, 'mock');
  assert.equal(runSummary.model, 'gpt-5.2');
  assert.equal(runSummary.batches_scanned, 1);
  assert.equal(learning.consolidation_run_id, runSummary.run_id);
});

test('distill rejects non-integer limit values', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-reve-distill-limit-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-reve-shared-limit-'));
  const sharedEnv = {
    OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
  };
  const consolidateEnv = {
    ...sharedEnv,
    OBSIDIAN_AGENT_MEMORY_SERVER_CONSOLIDATE_PROVIDER: 'mock',
    OBSIDIAN_AGENT_MEMORY_SERVER_CONSOLIDATE_MODEL: 'gpt-5.2',
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
  const consolidateEnv = {
    ...sharedEnv,
    OBSIDIAN_AGENT_MEMORY_SERVER_CONSOLIDATE_PROVIDER: 'mock',
    OBSIDIAN_AGENT_MEMORY_SERVER_CONSOLIDATE_MODEL: 'gpt-5.2',
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
        evidence_refs: ['evidence-valid'],
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
        evidence_refs: ['evidence-ref'],
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
    consolidateEnv,
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
  assert.equal(runSummary.episodes_scanned, 2);
});

test('consolidate with no valid episodes skips learning file but still records run', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-reve-consolidate-empty-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-reve-consolidate-empty-shared-'));
  const sharedEnv = {
    OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
  };
  const consolidateEnv = {
    ...sharedEnv,
    OBSIDIAN_AGENT_MEMORY_SERVER_CONSOLIDATE_PROVIDER: 'mock',
    OBSIDIAN_AGENT_MEMORY_SERVER_CONSOLIDATE_MODEL: 'gpt-5.2',
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
    consolidateEnv,
  );
  assert.equal(consolidateResult.code, 0);

  const longTermDir = join(agentRoot, 'memory', 'long-term');
  const longTermFiles = await readdir(longTermDir);
  assert.equal(longTermFiles.length, 0);

  const runsDir = join(agentRoot, 'runs');
  const runFiles = await readdir(runsDir);
  assert.equal(runFiles.length, 1);
  const runSummary = JSON.parse(await readFile(join(runsDir, runFiles[0]!), 'utf8'));
  assert.equal(runSummary.episodes_scanned, 0);
  assert.equal(runSummary.limit, 10);
  assert.equal(runSummary.batch_size, 5);
});

test('consolidate records no_learning when evidence unsupported', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-reve-consolidate-no-learning-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-reve-consolidate-no-learning-shared-'));
  const sharedEnv = {
    OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
  };
  const consolidateEnv = {
    ...sharedEnv,
    OBSIDIAN_AGENT_MEMORY_SERVER_CONSOLIDATE_PROVIDER: 'mock',
    OBSIDIAN_AGENT_MEMORY_SERVER_CONSOLIDATE_MODEL: 'gpt-5.2',
  };

  assert.equal((await runLauncher(['init', '--agent-id', 'research-agent'], workspaceRoot, sharedEnv)).code, 0);

  const agentRoot = join(sharedRoot, 'agents', 'research-agent');
  const shortTermDir = join(agentRoot, 'memory', 'short-term');
  await mkdir(shortTermDir, { recursive: true });

  const weakEpisodes = [
    {
      schema_version: '1',
      message_id: 'weak-episode-1',
      identity_id: 'research-agent',
      object_kind: 'episode',
      event_type: 'captured',
      summary: '',
      evidence_refs: [],
    },
    {
      schema_version: '1',
      message_id: 'weak-episode-2',
      identity_id: 'research-agent',
      object_kind: 'episode',
      event_type: 'captured',
      summary: '',
      evidence_refs: [],
    },
  ];
  for (const episode of weakEpisodes) {
    await writeFile(join(shortTermDir, `${episode.message_id}.json`), `${JSON.stringify(episode, null, 2)}\n`, 'utf8');
  }

  const consolidateResult = await runReve(
    ['consolidate', '--agent-id', 'research-agent', '--limit', '10', '--batch-size', '5'],
    workspaceRoot,
    consolidateEnv,
  );
  assert.equal(consolidateResult.code, 0);

  const longTermDir = join(agentRoot, 'memory', 'long-term');
  const longTermFiles = await readdir(longTermDir);
  assert.equal(longTermFiles.length, 0);

  const runsDir = join(agentRoot, 'runs');
  const runFiles = await readdir(runsDir);
  assert.equal(runFiles.length, 1);
  const runSummary = JSON.parse(await readFile(join(runsDir, runFiles[0]!), 'utf8'));
  assert.equal(runSummary.learning_created, 0);
  assert.equal(runSummary.no_learning, 1);
  assert.equal(runSummary.needs_more_evidence, 0);
  assert.equal(runSummary.episodes_scanned, weakEpisodes.length);
  assert.equal(runSummary.batches_scanned, 1);
});

test('consolidate bins episodes by fixed windows respecting limit and batch size', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-reve-consolidate-batching-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-reve-consolidate-batching-shared-'));
  const sharedEnv = {
    OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
  };
  const consolidateEnv = {
    ...sharedEnv,
    OBSIDIAN_AGENT_MEMORY_SERVER_CONSOLIDATE_PROVIDER: 'mock',
    OBSIDIAN_AGENT_MEMORY_SERVER_CONSOLIDATE_MODEL: 'gpt-5.2',
  };

  assert.equal((await runLauncher(['init', '--agent-id', 'research-agent'], workspaceRoot, sharedEnv)).code, 0);

  const agentRoot = join(sharedRoot, 'agents', 'research-agent');
  const shortTermDir = join(agentRoot, 'memory', 'short-term');
  await mkdir(shortTermDir, { recursive: true });

  const episodeOrder = Array.from({ length: 7 }, (_, index) => {
    const padded = `${index + 1}`.padStart(2, '0');
    return {
      id: `episode-${index + 1}`,
      timestamp: `2026-04-07T10-21-42.3${padded}Z`,
    };
  });
  for (const episode of episodeOrder) {
    const entry = {
      schema_version: '1',
      message_id: episode.id,
      identity_id: 'research-agent',
      object_kind: 'episode',
      event_type: 'captured',
      summary: `Episode ${episode.id}`,
      evidence_refs: [`evidence-${episode.id}`],
    };
    await writeFile(join(shortTermDir, `${episode.timestamp}-${episode.id}.json`), `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
  }

  const limit = 5;
  const batchSize = 2;
  const consolidateResult = await runReve(
    ['consolidate', '--agent-id', 'research-agent', '--limit', `${limit}`, '--batch-size', `${batchSize}`],
    workspaceRoot,
    consolidateEnv,
  );
  assert.equal(consolidateResult.code, 0);

  const runsDir = join(agentRoot, 'runs');
  const runFiles = await readdir(runsDir);
  assert.equal(runFiles.length, 1);
  const runSummary = JSON.parse(await readFile(join(runsDir, runFiles[0]!), 'utf8'));
  assert.equal(runSummary.episodes_scanned, limit);
  assert.equal(runSummary.batches_scanned, Math.ceil(limit / batchSize));
  assert.equal(runSummary.learning_created, Math.floor(limit / batchSize));
  assert.equal(runSummary.needs_more_evidence, 1);

  const longTermDir = join(agentRoot, 'memory', 'long-term');
  const longTermFiles = await readdir(longTermDir);
  assert.equal(longTermFiles.length, runSummary.learning_created);

  const learningRecords = [];
  for (const file of longTermFiles) {
    const content = JSON.parse(await readFile(join(longTermDir, file!), 'utf8'));
    learningRecords.push(content);
  }
  learningRecords.sort((a, b) => {
    const aFirst = a.source_episode_ids[0] ?? '';
    const bFirst = b.source_episode_ids[0] ?? '';
    return aFirst.localeCompare(bFirst);
  });

  const expectedBatches = [
    ['episode-1', 'episode-2'],
    ['episode-3', 'episode-4'],
  ];

  for (let i = 0; i < expectedBatches.length; i += 1) {
    assert.deepEqual(learningRecords[i].source_episode_ids, expectedBatches[i]);
    assert.equal(learningRecords[i].consolidation_run_id, runSummary.run_id);
  }
});

test('consolidate learning is idempotent even when source episodes reorder on disk', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-reve-consolidate-idempotent-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-reve-consolidate-idempotent-shared-'));
  const sharedEnv = {
    OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
  };
  const consolidateEnv = {
    ...sharedEnv,
    OBSIDIAN_AGENT_MEMORY_SERVER_CONSOLIDATE_PROVIDER: 'mock',
    OBSIDIAN_AGENT_MEMORY_SERVER_CONSOLIDATE_MODEL: 'gpt-5.2',
  };

  assert.equal((await runLauncher(['init', '--agent-id', 'research-agent'], workspaceRoot, sharedEnv)).code, 0);

  const agentRoot = join(sharedRoot, 'agents', 'research-agent');
  const shortTermDir = join(agentRoot, 'memory', 'short-term');
  const longTermDir = join(agentRoot, 'memory', 'long-term');
  const runsDir = join(agentRoot, 'runs');
  await mkdir(shortTermDir, { recursive: true });

  const episodeEntries = [
    {
      message_id: 'learning-episode-a',
      evidence_refs: ['evidence-a'],
      filename: 'learning-episode-a.json',
    },
    {
      message_id: 'learning-episode-b',
      evidence_refs: ['evidence-b'],
      filename: 'learning-episode-b.json',
    },
    {
      message_id: 'learning-episode-c',
      evidence_refs: ['evidence-c'],
      filename: 'learning-episode-c.json',
    },
  ];
  for (const entry of episodeEntries) {
    const episode = {
      schema_version: '1',
      message_id: entry.message_id,
      identity_id: 'research-agent',
      object_kind: 'episode',
      event_type: 'captured',
      summary: `Summary for ${entry.message_id}`,
      evidence_refs: entry.evidence_refs,
    };
    await writeFile(join(shortTermDir, entry.filename), `${JSON.stringify(episode, null, 2)}\n`, 'utf8');
  }

  const consolidateArgs = ['consolidate', '--agent-id', 'research-agent', '--limit', '10', '--batch-size', '5'];
  assert.equal((await runReve(consolidateArgs, workspaceRoot, consolidateEnv)).code, 0);

  const longTermFiles = await readdir(longTermDir);
  assert.equal(longTermFiles.length, 1);
  const learningPath = join(longTermDir, longTermFiles[0]!);
  const initialLearning = JSON.parse(await readFile(learningPath, 'utf8'));
  const sortedIds = episodeEntries.map((entry) => entry.message_id).sort();
  assert.deepEqual(initialLearning.source_episode_ids, sortedIds);
  const expectedFingerprint = createHash('sha256').update(sortedIds.join('|'), 'utf8').digest('hex');
  assert.equal(initialLearning.fingerprint, expectedFingerprint);

  await rename(join(shortTermDir, 'learning-episode-a.json'), join(shortTermDir, 'z-learning-episode-a.json'));
  await rename(join(shortTermDir, 'learning-episode-b.json'), join(shortTermDir, 'a-learning-episode-b.json'));
  await rename(join(shortTermDir, 'learning-episode-c.json'), join(shortTermDir, 'm-learning-episode-c.json'));

  assert.equal((await runReve(consolidateArgs, workspaceRoot, consolidateEnv)).code, 0);

  const finalLongTermFiles = await readdir(longTermDir);
  assert.equal(finalLongTermFiles.length, 1);
  const finalLearning = JSON.parse(await readFile(learningPath, 'utf8'));
  assert.equal(finalLearning.fingerprint, expectedFingerprint);
  assert.deepEqual(finalLearning.source_episode_ids, sortedIds);

  const runFiles = (await readdir(runsDir)).sort();
  assert.equal(runFiles.length, 2);
});

test('consolidate no_learning batches can be retried once new evidence arrives', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-reve-consolidate-no-learning-retry-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-reve-consolidate-no-learning-retry-shared-'));
  const sharedEnv = {
    OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
  };
  const consolidateEnv = {
    ...sharedEnv,
    OBSIDIAN_AGENT_MEMORY_SERVER_CONSOLIDATE_PROVIDER: 'mock',
    OBSIDIAN_AGENT_MEMORY_SERVER_CONSOLIDATE_MODEL: 'gpt-5.2',
  };

  assert.equal((await runLauncher(['init', '--agent-id', 'research-agent'], workspaceRoot, sharedEnv)).code, 0);

  const agentRoot = join(sharedRoot, 'agents', 'research-agent');
  const shortTermDir = join(agentRoot, 'memory', 'short-term');
  const longTermDir = join(agentRoot, 'memory', 'long-term');
  const runsDir = join(agentRoot, 'runs');
  await mkdir(shortTermDir, { recursive: true });

  const weakEpisodes = [
    {
      message_id: 'weak-retry-1',
      summary: '',
      evidence_refs: [] as string[],
    },
    {
      message_id: 'weak-retry-2',
      summary: '',
      evidence_refs: [] as string[],
    },
  ];
  for (const episode of weakEpisodes) {
    const entry = {
      schema_version: '1',
      message_id: episode.message_id,
      identity_id: 'research-agent',
      object_kind: 'episode',
      event_type: 'captured',
      summary: episode.summary,
      evidence_refs: episode.evidence_refs,
    };
    await writeFile(join(shortTermDir, `${episode.message_id}.json`), `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
  }

  const consolidateArgs = ['consolidate', '--agent-id', 'research-agent', '--limit', '10', '--batch-size', '5'];
  assert.equal((await runReve(consolidateArgs, workspaceRoot, consolidateEnv)).code, 0);

  const firstRunFiles = await readdir(runsDir);
  assert.equal(firstRunFiles.length, 1);
  const firstRunSummary = JSON.parse(await readFile(join(runsDir, firstRunFiles[0]!), 'utf8'));
  assert.equal(firstRunSummary.learning_created, 0);
  assert(firstRunSummary.no_learning > 0);
  assert.equal(firstRunSummary.episodes_scanned, weakEpisodes.length);

  const longTermFiles = await readdir(longTermDir);
  assert.equal(longTermFiles.length, 0);

  const newEpisodes = [
    {
      message_id: 'retry-episode-1',
      summary: 'Adds new evidence',
      evidence_refs: ['evidence-retry-1'],
    },
    {
      message_id: 'retry-episode-2',
      summary: 'More supporting evidence',
      evidence_refs: ['evidence-retry-2'],
    },
  ];
  for (const episode of newEpisodes) {
    const entry = {
      schema_version: '1',
      message_id: episode.message_id,
      identity_id: 'research-agent',
      object_kind: 'episode',
      event_type: 'captured',
      summary: episode.summary,
      evidence_refs: episode.evidence_refs,
    };
    await writeFile(join(shortTermDir, `${episode.message_id}.json`), `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
  }

  assert.equal((await runReve(consolidateArgs, workspaceRoot, consolidateEnv)).code, 0);

  const allRunFiles = await readdir(runsDir);
  const newRunFiles = allRunFiles.filter((file) => !firstRunFiles.includes(file));
  assert.equal(newRunFiles.length, 1);
  const retrySummary = JSON.parse(await readFile(join(runsDir, newRunFiles[0]!), 'utf8'));
  assert.equal(retrySummary.learning_created, 1);
  assert.equal(retrySummary.no_learning, 0);

  const longTermFilesAfterRetry = await readdir(longTermDir);
  assert.equal(longTermFilesAfterRetry.length, 1);
});
