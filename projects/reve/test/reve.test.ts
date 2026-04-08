import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createCodexRolloutHydrator } from '../src/codex-rollout-hydrator.ts';

const revePath = resolve(fileURLToPath(new URL('../src/cli.ts', import.meta.url)));
const launcherPath = resolve(fileURLToPath(new URL('../../../bin/agents', import.meta.url)));
const reveBinPath = resolve(fileURLToPath(new URL('../../../bin/reve', import.meta.url)));

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

async function runReveBin(args: string[], cwd: string, env: NodeJS.ProcessEnv = {}) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolvePromise) => {
    const child = spawn(reveBinPath, args, {
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

async function startResponsesTestServer(
  outputTexts: string[],
  onRequest?: (body: Record<string, unknown>) => void,
) {
  let requestIndex = 0;
  const server = createServer(async (request, response) => {
    if (request.method === 'POST' && request.url === '/v1/responses') {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(Buffer.from(chunk));
      }
      if (onRequest) {
        const rawBody = Buffer.concat(chunks).toString('utf8');
        onRequest(JSON.parse(rawBody) as Record<string, unknown>);
      }
      const outputText = outputTexts[Math.min(requestIndex, outputTexts.length - 1)] ?? '';
      requestIndex += 1;
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ output_text: outputText }));
      return;
    }
    response.writeHead(404);
    response.end();
  });

  await new Promise<void>((resolvePromise) => {
    server.listen(0, '127.0.0.1', () => resolvePromise());
  });

  const address = server.address();
  assert(address && typeof address === 'object' && 'port' in address);

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise<void>((resolvePromise, rejectPromise) => {
        server.close((error) => {
          if (error) {
            rejectPromise(error);
            return;
          }
          resolvePromise();
        });
      });
    },
  };
}

async function writeConsolidateResponsesConfig(baseUrl: string) {
  const configDir = await mkdtemp(join(tmpdir(), 'agent-reve-consolidate-config-'));
  const configPath = join(configDir, 'config.toml');
  await writeFile(
    configPath,
    [
      'consolidate_model_provider = "responses-test"',
      'consolidate_model = "responses-test-model"',
      '',
      '[model_providers.responses-test]',
      `base_url = "${baseUrl}"`,
      'wire_api = "responses"',
      'requires_openai_auth = false',
      '',
    ].join('\n'),
    'utf8',
  );
  return configPath;
}

async function writeDistillResponsesConfig(baseUrl: string) {
  const fakeHome = await mkdtemp(join(tmpdir(), 'agent-reve-distill-config-home-'));
  const codexDir = join(fakeHome, '.codex');
  await mkdir(codexDir, { recursive: true });
  const configPath = join(codexDir, 'config.toml');
  await writeFile(
    configPath,
    [
      'model_provider = "responses-test"',
      'model = "responses-test-model"',
      '',
      '[model_providers.responses-test]',
      `base_url = "${baseUrl}"`,
      'wire_api = "responses"',
      'requires_openai_auth = false',
      '',
    ].join('\n'),
    'utf8',
  );
  return fakeHome;
}

async function writeRawCaptureRecord(
  rawCaptureDir: string,
  value: Record<string, unknown>,
  suffix = 'raw-record',
) {
  await mkdir(rawCaptureDir, { recursive: true });
  const path = join(rawCaptureDir, `2026-04-08T00-00-00.000Z-${suffix}.json`);
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
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

  const runsDir = join(agentRoot, 'runs');
  const runFiles = await readdir(runsDir);
  let successSummary: null | Record<string, unknown> = null;
  for (const file of runFiles) {
    const summary = JSON.parse(await readFile(join(runsDir, file), 'utf8'));
    if (
      summary.distill_source === 'raw-capture'
      && summary.status === 'success'
      && summary.provider === 'mock'
    ) {
      successSummary = summary;
      break;
    }
  }
  assert(successSummary);
  if (successSummary) {
    assert.equal(successSummary.status, 'success');
    assert.equal(successSummary.failure_reason, null);
    assert.equal(successSummary.skip_reason, null);
    assert.equal(successSummary.provider, 'mock');
    assert.equal(typeof successSummary.model, 'string');
  }
});

test('distill prefilter rejects low-signal direct input before provider request', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-reve-distill-prefilter-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-reve-distill-prefilter-shared-'));
  const sharedEnv = {
    OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
  };
  assert.equal((await runLauncher(['init', '--agent-id', 'research-agent'], workspaceRoot, sharedEnv)).code, 0);
  assert.equal(
    (
      await runLauncher(
        ['run', '--agent-id', 'research-agent', '--input', 'please review this later'],
        workspaceRoot,
        sharedEnv,
      )
    ).code,
    0,
  );

  const seenBodies: Array<Record<string, unknown>> = [];
  const server = await startResponsesTestServer([
    JSON.stringify({
      event_type: 'captured',
      object_kind: 'episode',
      signal_type: 'explicit',
      polarity: 'supporting',
      summary: 'should never be used',
      evidence_refs: ['input:test'],
      quality: {
        observable: true,
        linkable: true,
        evaluatable: true,
        distillable: true,
        status: 'pass',
        reasons: [],
      },
      confidence: 0.5,
      parser_reason: 'unexpected-provider-call',
    }),
  ], (body) => {
    seenBodies.push(body);
  });

  try {
    const fakeHome = await writeDistillResponsesConfig(server.baseUrl);
    const distillResult = await runReve(
      ['distill', '--agent-id', 'research-agent', '--limit', '10'],
      workspaceRoot,
      { ...sharedEnv, HOME: fakeHome },
    );
    assert.equal(distillResult.code, 0);
    assert.match(distillResult.stdout, /Distilled short-term records: 0/);
    assert.equal(seenBodies.length, 0);

    const agentRoot = join(sharedRoot, 'agents', 'research-agent');
    const shortTermFiles = await readdir(join(agentRoot, 'memory', 'short-term'));
    assert.equal(shortTermFiles.length, 0);

    const runFiles = await readdir(join(agentRoot, 'runs'));
    let successSummary: null | Record<string, unknown> = null;
    for (const file of runFiles) {
      const summary = JSON.parse(await readFile(join(agentRoot, 'runs', file), 'utf8'));
      if (
        summary.distill_source === 'raw-capture'
        && summary.status === 'success'
        && summary.provider === 'responses-test'
      ) {
        successSummary = summary;
      }
    }
    assert(successSummary);
    if (successSummary) {
      assert.equal(successSummary.scanned, 1);
      assert.equal(successSummary.distilled, 0);
      assert.equal(successSummary.skipped, 1);
      assert.equal(successSummary.prefilter_rejected, 1);
      assert.equal(successSummary.rejected_low_signal, 1);
    }
  } finally {
    await server.close();
  }
});

test('codex rollout hydrator slices compact context around turn id', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-reve-hydrator-slice-'));
  const rolloutPath = join(workspaceRoot, 'rollout-test.jsonl');
  const rolloutLines = [
    JSON.stringify({ type: 'session_meta', payload: { id: 'thread-1' } }),
    JSON.stringify({ type: 'user_message', payload: { turn_id: 'turn-1', text: 'user asks about memory quality' } }),
    JSON.stringify({ type: 'assistant_message', payload: { turn_id: 'turn-1', text: 'assistant gives distill guidance' } }),
    JSON.stringify({ type: 'tool_result', payload: { turn_id: 'turn-1', output: 'tool output ok' } }),
    JSON.stringify({ type: 'assistant_message', payload: { turn_id: 'turn-2', text: 'later unrelated turn' } }),
  ];
  await writeFile(rolloutPath, `${rolloutLines.join('\n')}\n`, 'utf8');

  const hydrator = createCodexRolloutHydrator();
  const hydrated = await hydrator.hydrate({
    session_id: 'session-1',
    thread_id: 'thread-1',
    turn_id: 'turn-1',
    event: 'stop',
    rollout_path_hint: rolloutPath,
  });

  assert.equal(hydrated.status, 'success');
  if (hydrated.status === 'success') {
    assert.match(hydrated.context_window.user[0] ?? '', /user asks about memory quality/i);
    assert.match(hydrated.context_window.assistant[0] ?? '', /assistant gives distill guidance/i);
    assert.match(hydrated.context_window.tool[0] ?? '', /tool output ok/i);
    assert(hydrated.evidence_refs.some((ref) => ref.includes('rollout:')));
  }
});

test('codex rollout hydrator returns unavailable when target turn is missing', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-reve-hydrator-missing-turn-'));
  const rolloutPath = join(workspaceRoot, 'rollout-missing-turn.jsonl');
  const rolloutLines = [
    JSON.stringify({ type: 'session_meta', payload: { id: 'thread-missing' } }),
    JSON.stringify({ type: 'user_message', payload: { turn_id: 'turn-a', text: 'first user message' } }),
    JSON.stringify({ type: 'assistant_message', payload: { turn_id: 'turn-a', text: 'first assistant message' } }),
  ];
  await writeFile(rolloutPath, `${rolloutLines.join('\n')}\n`, 'utf8');

  const hydrator = createCodexRolloutHydrator();
  const hydrated = await hydrator.hydrate({
    session_id: 'session-missing',
    thread_id: 'thread-missing',
    turn_id: 'turn-does-not-exist',
    event: 'stop',
    rollout_path_hint: rolloutPath,
  });

  assert.equal(hydrated.status, 'unavailable');
  if (hydrated.status === 'unavailable') {
    assert.equal(hydrated.reason, 'target_not_found');
  }
});

test('distill hydrates candidate raw capture via rollout_path_hint before provider call', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-reve-distill-hydrated-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-reve-distill-hydrated-shared-'));
  const sharedEnv = {
    OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
  };
  assert.equal((await runLauncher(['init', '--agent-id', 'research-agent'], workspaceRoot, sharedEnv)).code, 0);

  const rolloutPath = join(workspaceRoot, 'rollout-hydrated.jsonl');
  await writeFile(
    rolloutPath,
    `${[
      JSON.stringify({ type: 'session_meta', payload: { id: 'thread-hydrated' } }),
      JSON.stringify({ type: 'user_message', payload: { turn_id: 'turn-hydrated', text: 'user asks for robust filtering' } }),
      JSON.stringify({ type: 'assistant_message', payload: { turn_id: 'turn-hydrated', text: 'assistant reports verified outcome' } }),
      JSON.stringify({ type: 'tool_result', payload: { turn_id: 'turn-hydrated', output: 'tool execution completed' } }),
    ].join('\n')}\n`,
    'utf8',
  );

  const agentRoot = join(sharedRoot, 'agents', 'research-agent');
  const rawCaptureDir = join(agentRoot, 'memory', 'raw-capture');
  await writeRawCaptureRecord(rawCaptureDir, {
    schema_version: '1',
    message_id: 'raw-hydrated-1',
    identity_id: 'research-agent',
    object_kind: 'raw_capture',
    object_ref: 'raw-capture:raw-hydrated-1',
    event_type: 'captured',
    evidence_refs: ['input:raw-hydrated-1'],
    observed_at: '2026-04-08T00:00:00.000Z',
    source_kind: 'direct_input',
    session_id: 'session-hydrated',
    thread_id: 'thread-hydrated',
    turn_id: 'turn-hydrated',
    event: 'stop',
    rollout_path_hint: rolloutPath,
    workspace_root: workspaceRoot,
    assistant_summary: null,
    candidates: [],
    input: 'please extract memory from this turn',
  }, 'raw-hydrated-1');

  let capturedBody: Record<string, unknown> | null = null;
  const server = await startResponsesTestServer([
    JSON.stringify({
      event_type: 'captured',
      object_kind: 'episode',
      signal_type: 'environmental_outcome',
      polarity: 'supporting',
      summary: 'hydrated evidence indicates reusable outcome',
      evidence_refs: ['rollout:turn-hydrated'],
      quality: {
        observable: true,
        linkable: true,
        evaluatable: true,
        distillable: true,
        status: 'pass',
        reasons: [],
      },
      confidence: 0.8,
      parser_reason: 'hydrated-test',
    }),
  ], (body) => {
    capturedBody = body;
  });

  try {
    const fakeHome = await writeDistillResponsesConfig(server.baseUrl);
    const distillResult = await runReve(
      ['distill', '--agent-id', 'research-agent', '--limit', '10'],
      workspaceRoot,
      { ...sharedEnv, HOME: fakeHome },
    );
    assert.equal(distillResult.code, 0);
    assert.match(distillResult.stdout, /Distilled short-term records: 1/);
    assert(capturedBody);
    const prompt = String((capturedBody as { input?: string }).input ?? '');
    assert.match(prompt, /hydrated_context/i);
    assert.match(prompt, /assistant reports verified outcome/i);
  } finally {
    await server.close();
  }
});

test('distill falls back to raw-only when hydration is unavailable', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-reve-distill-hydration-fallback-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-reve-distill-hydration-fallback-shared-'));
  const sharedEnv = {
    OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
  };
  assert.equal((await runLauncher(['init', '--agent-id', 'research-agent'], workspaceRoot, sharedEnv)).code, 0);

  const agentRoot = join(sharedRoot, 'agents', 'research-agent');
  const rawCaptureDir = join(agentRoot, 'memory', 'raw-capture');
  await writeRawCaptureRecord(rawCaptureDir, {
    schema_version: '1',
    message_id: 'raw-hydration-fallback-1',
    identity_id: 'research-agent',
    object_kind: 'raw_capture',
    object_ref: 'raw-capture:raw-hydration-fallback-1',
    event_type: 'captured',
    evidence_refs: ['input:raw-hydration-fallback-1'],
    observed_at: '2026-04-08T00:00:00.000Z',
    source_kind: 'direct_input',
    session_id: 'session-fallback',
    thread_id: 'thread-fallback',
    turn_id: 'turn-fallback',
    event: 'stop',
    rollout_path_hint: '/path/does/not/exist/rollout.jsonl',
    workspace_root: workspaceRoot,
    assistant_summary: null,
    candidates: [],
    input: 'try distill even if hydration path fails',
  }, 'raw-hydration-fallback-1');

  const server = await startResponsesTestServer([
    JSON.stringify({
      event_type: 'captured',
      object_kind: 'episode',
      signal_type: 'explicit',
      polarity: 'supporting',
      summary: 'raw-only fallback still distilled',
      evidence_refs: ['input:raw-hydration-fallback-1'],
      quality: {
        observable: true,
        linkable: true,
        evaluatable: true,
        distillable: true,
        status: 'pass',
        reasons: [],
      },
      confidence: 0.65,
      parser_reason: 'fallback-test',
    }),
  ]);

  try {
    const fakeHome = await writeDistillResponsesConfig(server.baseUrl);
    const distillResult = await runReve(
      ['distill', '--agent-id', 'research-agent', '--limit', '10'],
      workspaceRoot,
      { ...sharedEnv, HOME: fakeHome },
    );
    assert.equal(distillResult.code, 0);
    assert.match(distillResult.stdout, /Distilled short-term records: 1/);

    const shortTermFiles = await readdir(join(agentRoot, 'memory', 'short-term'));
    assert.equal(shortTermFiles.length, 1);
  } finally {
    await server.close();
  }
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
        [
          'run',
          '--agent-id',
          'research-agent',
          '--input',
          '[hook flush] session=config-s1\nassistant=config provider path verified\ncandidates:\n- environmental_outcome/supporting: provider config loaded [turn:config-t1]',
        ],
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
  assert.equal(runSummary.status, 'success');
  assert.equal(runSummary.failure_reason, null);
  assert.equal(runSummary.skip_reason, null);
  assert.equal(learning.consolidation_run_id, runSummary.run_id);
});

test('consolidate exits when consolidate lock already exists', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-reve-lock-consolidate-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-reve-lock-consolidate-shared-'));
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
  const lockDir = join(agentRoot, 'runtime', 'locks');
  await mkdir(lockDir, { recursive: true });
  const lockPath = join(lockDir, 'consolidate.lock');
  await writeFile(lockPath, 'locked', 'utf8');

  const consolidateResult = await runReve(
    ['consolidate', '--agent-id', 'research-agent', '--limit', '10', '--batch-size', '5'],
    workspaceRoot,
    consolidateEnv,
  );
  assert.equal(consolidateResult.code, 1);
  assert.match(consolidateResult.stderr, /Command consolidate already running/i);

  const longTermDir = join(agentRoot, 'memory', 'long-term');
  const longTermFiles = await readdir(longTermDir);
  assert.equal(longTermFiles.length, 0);
  const runsDir = join(agentRoot, 'runs');
  const runFiles = await readdir(runsDir);
  assert.equal(runFiles.length, 0);
  await unlink(lockPath);
});

test('distill and consolidate use separate lock files', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-reve-lock-separate-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-reve-lock-separate-shared-'));
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
  const lockDir = join(agentRoot, 'runtime', 'locks');
  await mkdir(lockDir, { recursive: true });
  const distillLock = join(lockDir, 'distill.lock');
  await writeFile(distillLock, 'locked', 'utf8');

  const shortTermDir = join(agentRoot, 'memory', 'short-term');
  await mkdir(shortTermDir, { recursive: true });
  const episodeIds = ['lock-episode-1', 'lock-episode-2'];
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
  assert.equal(await readFile(distillLock, 'utf8'), 'locked');
  await unlink(distillLock);
});

test('consolidate leaves no learning file when validation fails', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-reve-consolidate-fail-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-reve-consolidate-fail-shared-'));
  const sharedEnv = {
    OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
  };
  const server = await startResponsesTestServer([
    JSON.stringify({
      status: 'learning_created',
      learning: {
        message_id: 'invalid-learning',
        identity_id: 'research-agent',
        object_ref: 'learning:invalid-learning',
        source_episode_ids: ['force-invalid-learning-1', 'force-invalid-learning-2'],
        summary: 'invalid response',
        applicability: 'invalid response',
        failure_conditions: 'invalid response',
        evidence_refs: [],
        confidence: 0,
      },
    }),
  ]);

  try {
    const configPath = await writeConsolidateResponsesConfig(server.baseUrl);

    assert.equal((await runLauncher(['init', '--agent-id', 'research-agent'], workspaceRoot, sharedEnv)).code, 0);
    const agentRoot = join(sharedRoot, 'agents', 'research-agent');
    const shortTermDir = join(agentRoot, 'memory', 'short-term');
    await mkdir(shortTermDir, { recursive: true });

    const episodes = ['force-invalid-learning-1', 'force-invalid-learning-2'];
    for (const episodeId of episodes) {
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
      {
        ...sharedEnv,
        OBSIDIAN_AGENT_MEMORY_SERVER_CODEX_CONFIG_PATH: configPath,
      },
    );
    assert.equal(consolidateResult.code, 1);
    assert.match(consolidateResult.stderr, /quality/i);

    const longTermDir = join(agentRoot, 'memory', 'long-term');
    const longTermFiles = await readdir(longTermDir);
    assert.equal(longTermFiles.length, 0);

    const runsDir = join(agentRoot, 'runs');
    const runFiles = await readdir(runsDir);
    assert.equal(runFiles.length, 1);
    const runSummary = JSON.parse(await readFile(join(runsDir, runFiles[0]!), 'utf8'));
    assert.equal(runSummary.status, 'failed');
    assert.equal(runSummary.skip_reason, null);
    assert.ok(runSummary.failure_reason?.includes('quality'));
    assert.equal(runSummary.learning_created, 0);
  } finally {
    await server.close();
  }
});

test('consolidate sends provider-compatible schema with required reason and nullable learning', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-reve-consolidate-schema-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-reve-consolidate-schema-shared-'));
  const sharedEnv = {
    OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
  };
  let capturedBody: Record<string, unknown> | null = null;
  const server = await startResponsesTestServer(
    [
      JSON.stringify({
        status: 'learning_created',
        reason: 'episodes converge on a stable operator learning',
        learning: {
          message_id: 'schema-learning-1',
          identity_id: 'research-agent',
          object_ref: 'learning:schema-learning-1',
          source_episode_ids: ['schema-episode-1', 'schema-episode-2'],
          summary: 'Fixed-window batching is the stable first-pass consolidation strategy.',
          applicability: 'Use during MVP offline consolidation when evidence volume is still low.',
          failure_conditions: 'Avoid applying when strong conflicting episodes dominate.',
          evidence_refs: ['evidence-schema-1', 'evidence-schema-2'],
          confidence: 0.84,
          quality: {
            observable: true,
            linkable: true,
            evaluatable: true,
            distillable: true,
            status: 'pass',
            reasons: [],
          },
        },
      }),
    ],
    (body) => {
      capturedBody = body;
    },
  );

  try {
    const configPath = await writeConsolidateResponsesConfig(server.baseUrl);

    assert.equal((await runLauncher(['init', '--agent-id', 'research-agent'], workspaceRoot, sharedEnv)).code, 0);
    const agentRoot = join(sharedRoot, 'agents', 'research-agent');
    const shortTermDir = join(agentRoot, 'memory', 'short-term');
    await mkdir(shortTermDir, { recursive: true });

    for (const episodeId of ['schema-episode-1', 'schema-episode-2']) {
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
      {
        ...sharedEnv,
        OBSIDIAN_AGENT_MEMORY_SERVER_CODEX_CONFIG_PATH: configPath,
      },
    );
    assert.equal(consolidateResult.code, 0);
    assert(capturedBody);

    const text = (capturedBody as { text?: { format?: { schema?: Record<string, unknown> } } }).text;
    const schema = text?.format?.schema as {
      required?: string[];
      properties?: Record<string, unknown>;
    };
    assert.deepEqual(schema.required, ['status', 'reason', 'learning']);

    const learningProperty = schema.properties?.learning as { anyOf?: Array<Record<string, unknown>> };
    assert(Array.isArray(learningProperty.anyOf));
    assert.equal(
      learningProperty.anyOf?.some((entry) => entry.type === 'null'),
      true,
    );
  } finally {
    await server.close();
  }
});

test('consolidate leaves no learning file when responses output is invalid JSON', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-reve-consolidate-parse-fail-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-reve-consolidate-parse-fail-shared-'));
  const sharedEnv = {
    OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
  };

  const server = await startResponsesTestServer(['{not-json']);

  try {
    const configPath = await writeConsolidateResponsesConfig(server.baseUrl);

    assert.equal((await runLauncher(['init', '--agent-id', 'research-agent'], workspaceRoot, sharedEnv)).code, 0);
    const agentRoot = join(sharedRoot, 'agents', 'research-agent');
    const shortTermDir = join(agentRoot, 'memory', 'short-term');
    await mkdir(shortTermDir, { recursive: true });

    const episodes = ['parse-fail-1', 'parse-fail-2'];
    for (const episodeId of episodes) {
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
      {
        ...sharedEnv,
        OBSIDIAN_AGENT_MEMORY_SERVER_CODEX_CONFIG_PATH: configPath,
      },
    );
    assert.equal(consolidateResult.code, 1);
    assert.match(consolidateResult.stderr, /Unexpected token|Expected property name|JSON/i);

    const longTermDir = join(agentRoot, 'memory', 'long-term');
    const longTermFiles = await readdir(longTermDir);
    assert.equal(longTermFiles.length, 0);

    const runsDir = join(agentRoot, 'runs');
    const runFiles = await readdir(runsDir);
    assert.equal(runFiles.length, 1);
    const runSummary = JSON.parse(await readFile(join(runsDir, runFiles[0]!), 'utf8'));
    assert.equal(runSummary.status, 'failed');
    assert.equal(runSummary.skip_reason, null);
    assert.ok(runSummary.failure_reason?.match(/Unexpected token|Expected property name|JSON/i));
    assert.equal(runSummary.learning_created, 0);
  } finally {
    await server.close();
  }
});

test('consolidate rolls back earlier staged learnings if a later batch fails', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-reve-consolidate-staged-fail-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-reve-consolidate-staged-fail-shared-'));
  const sharedEnv = {
    OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
  };
  const server = await startResponsesTestServer([
    JSON.stringify({
      status: 'learning_created',
      learning: {
        message_id: 'stage-learning-ok',
        identity_id: 'research-agent',
        object_ref: 'learning:stage-learning-ok',
        source_episode_ids: ['stage-ok-1', 'stage-ok-2'],
        summary: 'valid learning',
        applicability: 'valid learning',
        failure_conditions: 'valid learning',
        evidence_refs: ['evidence-stage-ok-1', 'evidence-stage-ok-2'],
        confidence: 0.8,
        quality: {
          observable: true,
          linkable: true,
          evaluatable: true,
          distillable: true,
          status: 'pass',
          reasons: [],
        },
      },
    }),
    '{not-json',
  ]);

  try {
    const configPath = await writeConsolidateResponsesConfig(server.baseUrl);

    assert.equal((await runLauncher(['init', '--agent-id', 'research-agent'], workspaceRoot, sharedEnv)).code, 0);
    const agentRoot = join(sharedRoot, 'agents', 'research-agent');
    const shortTermDir = join(agentRoot, 'memory', 'short-term');
    await mkdir(shortTermDir, { recursive: true });

    const episodes = [
      {
        id: 'stage-ok-1',
        summary: 'valid batch one a',
        evidence_refs: ['evidence-stage-ok-1'],
      },
      {
        id: 'stage-ok-2',
        summary: 'valid batch one b',
        evidence_refs: ['evidence-stage-ok-2'],
      },
      {
        id: 'stage-bad-1',
        summary: 'invalid batch two a',
        evidence_refs: ['evidence-stage-bad-1'],
      },
      {
        id: 'stage-bad-2',
        summary: 'invalid batch two b',
        evidence_refs: ['evidence-stage-bad-2'],
      },
    ];

    for (const episode of episodes) {
      const entry = {
        schema_version: '1',
        message_id: episode.id,
        identity_id: 'research-agent',
        object_kind: 'episode',
        event_type: 'captured',
        summary: episode.summary,
        evidence_refs: episode.evidence_refs,
      };
      await writeFile(join(shortTermDir, `${episode.id}.json`), `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
    }

    const consolidateResult = await runReve(
      ['consolidate', '--agent-id', 'research-agent', '--limit', '10', '--batch-size', '2'],
      workspaceRoot,
      {
        ...sharedEnv,
        OBSIDIAN_AGENT_MEMORY_SERVER_CODEX_CONFIG_PATH: configPath,
      },
    );
    assert.equal(consolidateResult.code, 1);
    assert.match(consolidateResult.stderr, /Unexpected token|Expected property name|JSON/i);

    const longTermDir = join(agentRoot, 'memory', 'long-term');
    const longTermFiles = await readdir(longTermDir);
    assert.equal(longTermFiles.length, 0);

    const runsDir = join(agentRoot, 'runs');
    const runFiles = await readdir(runsDir);
    assert.equal(runFiles.length, 1);
    const runSummary = JSON.parse(await readFile(join(runsDir, runFiles[0]!), 'utf8'));
    assert.equal(runSummary.status, 'failed');
    assert.equal(runSummary.learning_created, 0);
    assert.equal(runSummary.failure_reason?.match(/Unexpected token|Expected property name|JSON/i) !== null, true);
  } finally {
    await server.close();
  }
});

test('distill run summaries record skip reasons when no pending raw capture', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-reve-distill-skip-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-reve-distill-skip-shared-'));
  const sharedEnv = {
    OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
  };

  assert.equal((await runLauncher(['init', '--agent-id', 'research-agent'], workspaceRoot, sharedEnv)).code, 0);
  await runLauncher(
    ['run', '--agent-id', 'research-agent', '--input', '[hook flush] session=s-skip\nassistant=done'],
    workspaceRoot,
    sharedEnv,
  );
  assert.equal(
    (
      await runReve(
        ['distill', '--agent-id', 'research-agent', '--limit', '5'],
        workspaceRoot,
        { ...sharedEnv, OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_PROVIDER: 'mock' },
      )
    ).code,
    0,
  );

  const secondDistill = await runReve(
    ['distill', '--agent-id', 'research-agent', '--limit', '5'],
    workspaceRoot,
    { ...sharedEnv, OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_PROVIDER: 'mock' },
  );
  assert.equal(secondDistill.code, 0);

  const agentRoot = join(sharedRoot, 'agents', 'research-agent');
  const runsDir = join(agentRoot, 'runs');
  const runFiles = await readdir(runsDir);
  let skippedSummary: null | Record<string, unknown> = null;
  for (const file of runFiles) {
    const summary = JSON.parse(await readFile(join(runsDir, file), 'utf8'));
    if (summary.status === 'skipped') {
      skippedSummary = summary;
      break;
    }
  }
  assert(skippedSummary);
  if (skippedSummary) {
    assert.equal(skippedSummary.status, 'skipped');
    assert.equal(skippedSummary.skip_reason, 'no_pending_raw_captures');
    assert.equal(skippedSummary.failure_reason, null);
  }
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

test('drive orchestrates distill and consolidate end-to-end with idempotent reruns', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'agent-reve-drive-e2e-'));
  const sharedRoot = await mkdtemp(join(tmpdir(), 'agent-reve-drive-e2e-shared-'));
  const sharedEnv = {
    OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
  };
  const driveEnv = {
    ...sharedEnv,
    OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_PROVIDER: 'mock',
    OBSIDIAN_AGENT_MEMORY_SERVER_CONSOLIDATE_PROVIDER: 'mock',
    OBSIDIAN_AGENT_MEMORY_SERVER_CONSOLIDATE_MODEL: 'gpt-5.2',
  };

  assert.equal((await runLauncher(['init', '--agent-id', 'research-agent'], workspaceRoot, sharedEnv)).code, 0);

  const agentRoot = join(sharedRoot, 'agents', 'research-agent');
  const rawCaptureDir = join(agentRoot, 'memory', 'raw-capture');
  await mkdir(rawCaptureDir, { recursive: true });

  const rawCaptures = [
    {
      schema_version: '1',
      message_id: 'drive-raw-1',
      identity_id: 'research-agent',
      object_kind: 'raw_capture',
      object_ref: 'raw_capture:drive-raw-1',
      event_type: 'captured',
      evidence_refs: ['turn:drive-1'],
      observed_at: '2026-04-08T01:00:00.000Z',
      source_kind: 'hook_flush',
      session_id: 'drive-session',
      workspace_root: workspaceRoot,
      assistant_summary: 'episode one',
      candidates: [
        {
          signal_type: 'environmental_outcome',
          polarity: 'supporting',
          summary: 'first signal',
          evidence_refs: ['turn:drive-1'],
        },
      ],
      input: 'raw capture one',
    },
    {
      schema_version: '1',
      message_id: 'drive-raw-2',
      identity_id: 'research-agent',
      object_kind: 'raw_capture',
      object_ref: 'raw_capture:drive-raw-2',
      event_type: 'captured',
      evidence_refs: ['turn:drive-2'],
      observed_at: '2026-04-08T01:01:00.000Z',
      source_kind: 'hook_flush',
      session_id: 'drive-session',
      workspace_root: workspaceRoot,
      assistant_summary: 'episode two',
      candidates: [
        {
          signal_type: 'environmental_outcome',
          polarity: 'supporting',
          summary: 'second signal',
          evidence_refs: ['turn:drive-2'],
        },
      ],
      input: 'raw capture two',
    },
  ];

  for (const capture of rawCaptures) {
    await writeFile(join(rawCaptureDir, `${capture.message_id}.json`), `${JSON.stringify(capture, null, 2)}\n`, 'utf8');
  }

  const firstDrive = await runReveBin(
    ['drive', '--agent-id', 'research-agent', '--limit', '10', '--batch-size', '5'],
    workspaceRoot,
    driveEnv,
  );
  assert.equal(firstDrive.code, 0);

  const shortTermDir = join(agentRoot, 'memory', 'short-term');
  const longTermDir = join(agentRoot, 'memory', 'long-term');
  const runsDir = join(agentRoot, 'runs');
  const firstEpisodeFiles = await readdir(shortTermDir);
  const firstLearningFiles = await readdir(longTermDir);
  assert(firstEpisodeFiles.length > 0);
  assert(firstLearningFiles.length > 0);

  const firstRunFiles = await readdir(runsDir);
  const firstDriveSummaries: Array<Record<string, unknown>> = [];
  for (const file of firstRunFiles) {
    const summary = JSON.parse(await readFile(join(runsDir, file), 'utf8'));
    if (summary.command === 'drive') {
      firstDriveSummaries.push(summary);
    }
  }
  assert.equal(firstDriveSummaries.length, 1);
  assert.equal(firstDriveSummaries[0]?.status, 'success');

  const secondDrive = await runReveBin(
    ['drive', '--agent-id', 'research-agent', '--limit', '10', '--batch-size', '5'],
    workspaceRoot,
    driveEnv,
  );
  assert.equal(secondDrive.code, 0);

  const secondEpisodeFiles = await readdir(shortTermDir);
  const secondLearningFiles = await readdir(longTermDir);
  assert.equal(secondEpisodeFiles.length, firstEpisodeFiles.length);
  assert.equal(secondLearningFiles.length, firstLearningFiles.length);
});
