import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { readFileSync, realpathSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

type AgentIdentity = {
  agent_id: string;
  canonical_name: string;
  specialization: string;
  mission: string;
  lineage: string;
};

type AgentScope = {
  scope_type?: 'repo-local';
  workspace_root?: string;
};

type ShortTermSignalPolarity = 'supporting' | 'conflicting' | 'insufficient';

type ParsedShortTermCandidate = {
  signal_type: string;
  polarity: ShortTermSignalPolarity;
  summary: string;
  evidence_refs: string[];
};

type RawCaptureEvent = {
  schema_version: '1';
  message_id: string;
  identity_id: string;
  object_kind: 'raw_capture';
  object_ref: string;
  event_type: 'captured';
  evidence_refs: string[];
  observed_at: string;
  source_kind: 'hook_flush' | 'direct_input';
  session_id: string | null;
  workspace_root: string | null;
  assistant_summary: string | null;
  candidates: ParsedShortTermCandidate[];
  input: string;
};

type DistilledShortTerm = {
  event_type: 'captured';
  object_kind: 'episode';
  signal_type: string;
  polarity: ShortTermSignalPolarity;
  summary: string;
  evidence_refs: string[];
  quality: {
    observable: boolean;
    linkable: boolean;
    evaluatable: boolean;
    distillable: boolean;
    status: 'pass' | 'needs_review' | 'rejected';
    reasons: string[];
  };
  confidence: number;
  parser_reason: string;
};

type DistillProviderRuntime = {
  provider: string;
  model: string;
  baseUrl?: string;
  wireApi?: string;
  requiresOpenAIAuth: boolean;
};

function resolveStorageRoot() {
  return (
    process.env.OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT ??
    process.env.OBSIDIAN_AGENT_MEMORY_SERVER_ROOT ??
    process.cwd()
  );
}

function resolveWorkspaceRoot() {
  return (
    process.env.OBSIDIAN_AGENT_MEMORY_SERVER_WORKSPACE_ROOT ??
    process.cwd()
  );
}

function canonicalizePath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

function parseArgs(argv: string[]) {
  const [command, ...rest] = argv;
  const options = new Map<string, string>();

  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];

    if (!key?.startsWith('--') || value === undefined) {
      throw new Error(`Invalid arguments: ${rest.join(' ')}`);
    }

    options.set(key.slice(2), value);
  }

  return { command, options };
}

function createTimestamp() {
  return new Date().toISOString();
}

async function writeJsonFile(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readAgentScope(agentId: string, rootDir: string): Promise<AgentScope | null> {
  const scopePath = join(rootDir, 'agents', agentId, 'identity', 'agent_scope.json');

  try {
    const content = await readFile(scopePath, 'utf8');
    return JSON.parse(content) as AgentScope;
  } catch {
    return null;
  }
}

async function isAgentVisibleToWorkspace(
  agentId: string,
  rootDir: string,
  workspaceRoot: string,
): Promise<{ visible: boolean; scopeRoot?: string }> {
  const scope = await readAgentScope(agentId, rootDir);
  if (!scope || scope.scope_type !== 'repo-local') {
    return { visible: true };
  }

  const scopeRoot = scope.workspace_root?.trim();
  if (!scopeRoot) {
    return { visible: false, scopeRoot: '<missing>' };
  }

  return {
    visible: canonicalizePath(scopeRoot) === canonicalizePath(workspaceRoot),
    scopeRoot: canonicalizePath(scopeRoot),
  };
}

async function assertAgentVisible(agentId: string, rootDir: string, workspaceRoot: string) {
  const visibility = await isAgentVisibleToWorkspace(agentId, rootDir, workspaceRoot);
  if (!visibility.visible) {
    throw new Error(`Agent identity ${agentId} is scoped to ${visibility.scopeRoot}`);
  }
}

async function readIdentity(agentId: string, rootDir: string) {
  const identityPath = join(rootDir, 'agents', agentId, 'identity', 'agent_identity.json');
  let content: string;

  try {
    content = await readFile(identityPath, 'utf8');
  } catch (error) {
    const typed = error as NodeJS.ErrnoException;
    if (typed.code === 'ENOENT') {
      throw new Error(`Missing agent_identity.json for ${agentId}. Run init first.`);
    }
    throw error;
  }

  const identity = JSON.parse(content) as Partial<AgentIdentity>;
  const requiredKeys: Array<keyof AgentIdentity> = [
    'agent_id',
    'canonical_name',
    'specialization',
    'mission',
    'lineage',
  ];

  for (const key of requiredKeys) {
    if (typeof identity[key] !== 'string' || identity[key]?.trim() === '') {
      throw new Error(`Invalid agent_identity.json: missing or empty ${key}`);
    }
  }

  if (identity.agent_id !== agentId) {
    throw new Error(`agent_id mismatch: expected ${agentId}, got ${identity.agent_id}`);
  }

  return identity as AgentIdentity;
}

function parseTomlValue(raw: string): string | boolean | number {
  const trimmed = raw.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber)) {
    return asNumber;
  }
  return trimmed;
}

function loadCodexConfigToml(): {
  topLevel: Record<string, string | boolean | number>;
  sections: Record<string, Record<string, string | boolean | number>>;
} {
  const configPath = process.env.OBSIDIAN_AGENT_MEMORY_SERVER_CODEX_CONFIG_PATH?.trim()
    || process.env.CODEX_CONFIG_PATH?.trim()
    || join(homedir(), '.codex', 'config.toml');

  let content = '';
  try {
    content = readFileSync(configPath, 'utf8');
  } catch {
    return { topLevel: {}, sections: {} };
  }

  const topLevel: Record<string, string | boolean | number> = {};
  const sections: Record<string, Record<string, string | boolean | number>> = {};
  let currentSection: string | null = null;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1]!.trim();
      if (!sections[currentSection]) {
        sections[currentSection] = {};
      }
      continue;
    }

    const kvMatch = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
    if (!kvMatch) {
      continue;
    }
    const key = kvMatch[1]!.trim();
    const value = parseTomlValue(kvMatch[2]!);

    if (currentSection) {
      sections[currentSection]![key] = value;
    } else {
      topLevel[key] = value;
    }
  }

  return { topLevel, sections };
}

function readDistillRuntimeConfig(): DistillProviderRuntime {
  const parsedConfig = loadCodexConfigToml();
  const envProvider = process.env.OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_PROVIDER?.trim().toLowerCase();
  const providerFromConfig = typeof parsedConfig.topLevel.model_provider === 'string'
    ? String(parsedConfig.topLevel.model_provider).trim().toLowerCase()
    : '';

  const provider = envProvider || providerFromConfig || 'mock';

  const sectionKey = `model_providers.${provider}`;
  const providerSection = parsedConfig.sections[sectionKey] ?? {};

  const modelFromConfig = typeof parsedConfig.topLevel.model === 'string'
    ? String(parsedConfig.topLevel.model).trim()
    : '';
  const envModel = process.env.OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_MODEL?.trim();
  const model = envModel || modelFromConfig || 'gpt-5.4-mini';

  const baseUrl = typeof providerSection.base_url === 'string'
    ? String(providerSection.base_url).trim()
    : provider === 'openai'
      ? 'https://api.openai.com'
      : undefined;

  const wireApi = typeof providerSection.wire_api === 'string'
    ? String(providerSection.wire_api).trim()
    : 'responses';

  const requiresOpenAIAuth = typeof providerSection.requires_openai_auth === 'boolean'
    ? Boolean(providerSection.requires_openai_auth)
    : provider === 'openai';

  return {
    provider,
    model,
    baseUrl,
    wireApi,
    requiresOpenAIAuth,
  };
}

async function distillWithResponsesApi(raw: RawCaptureEvent, runtime: DistillProviderRuntime): Promise<DistilledShortTerm> {
  if (!runtime.baseUrl) {
    throw new Error(`Missing base_url for distill provider: ${runtime.provider}`);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (runtime.requiresOpenAIAuth) {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(`Missing OPENAI_API_KEY for distill provider: ${runtime.provider}`);
    }
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const prompt = [
    'You are a short-term memory filter for agentic systems.',
    'Return strict JSON only with keys: event_type, object_kind, signal_type, polarity, summary, evidence_refs, quality, confidence, parser_reason.',
    'Rules:',
    '- event_type must be captured',
    '- object_kind must be episode',
    '- polarity in supporting/conflicting/insufficient',
    '- quality.status in pass/needs_review/rejected',
    '- no markdown',
    `raw_capture=${JSON.stringify(raw)}`,
  ].join('\n');

  const normalizedBase = runtime.baseUrl.replace(/\/+$/, '');
  const endpoint = runtime.wireApi === 'responses'
    ? `${normalizedBase}/v1/responses`
    : `${normalizedBase}/v1/responses`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: runtime.model,
      input: prompt,
      text: {
        format: {
          type: 'json_schema',
          name: 'short_term_memory_filter',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              event_type: { type: 'string' },
              object_kind: { type: 'string' },
              signal_type: { type: 'string' },
              polarity: { type: 'string' },
              summary: { type: 'string' },
              evidence_refs: { type: 'array', items: { type: 'string' } },
              quality: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  observable: { type: 'boolean' },
                  linkable: { type: 'boolean' },
                  evaluatable: { type: 'boolean' },
                  distillable: { type: 'boolean' },
                  status: { type: 'string' },
                  reasons: { type: 'array', items: { type: 'string' } },
                },
                required: ['observable', 'linkable', 'evaluatable', 'distillable', 'status', 'reasons'],
              },
              confidence: { type: 'number' },
              parser_reason: { type: 'string' },
            },
            required: [
              'event_type',
              'object_kind',
              'signal_type',
              'polarity',
              'summary',
              'evidence_refs',
              'quality',
              'confidence',
              'parser_reason',
            ],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Distill failed (${runtime.provider}): ${response.status} ${response.statusText}`);
  }

  const parsedResponse = await response.json() as { output_text?: string };
  if (!parsedResponse.output_text) {
    throw new Error('OpenAI distill response missing output_text');
  }

  return JSON.parse(parsedResponse.output_text) as DistilledShortTerm;
}

async function distillWithMock(raw: RawCaptureEvent): Promise<DistilledShortTerm> {
  const firstCandidate = raw.candidates[0];
  const summary = firstCandidate?.summary ?? raw.assistant_summary ?? raw.input.slice(0, 200);
  const signalType = firstCandidate?.signal_type ?? (raw.source_kind === 'hook_flush' ? 'environmental_outcome' : 'explicit');
  const polarity = firstCandidate?.polarity ?? 'supporting';
  const evidenceRefs = firstCandidate?.evidence_refs?.length
    ? firstCandidate.evidence_refs
    : raw.evidence_refs;

  return {
    event_type: 'captured',
    object_kind: 'episode',
    signal_type: signalType,
    polarity,
    summary,
    evidence_refs: evidenceRefs,
    quality: {
      observable: true,
      linkable: evidenceRefs.length > 0,
      evaluatable: Boolean(summary),
      distillable: raw.source_kind === 'hook_flush' ? raw.candidates.length > 0 : false,
      status: summary ? 'pass' : 'needs_review',
      reasons: summary ? [] : ['missing_summary'],
    },
    confidence: raw.source_kind === 'hook_flush' ? 0.78 : 0.62,
    parser_reason: `mock:${raw.source_kind}`,
  };
}

async function distillRawCapture(raw: RawCaptureEvent): Promise<DistilledShortTerm> {
  const runtime = readDistillRuntimeConfig();
  if (runtime.provider === 'mock') {
    return distillWithMock(raw);
  }
  if (runtime.wireApi === 'responses' || runtime.provider === 'openai' || runtime.baseUrl) {
    return distillWithResponsesApi(raw, runtime);
  }
  throw new Error(`Unsupported distill provider: ${runtime.provider}`);
}

async function readRawCaptureEvents(rawCaptureDir: string): Promise<Array<{ path: string; value: RawCaptureEvent }>> {
  const files = (await readdir(rawCaptureDir)).filter((file) => file.endsWith('.json')).sort();
  const events: Array<{ path: string; value: RawCaptureEvent }> = [];
  for (const file of files) {
    const path = join(rawCaptureDir, file);
    const content = await readFile(path, 'utf8');
    events.push({
      path,
      value: JSON.parse(content) as RawCaptureEvent,
    });
  }
  return events;
}

async function readShortTermSourceIds(shortTermDir: string): Promise<Set<string>> {
  const files = (await readdir(shortTermDir)).filter((file) => file.endsWith('.json')).sort();
  const sourceIds = new Set<string>();
  for (const file of files) {
    const path = join(shortTermDir, file);
    const content = await readFile(path, 'utf8');
    const parsed = JSON.parse(content) as { source_message_id?: string };
    if (parsed.source_message_id) {
      sourceIds.add(parsed.source_message_id);
    }
  }
  return sourceIds;
}

async function handleDistill(agentId: string, limitRaw: string | undefined, rootDir: string) {
  const agentRoot = join(rootDir, 'agents', agentId);
  const rawCaptureDir = join(agentRoot, 'memory', 'raw-capture');
  const shortTermDir = join(agentRoot, 'memory', 'short-term');
  const runsDir = join(agentRoot, 'runs');

  const identity = await readIdentity(agentId, rootDir);
  await mkdir(rawCaptureDir, { recursive: true });
  await mkdir(shortTermDir, { recursive: true });
  await mkdir(runsDir, { recursive: true });

  const maxItems = Number.parseInt(limitRaw ?? '20', 10);
  if (!Number.isInteger(maxItems) || maxItems <= 0) {
    throw new Error(`Invalid --limit value: ${limitRaw ?? '<missing>'}`);
  }

  const allRaw = await readRawCaptureEvents(rawCaptureDir);
  const processedSourceIds = await readShortTermSourceIds(shortTermDir);
  const pending = allRaw.filter((event) => !processedSourceIds.has(event.value.message_id)).slice(0, maxItems);
  const runtimeConfig = readDistillRuntimeConfig();

  let distilledCount = 0;
  let skippedCount = 0;
  for (const item of pending) {
    try {
      const distilled = await distillRawCapture(item.value);
      if (distilled.quality.status === 'rejected') {
        skippedCount += 1;
        continue;
      }

      const observedAt = createTimestamp();
      const shortTermId = randomUUID();
      const shortTermObject = {
        schema_version: '1',
        message_id: shortTermId,
        source_message_id: item.value.message_id,
        identity_id: identity.agent_id,
        filtered_by_model: true,
        model_provider: runtimeConfig.provider,
        model_name: runtimeConfig.model,
        object_kind: distilled.object_kind,
        object_ref: `episode:${shortTermId}`,
        event_type: distilled.event_type,
        signal_type: distilled.signal_type,
        polarity: distilled.polarity,
        summary: distilled.summary,
        evidence_refs: distilled.evidence_refs,
        confidence: Math.max(0, Math.min(1, distilled.confidence)),
        parser_reason: distilled.parser_reason,
        quality: distilled.quality,
        raw_capture_ref: item.path,
        observed_at: observedAt,
      };

      const shortTermPath = join(shortTermDir, `${observedAt.replaceAll(':', '-')}-${shortTermId}.json`);
      await writeJsonFile(shortTermPath, shortTermObject);
      distilledCount += 1;
    } catch {
      skippedCount += 1;
    }
  }

  const runId = randomUUID();
  const observedAt = createTimestamp();
  const runSummary = {
    run_id: runId,
    agent_id: identity.agent_id,
    distill_source: 'raw-capture',
    scanned: pending.length,
    distilled: distilledCount,
    skipped: skippedCount,
    observed_at: observedAt,
  };
  const runSummaryPath = join(runsDir, `${observedAt.replaceAll(':', '-')}-${runId}.json`);
  await writeJsonFile(runSummaryPath, runSummary);

  console.log(`Agent: ${identity.agent_id}`);
  console.log(`Distilled short-term records: ${distilledCount}`);
  console.log(`Skipped raw captures: ${skippedCount}`);
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  const rootDir = resolveStorageRoot();
  const workspaceRoot = resolveWorkspaceRoot();

  if (command === 'distill') {
    const agentId = options.get('agent-id');
    if (!agentId) {
      throw new Error('Missing required option: --agent-id');
    }
    await assertAgentVisible(agentId, rootDir, workspaceRoot);
    await handleDistill(agentId, options.get('limit'), rootDir);
    return;
  }

  throw new Error(`Unknown command: ${command ?? '<missing>'}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
