import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { readFileSync, realpathSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
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

type DistillPrefilterDecision =
  | { decision: 'reject'; reason: 'low_signal' | 'missing_anchor' }
  | { decision: 'candidate' };

type ModelProviderRuntime = {
  provider: string;
  model: string;
  baseUrl?: string;
  wireApi?: string;
  requiresOpenAIAuth: boolean;
};

type ShortTermEpisode = {
  schema_version?: string;
  message_id?: string;
  object_ref?: string;
  identity_id?: string;
  object_kind?: string;
  event_type?: string;
  signal_type?: string;
  polarity?: ShortTermSignalPolarity;
  summary?: string;
  evidence_refs?: string[];
  quality?: DistilledShortTerm['quality'];
};

type LearningQuality = DistilledShortTerm['quality'];

type DistilledLearning = {
  message_id: string;
  identity_id: string;
  object_ref: string;
  source_episode_ids: string[];
  summary: string;
  applicability: string;
  failure_conditions: string;
  evidence_refs: string[];
  confidence: number;
  quality: LearningQuality;
};

type ConsolidationStatus = 'learning_created' | 'no_learning' | 'needs_more_evidence';

type ConsolidationModelResponse = {
  status: ConsolidationStatus;
  reason?: string;
  learning?: DistilledLearning;
};

type Learning = {
  schema_version: '1';
  message_id: string;
  identity_id: string;
  object_kind: 'learning';
  object_ref: string;
  source_episode_ids: string[];
  summary: string;
  applicability: string;
  failure_conditions: string;
  evidence_refs: string[];
  confidence: number;
  quality: LearningQuality;
  observed_at: string;
  consolidation_run_id: string;
  fingerprint: string;
};

const CONSOLIDATION_STATUSES: ReadonlySet<ConsolidationStatus> = new Set([
  'learning_created',
  'no_learning',
  'needs_more_evidence',
]);
const QUALITY_STATUSES: ReadonlySet<DistilledShortTerm['quality']['status']> = new Set([
  'pass',
  'needs_review',
  'rejected',
]);

type RunStatus = 'success' | 'failed' | 'skipped';
type CommandName = 'distill' | 'consolidate' | 'drive';

type DistillCommandResult = {
  runId: string;
  status: RunStatus;
  scanned: number;
  distilledCount: number;
  skippedCount: number;
};

type ConsolidateCommandResult = {
  runId: string;
  status: RunStatus;
  episodesScanned: number;
  batchesScanned: number;
  learningRecords: number;
  statusCounts: Record<ConsolidationStatus, number>;
};

function sanitizeForFilename(value: string) {
  return value.replaceAll(':', '-');
}

async function ensureRuntimeLockDir(agentRoot: string): Promise<string> {
  const locksDir = join(agentRoot, 'runtime', 'locks');
  await mkdir(locksDir, { recursive: true });
  return locksDir;
}

function getCommandLockPath(agentRoot: string, command: CommandName): string {
  return join(agentRoot, 'runtime', 'locks', `${command}.lock`);
}

async function acquireCommandLock(agentRoot: string, command: CommandName): Promise<string> {
  const locksDir = await ensureRuntimeLockDir(agentRoot);
  const lockPath = join(locksDir, `${command}.lock`);
  try {
    await writeFile(lockPath, '', { flag: 'wx' });
    return lockPath;
  } catch (error) {
    const typed = error as NodeJS.ErrnoException;
    if (typed.code === 'EEXIST') {
      throw new Error(`Command ${command} already running (lock exists: ${lockPath})`);
    }
    throw error;
  }
}

async function releaseCommandLock(lockPath: string) {
  try {
    await unlink(lockPath);
  } catch (error) {
    const typed = error as NodeJS.ErrnoException;
    if (typed.code === 'ENOENT') {
      return;
    }
    throw error;
  }
}

async function withCommandLock<T>(
  agentRoot: string,
  command: CommandName,
  callback: () => Promise<T>,
): Promise<T> {
  const lockPath = await acquireCommandLock(agentRoot, command);
  try {
    return await callback();
  } finally {
    await releaseCommandLock(lockPath);
  }
}

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

function parsePositiveInteger(optionName: string, raw: string | undefined, fallback: number): number {
  const rawValue = (raw ?? `${fallback}`).trim();
  if (!/^[0-9]+$/.test(rawValue)) {
    throw new Error(`Invalid --${optionName} value: ${raw ?? '<missing>'}`);
  }
  const parsed = Number.parseInt(rawValue, 10);
  if (parsed <= 0) {
    throw new Error(`Invalid --${optionName} value: ${raw ?? '<missing>'}`);
  }
  return parsed;
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

function readModelProviderRuntimeConfig(options: {
  envPrefix: string;
  configProviderKey: string;
  configModelKey: string;
  defaultProvider: string;
  defaultModel: string;
}): ModelProviderRuntime {
  const parsedConfig = loadCodexConfigToml();
  const envProvider = process.env[`${options.envPrefix}_PROVIDER`]?.trim()?.toLowerCase();
  const providerFromConfig = typeof parsedConfig.topLevel[options.configProviderKey] === 'string'
    ? String(parsedConfig.topLevel[options.configProviderKey]).trim().toLowerCase()
    : '';

  const provider = envProvider || providerFromConfig || options.defaultProvider;
  const sectionKey = `model_providers.${provider}`;
  const providerSection = parsedConfig.sections[sectionKey] ?? {};

  const modelFromConfig = typeof parsedConfig.topLevel[options.configModelKey] === 'string'
    ? String(parsedConfig.topLevel[options.configModelKey]).trim()
    : '';
  const envModel = process.env[`${options.envPrefix}_MODEL`]?.trim();
  const model = envModel || modelFromConfig || options.defaultModel;

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

function readDistillRuntimeConfig(): ModelProviderRuntime {
  return readModelProviderRuntimeConfig({
    envPrefix: 'OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL',
    configProviderKey: 'model_provider',
    configModelKey: 'model',
    defaultProvider: 'mock',
    defaultModel: 'gpt-5.2',
  });
}

function readConsolidationRuntimeConfig(): ModelProviderRuntime {
  return readModelProviderRuntimeConfig({
    envPrefix: 'OBSIDIAN_AGENT_MEMORY_SERVER_CONSOLIDATE',
    configProviderKey: 'consolidate_model_provider',
    configModelKey: 'consolidate_model',
    defaultProvider: 'mock',
    defaultModel: 'gpt-5.2',
  });
}

type ResponsesApiChunk = {
  type?: string;
  text?: string;
};

type ResponsesApiMessage = {
  type?: string;
  content?: ResponsesApiChunk[];
};

type ResponsesApiJson = {
  output_text?: string;
  output?: ResponsesApiMessage[];
};

function extractResponsesOutputTextFromJson(parsedResponse: ResponsesApiJson): string | undefined {
  const normalized = parsedResponse.output_text?.trim();
  if (normalized) return normalized;

  if (!Array.isArray(parsedResponse.output)) {
    return undefined;
  }

  for (const item of parsedResponse.output) {
    if (item.type !== 'message' || !Array.isArray(item.content)) {
      continue;
    }
    for (const part of item.content) {
      if (part.type === 'output_text' && typeof part.text === 'string' && part.text.trim()) {
        return part.text.trim();
      }
    }
  }

  return undefined;
}

function extractResponsesOutputTextFromStream(streamBody: string): string | undefined {
  for (const line of streamBody.split('\n')) {
    if (!line.startsWith('data: ')) {
      continue;
    }
    let event: unknown;
    try {
      event = JSON.parse(line.slice(6));
    } catch {
      continue;
    }
    if (!event || typeof event !== 'object') {
      continue;
    }
    const typed = event as { type?: string; text?: string };
    if (typed.type === 'response.output_text.done' && typeof typed.text === 'string' && typed.text.trim()) {
      return typed.text.trim();
    }
  }

  return undefined;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function validateConsolidationModelResponse(value: unknown): ConsolidationModelResponse {
  if (!value || typeof value !== 'object') {
    throw new Error('Consolidation response must be an object');
  }

  const response = value as Partial<ConsolidationModelResponse>;
  if (!response.status || !CONSOLIDATION_STATUSES.has(response.status)) {
    throw new Error(`Consolidation response has invalid status: ${String(response.status ?? '<missing>')}`);
  }

  if (response.status !== 'learning_created') {
    return {
      status: response.status,
      reason: typeof response.reason === 'string' ? response.reason : undefined,
    };
  }

  const learning = response.learning;
  if (!learning || typeof learning !== 'object') {
    throw new Error('Consolidation response reported learning_created without a learning object');
  }

  const typedLearning = learning as Partial<DistilledLearning>;
  if (typeof typedLearning.message_id !== 'string' || !typedLearning.message_id.trim()) {
    throw new Error('Consolidation learning.message_id must be a non-empty string');
  }
  if (typeof typedLearning.identity_id !== 'string' || !typedLearning.identity_id.trim()) {
    throw new Error('Consolidation learning.identity_id must be a non-empty string');
  }
  if (typeof typedLearning.object_ref !== 'string' || !typedLearning.object_ref.trim()) {
    throw new Error('Consolidation learning.object_ref must be a non-empty string');
  }
  if (typeof typedLearning.summary !== 'string') {
    throw new Error('Consolidation learning.summary must be a string');
  }
  if (typeof typedLearning.applicability !== 'string') {
    throw new Error('Consolidation learning.applicability must be a string');
  }
  if (typeof typedLearning.failure_conditions !== 'string') {
    throw new Error('Consolidation learning.failure_conditions must be a string');
  }
  if (!isStringArray(typedLearning.source_episode_ids)) {
    throw new Error('Consolidation learning.source_episode_ids must be a string array');
  }
  if (!isStringArray(typedLearning.evidence_refs)) {
    throw new Error('Consolidation learning.evidence_refs must be a string array');
  }
  if (typeof typedLearning.confidence !== 'number' || !Number.isFinite(typedLearning.confidence)) {
    throw new Error('Consolidation learning.confidence must be a finite number');
  }
  if (!typedLearning.quality || typeof typedLearning.quality !== 'object') {
    throw new Error('Consolidation learning.quality must be an object');
  }
  const quality = typedLearning.quality as Partial<LearningQuality>;
  if (!isBoolean(quality.observable)) {
    throw new Error('Consolidation learning.quality.observable must be a boolean');
  }
  if (!isBoolean(quality.linkable)) {
    throw new Error('Consolidation learning.quality.linkable must be a boolean');
  }
  if (!isBoolean(quality.evaluatable)) {
    throw new Error('Consolidation learning.quality.evaluatable must be a boolean');
  }
  if (!isBoolean(quality.distillable)) {
    throw new Error('Consolidation learning.quality.distillable must be a boolean');
  }
  if (!quality.status || !QUALITY_STATUSES.has(quality.status)) {
    throw new Error(`Consolidation learning.quality.status is invalid: ${String(quality.status ?? '<missing>')}`);
  }
  if (!isStringArray(quality.reasons)) {
    throw new Error('Consolidation learning.quality.reasons must be a string array');
  }

  return {
    status: response.status,
    reason: typeof response.reason === 'string' ? response.reason : undefined,
    learning: typedLearning as DistilledLearning,
  };
}

async function requestResponsesOutputText(
  endpoint: string,
  headers: Record<string, string>,
  requestBody: Record<string, unknown>,
  contextLabel: 'distill' | 'consolidate',
  runtime: ModelProviderRuntime,
): Promise<string> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });
  if (!response.ok) {
    throw new Error(`${contextLabel} failed (${runtime.provider}): ${response.status} ${response.statusText}`);
  }

  const parsedResponse = await response.json() as ResponsesApiJson;
  let outputText = extractResponsesOutputTextFromJson(parsedResponse);
  if (outputText) {
    return outputText;
  }

  const streamResponse = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...requestBody,
      stream: true,
    }),
  });
  if (!streamResponse.ok) {
    throw new Error(`${contextLabel} stream fallback failed (${runtime.provider}): ${streamResponse.status} ${streamResponse.statusText}`);
  }

  outputText = extractResponsesOutputTextFromStream(await streamResponse.text());
  if (outputText) {
    return outputText;
  }

  throw new Error(`${contextLabel} response missing output text in both normal and stream modes`);
}

async function distillWithResponsesApi(raw: RawCaptureEvent, runtime: ModelProviderRuntime): Promise<DistilledShortTerm> {
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
  const endpoint = `${normalizedBase}/v1/responses`;

  const requestBody: Record<string, unknown> = {
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
  } satisfies Record<string, unknown>;

  const outputText = await requestResponsesOutputText(endpoint, headers, requestBody, 'distill', runtime);
  return JSON.parse(outputText) as DistilledShortTerm;
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
  if (runtime.wireApi === 'responses') {
    return distillWithResponsesApi(raw, runtime);
  }
  throw new Error(`Unsupported distill provider: ${runtime.provider} (wire API: ${runtime.wireApi})`);
}

function prefilterRawCapture(raw: RawCaptureEvent): DistillPrefilterDecision {
  const hasAssistantSummary = Boolean(raw.assistant_summary?.trim());
  const hasCandidates = raw.candidates.length > 0;
  const hasSessionAnchor = Boolean(raw.session_id?.trim());
  const hasEvidenceRefs = raw.evidence_refs.length > 0;

  if (raw.source_kind === 'direct_input' && !hasAssistantSummary && !hasCandidates && !hasSessionAnchor) {
    return { decision: 'reject', reason: hasEvidenceRefs ? 'low_signal' : 'missing_anchor' };
  }

  return { decision: 'candidate' };
}

function prepareEpisodePayload(episodes: ShortTermEpisode[]) {
  return episodes.map((episode, index) => ({
    id: episode.message_id ?? episode.object_ref ?? `episode-${index + 1}`,
    summary: episode.summary ?? '',
    signal_type: episode.signal_type ?? 'unknown',
    polarity: episode.polarity ?? 'supporting',
    evidence_refs: episode.evidence_refs ?? [],
    quality: episode.quality ?? null,
  }));
}

async function consolidateWithResponsesApi(
  episodes: ShortTermEpisode[],
  runtime: ModelProviderRuntime,
  identityId: string,
): Promise<ConsolidationModelResponse> {
  if (!runtime.baseUrl) {
    throw new Error(`Missing base_url for consolidate provider: ${runtime.provider}`);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (runtime.requiresOpenAIAuth) {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(`Missing OPENAI_API_KEY for consolidate provider: ${runtime.provider}`);
    }
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const episodesPayload = prepareEpisodePayload(episodes);
  const prompt = [
    'You are a long-term learning consolidator for agent experiences.',
    'Return strict JSON only with keys: status, reason, learning.',
    'Rules:',
    '- status must be one of learning_created, no_learning, needs_more_evidence',
    '- reason must always be a string',
    '- learning must be null when status is no_learning or needs_more_evidence',
    '- learning must contain message_id, identity_id, object_ref, source_episode_ids, summary, applicability, failure_conditions, evidence_refs, confidence, quality when status is learning_created',
    '- quality.status must be pass, needs_review, or rejected',
    '- no markdown',
    `identity_id=${identityId}`,
    `episodes=${JSON.stringify(episodesPayload)}`,
  ].join('\n');

  const normalizedBase = runtime.baseUrl.replace(/\/+$/, '');
  const endpoint = `${normalizedBase}/v1/responses`;

  const responseSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      status: {
        type: 'string',
        enum: ['learning_created', 'no_learning', 'needs_more_evidence'],
      },
      reason: { type: 'string' },
      learning: {
        anyOf: [
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              message_id: { type: 'string' },
              identity_id: { type: 'string' },
              object_ref: { type: 'string' },
              source_episode_ids: { type: 'array', items: { type: 'string' } },
              summary: { type: 'string' },
              applicability: { type: 'string' },
              failure_conditions: { type: 'string' },
              evidence_refs: { type: 'array', items: { type: 'string' } },
              confidence: { type: 'number' },
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
            },
            required: [
              'message_id',
              'identity_id',
              'object_ref',
              'source_episode_ids',
              'summary',
              'applicability',
              'failure_conditions',
              'evidence_refs',
              'confidence',
              'quality',
            ],
          },
          { type: 'null' },
        ],
      },
    },
    required: ['status', 'reason', 'learning'],
  };

  const requestBody: Record<string, unknown> = {
    model: runtime.model,
    input: prompt,
    text: {
      format: {
        type: 'json_schema',
        name: 'learning_consolidation',
        schema: responseSchema,
      },
    },
  };

  const outputText = await requestResponsesOutputText(endpoint, headers, requestBody, 'consolidate', runtime);
  return validateConsolidationModelResponse(JSON.parse(outputText));
}

function getEpisodeIdentifier(value: ShortTermEpisode, index: number) {
  return value.message_id ?? value.object_ref ?? `episode-${index + 1}`;
}

async function consolidateWithMock(
  episodes: ShortTermEpisode[],
  identityId: string,
): Promise<ConsolidationModelResponse> {
  if (episodes.length === 0) {
    return {
      status: 'no_learning',
      reason: 'no_episodes_in_batch',
    };
  }

  const sourceEpisodeIds = episodes.map((entry, index) => getEpisodeIdentifier(entry, index));
  const evidenceRefs = episodes.flatMap((entry) => entry.evidence_refs ?? []);
  const hasEvidence = evidenceRefs.length > 0;
  const summaryCount = episodes.filter((entry) => entry.summary && entry.summary.trim()).length;

  if (!hasEvidence) {
    return {
      status: 'no_learning',
      reason: 'insufficient_evidence',
    };
  }
  if (episodes.length < 2 || summaryCount === 0) {
    return {
      status: 'needs_more_evidence',
      reason: 'not_enough_details',
    };
  }

  const messageId = randomUUID();
  const summary = episodes.map((entry) => entry.summary ?? '').filter(Boolean).join(' ');
  const applicability = `Applicable when ${episodes.length} episodes converge on similar outcomes.`;
  const failureConditions = 'Avoid applying if supporting evidence disappears or conflicting reports arise.';

  return {
    status: 'learning_created',
    learning: {
      message_id: messageId,
      identity_id: identityId,
      object_ref: `learning:${messageId}`,
      source_episode_ids: sourceEpisodeIds,
      summary: summary || 'Consolidated observation',
      applicability,
      failure_conditions: failureConditions,
      evidence_refs: Array.from(new Set(evidenceRefs)),
      confidence: Math.min(1, 0.55 + summaryCount * 0.1),
      quality: {
        observable: true,
        linkable: evidenceRefs.length > 0,
        evaluatable: summaryCount > 0,
        distillable: true,
        status: summaryCount > 0 ? 'pass' : 'needs_review',
        reasons: [],
      },
    },
  };
}

async function consolidateBatch(
  episodes: ShortTermEpisode[],
  runtime: ModelProviderRuntime,
  identityId: string,
): Promise<ConsolidationModelResponse> {
  if (runtime.provider === 'mock') {
    return consolidateWithMock(episodes, identityId);
  }
  if (runtime.wireApi === 'responses') {
    return consolidateWithResponsesApi(episodes, runtime, identityId);
  }
  throw new Error(`Unsupported consolidate provider: ${runtime.provider} (wire API: ${runtime.wireApi})`);
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

async function readShortTermEpisodes(shortTermDir: string): Promise<Array<{ path: string; value: ShortTermEpisode }>> {
  const files = (await readdir(shortTermDir)).filter((file) => file.endsWith('.json')).sort();
  const episodes: Array<{ path: string; value: ShortTermEpisode }> = [];
  for (const file of files) {
    const path = join(shortTermDir, file);
    const content = await readFile(path, 'utf8');
    try {
      episodes.push({
        path,
        value: JSON.parse(content) as ShortTermEpisode,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse short-term episode at ${path}: ${message}`);
    }
  }
  return episodes;
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

function normalizeSourceEpisodeIds(ids: string[]): string[] {
  return [...ids].sort();
}

function computeLearningFingerprintFromIds(sortedIds: string[]): string {
  return createHash('sha256').update(sortedIds.join('|'), 'utf8').digest('hex');
}

async function readExistingLearningFingerprints(longTermDir: string, agentId: string): Promise<Set<string>> {
  const fingerprints = new Set<string>();
  if (!longTermDir) {
    return fingerprints;
  }
  const files = (await readdir(longTermDir)).filter((file) => file.endsWith('.json')).sort();
  for (const file of files) {
    const path = join(longTermDir, file);
    try {
      const content = await readFile(path, 'utf8');
      let parsed: Partial<Learning>;
      try {
        parsed = JSON.parse(content) as Partial<Learning>;
      } catch {
        continue;
      }
      if (parsed.identity_id !== agentId) {
        continue;
      }
      if (typeof parsed.fingerprint === 'string' && parsed.fingerprint.length > 0) {
        fingerprints.add(parsed.fingerprint);
      }
    } catch (error) {
      throw new Error(`Failed to read learning fingerprint from ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return fingerprints;
}

async function handleDistill(agentId: string, limitRaw: string | undefined, rootDir: string): Promise<DistillCommandResult> {
  const agentRoot = join(rootDir, 'agents', agentId);
  const rawCaptureDir = join(agentRoot, 'memory', 'raw-capture');
  const shortTermDir = join(agentRoot, 'memory', 'short-term');
  const runsDir = join(agentRoot, 'runs');

  const identity = await readIdentity(agentId, rootDir);
  await mkdir(rawCaptureDir, { recursive: true });
  await mkdir(shortTermDir, { recursive: true });
  await mkdir(runsDir, { recursive: true });
  const runResult = await withCommandLock(agentRoot, 'distill', async () => {
    const runId = randomUUID();
    const runObservedAt = createTimestamp();
    const runSummaryPath = join(runsDir, `${sanitizeForFilename(runObservedAt)}-${runId}.json`);
    let status: RunStatus = 'success';
    let failureReason: string | null = null;
    let skipReason: string | null = null;
    let scanned = 0;
    let distilledCount = 0;
    let skippedCount = 0;
    let prefilterRejected = 0;
    let rejectedLowSignal = 0;
    let rejectedMissingAnchor = 0;
    let runtimeConfig: ModelProviderRuntime | null = null;

    try {
      const currentRuntime = readDistillRuntimeConfig();
      runtimeConfig = currentRuntime;
      const maxItems = parsePositiveInteger('limit', limitRaw, 20);
      const allRaw = await readRawCaptureEvents(rawCaptureDir);
      const processedSourceIds = await readShortTermSourceIds(shortTermDir);
      const pending = allRaw
        .filter((event) => !processedSourceIds.has(event.value.message_id))
        .slice(0, maxItems);
      scanned = pending.length;
      if (scanned === 0) {
        status = 'skipped';
        skipReason = 'no_pending_raw_captures';
        return { runId, status, scanned, distilledCount, skippedCount };
      }

      for (const item of pending) {
        try {
          const prefilter = prefilterRawCapture(item.value);
          if (prefilter.decision === 'reject') {
            skippedCount += 1;
            prefilterRejected += 1;
            if (prefilter.reason === 'low_signal') {
              rejectedLowSignal += 1;
            } else {
              rejectedMissingAnchor += 1;
            }
            continue;
          }

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
            model_provider: currentRuntime.provider,
            model_name: currentRuntime.model,
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

      return { runId, status, scanned, distilledCount, skippedCount };
    } catch (error) {
      status = 'failed';
      failureReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      const summaryProvider = runtimeConfig?.provider ?? 'unknown';
      const summaryModel = runtimeConfig?.model ?? 'unknown';
      const runSummary = {
        run_id: runId,
        agent_id: identity.agent_id,
        distill_source: 'raw-capture',
        scanned,
        distilled: distilledCount,
        skipped: skippedCount,
        prefilter_rejected: prefilterRejected,
        rejected_low_signal: rejectedLowSignal,
        rejected_missing_anchor: rejectedMissingAnchor,
        status,
        failure_reason: failureReason,
        skip_reason: skipReason,
        provider: summaryProvider,
        model: summaryModel,
        observed_at: runObservedAt,
      };
      await writeJsonFile(runSummaryPath, runSummary);
    }
  });

  console.log(`Agent: ${identity.agent_id}`);
  if (runResult.status === 'success') {
    console.log(`Distilled short-term records: ${runResult.distilledCount}`);
    console.log(`Skipped raw captures: ${runResult.skippedCount}`);
  } else if (runResult.status === 'skipped') {
    console.log('No pending raw captures to distill; skipping.');
  }

  return runResult;
}

async function handleConsolidate(
  agentId: string,
  limitRaw: string | undefined,
  batchSizeRaw: string | undefined,
  rootDir: string,
): Promise<ConsolidateCommandResult> {
  const agentRoot = join(rootDir, 'agents', agentId);
  const shortTermDir = join(agentRoot, 'memory', 'short-term');
  const longTermDir = join(agentRoot, 'memory', 'long-term');
  const runsDir = join(agentRoot, 'runs');

  const identity = await readIdentity(agentId, rootDir);
  await mkdir(shortTermDir, { recursive: true });
  await mkdir(longTermDir, { recursive: true });
  await mkdir(runsDir, { recursive: true });

  const runResult = await withCommandLock(agentRoot, 'consolidate', async () => {
    const runId = randomUUID();
    const runObservedAt = createTimestamp();
    const runSummaryPath = join(runsDir, `${sanitizeForFilename(runObservedAt)}-${runId}.json`);
    let status: RunStatus = 'success';
    let failureReason: string | null = null;
    let skipReason: string | null = null;
    let episodesScanned = 0;
    let batchesScanned = 0;
    let learningRecords = 0;
    let limitValue = 0;
    let batchSizeValue = 0;
    let runtime: ModelProviderRuntime | null = null;
    const statusCounts: Record<ConsolidationStatus, number> = {
      learning_created: 0,
      no_learning: 0,
      needs_more_evidence: 0,
    };
    const stagedLearningWrites: Array<{ path: string; record: Learning }> = [];

    try {
      const currentRuntime = readConsolidationRuntimeConfig();
      runtime = currentRuntime;
      limitValue = parsePositiveInteger('limit', limitRaw, 20);
      batchSizeValue = parsePositiveInteger('batch-size', batchSizeRaw, 10);
      const existingFingerprints = await readExistingLearningFingerprints(longTermDir, identity.agent_id);
      const episodes = await readShortTermEpisodes(shortTermDir);
      const validEpisodes = episodes.filter((item) => {
        const value = item.value;
        if (value.object_kind !== 'episode') {
          return false;
        }
        if (value.identity_id !== agentId) {
          return false;
        }
        if (!value.message_id && !value.object_ref) {
          return false;
        }
        return true;
      });
      const selected = validEpisodes.slice(0, limitValue);
      episodesScanned = selected.length;

      if (episodesScanned === 0) {
        status = 'skipped';
        skipReason = 'no_valid_episodes';
        return {
          runId,
          status,
          learningRecords,
          episodesScanned,
          batchesScanned,
          statusCounts: { ...statusCounts },
        };
      }

      const batches: Array<Array<{ path: string; value: ShortTermEpisode }>> = [];
      for (let index = 0; index < selected.length; index += batchSizeValue) {
        batches.push(selected.slice(index, index + batchSizeValue));
      }
      batchesScanned = batches.length;

      for (const batch of batches) {
        const episodeBatch = batch.map((item) => item.value);
        if (episodeBatch.length === 0) {
          continue;
        }
        const response = validateConsolidationModelResponse(
          await consolidateBatch(episodeBatch, currentRuntime, identity.agent_id),
        );
        if (response.status === 'learning_created') {
          const normalizedSourceIds = normalizeSourceEpisodeIds(response.learning.source_episode_ids);
          if (normalizedSourceIds.length === 0) {
            throw new Error('Consolidation learning_created response must include at least one source episode id');
          }
          const fingerprint = computeLearningFingerprintFromIds(normalizedSourceIds);
          if (existingFingerprints.has(fingerprint)) {
            continue;
          }
          existingFingerprints.add(fingerprint);
          const learningObservedAt = createTimestamp();
          const learningStorageId = randomUUID();
          const learningRecord: Learning = {
            schema_version: '1',
            message_id: response.learning.message_id,
            identity_id: identity.agent_id,
            object_kind: 'learning',
            object_ref: response.learning.object_ref,
            source_episode_ids: normalizedSourceIds,
            summary: response.learning.summary,
            applicability: response.learning.applicability,
            failure_conditions: response.learning.failure_conditions,
            evidence_refs: response.learning.evidence_refs,
            confidence: Math.max(0, Math.min(1, response.learning.confidence)),
            quality: response.learning.quality,
            observed_at: learningObservedAt,
            consolidation_run_id: runId,
            fingerprint,
          };
          const learningPath = join(longTermDir, `${learningObservedAt.replaceAll(':', '-')}-${learningStorageId}.json`);
          stagedLearningWrites.push({ path: learningPath, record: learningRecord });
          continue;
        }
        statusCounts[response.status] += 1;
      }

      for (const stagedWrite of stagedLearningWrites) {
        await writeJsonFile(stagedWrite.path, stagedWrite.record);
        learningRecords += 1;
      }
      statusCounts.learning_created = learningRecords;

      return {
        runId,
        status,
        learningRecords,
        episodesScanned,
        batchesScanned,
        statusCounts: { ...statusCounts },
      };
    } catch (error) {
      status = 'failed';
      failureReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      const summaryProvider = runtime?.provider ?? 'unknown';
      const summaryModel = runtime?.model ?? 'unknown';
      const runSummary = {
        run_id: runId,
        agent_id: identity.agent_id,
        consolidate_source: 'short-term',
        episodes_scanned: episodesScanned,
        limit: limitValue,
        batch_size: batchSizeValue,
        batches_scanned: batchesScanned,
        learning_created: statusCounts.learning_created,
        no_learning: statusCounts.no_learning,
        needs_more_evidence: statusCounts.needs_more_evidence,
        provider: summaryProvider,
        model: summaryModel,
        status,
        failure_reason: failureReason,
        skip_reason: skipReason,
        observed_at: runObservedAt,
      };
      await writeJsonFile(runSummaryPath, runSummary);
    }
  });

  if (runResult.status === 'success') {
    console.log(`Learning records: ${runResult.learningRecords}`);
    console.log(`No-learning batches: ${runResult.statusCounts.no_learning}`);
    console.log(`Needs more evidence: ${runResult.statusCounts.needs_more_evidence}`);
    console.log(`Episodes consolidated: ${runResult.episodesScanned}`);
    console.log(`Batches processed: ${runResult.batchesScanned}`);
  } else if (runResult.status === 'skipped') {
    console.log('No valid episodes to consolidate; skipping.');
  }

  return runResult;
}

async function handleDrive(
  agentId: string,
  limitRaw: string | undefined,
  batchSizeRaw: string | undefined,
  rootDir: string,
) {
  const agentRoot = join(rootDir, 'agents', agentId);
  const runsDir = join(agentRoot, 'runs');
  const identity = await readIdentity(agentId, rootDir);
  await mkdir(runsDir, { recursive: true });

  const runResult = await withCommandLock(agentRoot, 'drive', async () => {
    const runId = randomUUID();
    const runObservedAt = createTimestamp();
    const runSummaryPath = join(runsDir, `${sanitizeForFilename(runObservedAt)}-${runId}.json`);
    let status: RunStatus = 'success';
    let failureReason: string | null = null;
    let distillResult: DistillCommandResult | null = null;
    let consolidateResult: ConsolidateCommandResult | null = null;

    try {
      distillResult = await handleDistill(agentId, limitRaw, rootDir);
      consolidateResult = await handleConsolidate(agentId, limitRaw, batchSizeRaw, rootDir);
      return {
        runId,
        status,
        distillResult,
        consolidateResult,
      };
    } catch (error) {
      status = 'failed';
      failureReason = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      const runSummary = {
        run_id: runId,
        command: 'drive',
        agent_id: identity.agent_id,
        limit: parsePositiveInteger('limit', limitRaw, 20),
        batch_size: parsePositiveInteger('batch-size', batchSizeRaw, 10),
        child_run_ids: {
          distill: distillResult?.runId ?? null,
          consolidate: consolidateResult?.runId ?? null,
        },
        distilled: distillResult?.distilledCount ?? 0,
        distill_skipped: distillResult?.skippedCount ?? 0,
        learning_created: consolidateResult?.learningRecords ?? 0,
        no_learning: consolidateResult?.statusCounts.no_learning ?? 0,
        needs_more_evidence: consolidateResult?.statusCounts.needs_more_evidence ?? 0,
        status,
        failure_reason: failureReason,
        observed_at: runObservedAt,
      };
      await writeJsonFile(runSummaryPath, runSummary);
    }
  });

  if (runResult.status === 'success') {
    console.log(`Drive distilled records: ${runResult.distillResult.distilledCount}`);
    console.log(`Drive learning records: ${runResult.consolidateResult.learningRecords}`);
  }
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

  if (command === 'consolidate') {
    const agentId = options.get('agent-id');
    if (!agentId) {
      throw new Error('Missing required option: --agent-id');
    }
    await assertAgentVisible(agentId, rootDir, workspaceRoot);
    await handleConsolidate(agentId, options.get('limit'), options.get('batch-size'), rootDir);
    return;
  }

  if (command === 'drive') {
    const agentId = options.get('agent-id');
    if (!agentId) {
      throw new Error('Missing required option: --agent-id');
    }
    await assertAgentVisible(agentId, rootDir, workspaceRoot);
    await handleDrive(agentId, options.get('limit'), options.get('batch-size'), rootDir);
    return;
  }

  throw new Error(`Unknown command: ${command ?? '<missing>'}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
