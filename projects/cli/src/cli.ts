import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

type AgentIdentity = {
  agent_id: string;
  canonical_name: string;
  specialization: string;
  mission: string;
  lineage: string;
};

type AgentSummary = Pick<
  AgentIdentity,
  'agent_id' | 'canonical_name' | 'specialization' | 'lineage'
> & {
  path: string;
};

type AgentScope = {
  scope_type?: 'repo-local';
  workspace_root?: string;
};

const sourceRepoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const sourceHooksPath = resolve(fileURLToPath(new URL('../../../.codex/hooks.json', import.meta.url)));

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

function toCanonicalName(agentId: string) {
  return agentId
    .split('-')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function toSpecialization(agentId: string) {
  return agentId.endsWith('-agent') ? agentId.slice(0, -'-agent'.length) : agentId;
}

function createIdentity(agentId: string): AgentIdentity {
  return {
    agent_id: agentId,
    canonical_name: toCanonicalName(agentId),
    specialization: toSpecialization(agentId),
    mission: `Produce careful, evidence-backed ${toSpecialization(agentId)} artifacts for portable agent systems.`,
    lineage: `origin:${agentId}:v1`,
  };
}

async function ensureEmptyOrMissing(path: string) {
  try {
    const entries = await readdir(path);
    if (entries.length > 0) {
      throw new Error(`Agent directory already exists and is not empty: ${path}`);
    }
  } catch (error) {
    const typed = error as NodeJS.ErrnoException;
    if (typed.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function handleInit(agentId: string, rootDir: string) {
  const agentRoot = join(rootDir, 'agents', agentId);
  await ensureEmptyOrMissing(agentRoot);

  const identityDir = join(agentRoot, 'identity');
  const rawCaptureDir = join(agentRoot, 'memory', 'raw-capture');
  const shortTermDir = join(agentRoot, 'memory', 'short-term');
  const runsDir = join(agentRoot, 'runs');

  await mkdir(identityDir, { recursive: true });
  await mkdir(rawCaptureDir, { recursive: true });
  await mkdir(shortTermDir, { recursive: true });
  await mkdir(runsDir, { recursive: true });

  const identityPath = join(identityDir, 'agent_identity.json');
  await writeFile(identityPath, `${JSON.stringify(createIdentity(agentId), null, 2)}\n`, 'utf8');

  console.log(`Initialized agent: ${agentId}`);
  console.log(`Identity file: ${identityPath}`);
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

async function listAgents(rootDir: string, workspaceRoot: string) {
  const agentsDir = join(rootDir, 'agents');

  let entries;
  try {
    entries = await readdir(agentsDir, { withFileTypes: true });
  } catch (error) {
    const typed = error as NodeJS.ErrnoException;
    if (typed.code === 'ENOENT') {
      return [] as AgentSummary[];
    }
    throw error;
  }

  const summaries: AgentSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const agentId = entry.name;
    try {
      const visibility = await isAgentVisibleToWorkspace(agentId, rootDir, workspaceRoot);
      if (!visibility.visible) {
        continue;
      }
      const identity = await readIdentity(agentId, rootDir);
      summaries.push({
        agent_id: identity.agent_id,
        canonical_name: identity.canonical_name,
        specialization: identity.specialization,
        lineage: identity.lineage,
        path: join(agentsDir, agentId),
      });
    } catch {
      continue;
    }
  }

  summaries.sort((left, right) => left.agent_id.localeCompare(right.agent_id));
  return summaries;
}

async function assertAgentVisible(agentId: string, rootDir: string, workspaceRoot: string) {
  const visibility = await isAgentVisibleToWorkspace(agentId, rootDir, workspaceRoot);
  if (!visibility.visible) {
    throw new Error(`Agent identity ${agentId} is scoped to ${visibility.scopeRoot}`);
  }
}

function createTimestamp() {
  return new Date().toISOString();
}

async function writeJsonFile(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

type ShortTermSignalPolarity = 'supporting' | 'conflicting' | 'insufficient';

type ParsedShortTermCandidate = {
  signal_type: string;
  polarity: ShortTermSignalPolarity;
  summary: string;
  evidence_refs: string[];
};

type ParsedShortTermInput = {
  source_kind: 'hook_flush' | 'direct_input';
  session_id?: string;
  thread_id?: string;
  turn_id?: string;
  event?: string;
  workspace_root?: string;
  assistant_summary?: string;
  candidates: ParsedShortTermCandidate[];
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
  thread_id: string | null;
  turn_id: string | null;
  event: string;
  workspace_root: string | null;
  assistant_summary: string | null;
  candidates: ParsedShortTermCandidate[];
  input: string;
};

function parseHookFlushHeaderMeta(firstLine: string): Record<string, string> {
  const prefix = '[hook flush]';
  if (!firstLine.startsWith(prefix)) {
    return {};
  }
  const tail = firstLine.slice(prefix.length).trim();
  if (!tail) {
    return {};
  }

  const meta: Record<string, string> = {};
  for (const token of tail.split(/\s+/u)) {
    const separator = token.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const key = token.slice(0, separator).trim();
    const value = token.slice(separator + 1).trim();
    if (!key || !value) {
      continue;
    }
    meta[key] = value;
  }
  return meta;
}

function parseHookFlushInput(input: string): ParsedShortTermInput {
  const lines = input.split('\n').map((line) => line.trim());
  const firstLine = lines[0] ?? '';
  const isHookFlush = firstLine.startsWith('[hook flush]');
  if (!isHookFlush) {
    return {
      source_kind: 'direct_input',
      candidates: [],
    };
  }

  const headerMeta = parseHookFlushHeaderMeta(firstLine);
  const result: ParsedShortTermInput = {
    source_kind: 'hook_flush',
    session_id: headerMeta.session,
    thread_id: headerMeta.thread,
    turn_id: headerMeta.turn,
    event: headerMeta.event,
    candidates: [],
  };

  let inCandidates = false;
  for (const line of lines.slice(1)) {
    if (!line) {
      continue;
    }

    if (line === 'candidates:') {
      inCandidates = true;
      continue;
    }

    if (!inCandidates) {
      if (line.startsWith('workspace=')) {
        result.workspace_root = line.slice('workspace='.length).trim();
        continue;
      }
      if (line.startsWith('assistant=')) {
        result.assistant_summary = line.slice('assistant='.length).trim();
        continue;
      }
      continue;
    }

    const candidateMatch = line.match(
      /^-\s*([a-z_]+)\/(supporting|conflicting|insufficient):\s*([\s\S]+)$/u,
    );
    if (!candidateMatch) {
      continue;
    }

    let summary = candidateMatch[3]?.trim() ?? '';
    let evidenceRefs: string[] = [];

    const evidenceMatch = summary.match(/^(.*)\s+\[([^\]]+)\]\s*$/u);
    if (evidenceMatch) {
      summary = evidenceMatch[1]?.trim() ?? summary;
      evidenceRefs = (evidenceMatch[2] ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    }

    result.candidates.push({
      signal_type: candidateMatch[1] ?? 'unknown',
      polarity: (candidateMatch[2] as ShortTermSignalPolarity) ?? 'insufficient',
      summary,
      evidence_refs: evidenceRefs,
    });
  }

  return result;
}

function getWorkspaceCodexDir(workspaceRoot: string) {
  return join(workspaceRoot, '.codex');
}

function getWorkspaceHooksPath(workspaceRoot: string) {
  return join(getWorkspaceCodexDir(workspaceRoot), 'hooks.json');
}

function getWorkspaceBindingDir(workspaceRoot: string) {
  return join(getWorkspaceCodexDir(workspaceRoot), 'agent-memory');
}

function getWorkspaceBindingJsonPath(workspaceRoot: string) {
  return join(getWorkspaceBindingDir(workspaceRoot), 'active-agent.json');
}

function getWorkspaceBindingTextPath(workspaceRoot: string) {
  return join(getWorkspaceBindingDir(workspaceRoot), 'active-agent-id.txt');
}

async function removeIfExists(path: string) {
  try {
    await rm(path);
  } catch (error) {
    const typed = error as NodeJS.ErrnoException;
    if (typed.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function writeWorkspaceBinding(workspaceRoot: string, agentId: string) {
  const bindingDir = getWorkspaceBindingDir(workspaceRoot);
  await mkdir(bindingDir, { recursive: true });
  await writeJsonFile(getWorkspaceBindingJsonPath(workspaceRoot), { agent_id: agentId });
  await writeFile(getWorkspaceBindingTextPath(workspaceRoot), `${agentId}\n`, 'utf8');
}

function shouldManageWorkspaceHooks(workspaceRoot: string) {
  return canonicalizePath(workspaceRoot) !== canonicalizePath(sourceRepoRoot);
}

async function installWorkspaceHooks(workspaceRoot: string) {
  if (!shouldManageWorkspaceHooks(workspaceRoot)) {
    return;
  }

  await mkdir(getWorkspaceCodexDir(workspaceRoot), { recursive: true });
  await copyFile(sourceHooksPath, getWorkspaceHooksPath(workspaceRoot));
}

async function clearWorkspaceMount(workspaceRoot: string) {
  await removeIfExists(getWorkspaceBindingJsonPath(workspaceRoot));
  await removeIfExists(getWorkspaceBindingTextPath(workspaceRoot));

  if (shouldManageWorkspaceHooks(workspaceRoot)) {
    await removeIfExists(getWorkspaceHooksPath(workspaceRoot));
  }
}

async function promptMountSelection(workspaceRoot: string, agents: AgentSummary[]) {
  if (agents.length === 0) {
    return 0;
  }

  console.log(`Select an agent identity to mount hooks for ${workspaceRoot}:`);
  console.log('0) Do not mount hooks');
  for (const [index, agent] of agents.entries()) {
    console.log(`${index + 1}) ${agent.agent_id} (${agent.canonical_name})`);
  }

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = (await readline.question('Selection: ')).trim();
    const parsed = Number.parseInt(answer, 10);

    if (!Number.isInteger(parsed) || parsed < 0 || parsed > agents.length) {
      throw new Error(`Invalid selection: ${answer || '<empty>'}`);
    }

    return parsed;
  } finally {
    readline.close();
  }
}

async function handleRun(agentId: string, input: string, rootDir: string, workspaceRoot: string) {
  const agentRoot = join(rootDir, 'agents', agentId);
  const rawCaptureDir = join(agentRoot, 'memory', 'raw-capture');
  const shortTermDir = join(agentRoot, 'memory', 'short-term');
  const runsDir = join(agentRoot, 'runs');

  const identity = await readIdentity(agentId, rootDir);
  await mkdir(rawCaptureDir, { recursive: true });
  await mkdir(shortTermDir, { recursive: true });
  await mkdir(runsDir, { recursive: true });

  const observedAt = createTimestamp();
  const messageId = randomUUID();
  const objectRef = `raw-capture:${messageId}`;
  const parsedInput = parseHookFlushInput(input);

  const rawCaptureEvent: RawCaptureEvent = {
    schema_version: '1',
    message_id: messageId,
    identity_id: identity.agent_id,
    object_kind: 'raw_capture',
    object_ref: objectRef,
    event_type: 'captured',
    evidence_refs: [`input:${messageId}`],
    observed_at: observedAt,
    source_kind: parsedInput.source_kind,
    session_id: parsedInput.session_id ?? null,
    thread_id: parsedInput.thread_id ?? null,
    turn_id: parsedInput.turn_id ?? null,
    event:
      parsedInput.event ??
      (parsedInput.source_kind === 'hook_flush' ? 'hook-flush' : 'direct-input'),
    workspace_root: parsedInput.workspace_root ?? workspaceRoot,
    assistant_summary: parsedInput.assistant_summary ?? null,
    candidates: parsedInput.candidates,
    input,
  };

  const rawCapturePath = join(rawCaptureDir, `${observedAt.replaceAll(':', '-')}-${messageId}.json`);
  await writeJsonFile(rawCapturePath, rawCaptureEvent);

  const runSummary = {
    run_id: messageId,
    agent_id: identity.agent_id,
    raw_capture_event_path: rawCapturePath,
    raw_capture_count: 1,
    observed_at: observedAt,
  };

  const runSummaryPath = join(runsDir, `${observedAt.replaceAll(':', '-')}-${messageId}.json`);
  await writeJsonFile(runSummaryPath, runSummary);

  console.log(`Agent: ${identity.agent_id}`);
  console.log(`Raw capture event: ${rawCapturePath}`);
  console.log(`Raw capture candidates: ${parsedInput.candidates.length}`);
}

async function readLatestShortTermEvent(shortTermDir: string) {
  const files = (await readdir(shortTermDir)).filter((file) => file.endsWith('.json')).sort();
  if (files.length === 0) {
    return null;
  }

  const latestFile = files.at(-1)!;
  const latestPath = join(shortTermDir, latestFile);
  const content = await readFile(latestPath, 'utf8');

  return {
    path: latestPath,
    value: JSON.parse(content) as { object_ref?: string; quality?: { status?: string } },
  };
}


async function handleVerify(agentId: string, rootDir: string, workspaceRoot: string) {
  await assertAgentVisible(agentId, rootDir, workspaceRoot);
  const agentRoot = join(rootDir, 'agents', agentId);
  const identityDir = join(agentRoot, 'identity');
  const rawCaptureDir = join(agentRoot, 'memory', 'raw-capture');
  const shortTermDir = join(agentRoot, 'memory', 'short-term');
  const runsDir = join(agentRoot, 'runs');

  await readdir(identityDir);
  await readdir(rawCaptureDir);
  await readdir(shortTermDir);
  await readdir(runsDir);

  const identity = await readIdentity(agentId, rootDir);
  const latestShortTerm = await readLatestShortTermEvent(shortTermDir);

  console.log(`Verified agent: ${identity.agent_id}`);
  console.log(`Identity file is valid`);
  if (latestShortTerm) {
    console.log(`Latest short-term ref: ${latestShortTerm.value.object_ref ?? '<missing>'}`);
    console.log(`Latest short-term quality: ${latestShortTerm.value.quality?.status ?? '<missing>'}`);
    console.log(`Latest short-term path: ${latestShortTerm.path}`);
  } else {
    console.log('Latest short-term ref: <none>');
  }
}

async function handleList(rootDir: string, workspaceRoot: string) {
  const agents = await listAgents(rootDir, workspaceRoot);
  console.log(JSON.stringify(agents, null, 2));
}

async function handleMount(rootDir: string, workspaceRoot: string) {
  const agents = await listAgents(rootDir, workspaceRoot);
  const selection = await promptMountSelection(workspaceRoot, agents);

  if (selection === 0) {
    await clearWorkspaceMount(workspaceRoot);
    if (agents.length === 0) {
      console.log(`No visible agent identities for ${workspaceRoot}. Hooks not mounted for this workspace.`);
      return;
    }
    console.log(`Hooks not mounted for this workspace: ${workspaceRoot}`);
    return;
  }

  const selectedAgent = agents[selection - 1];
  if (!selectedAgent) {
    throw new Error(`Selection out of range: ${selection}`);
  }

  await assertAgentVisible(selectedAgent.agent_id, rootDir, workspaceRoot);
  await installWorkspaceHooks(workspaceRoot);
  await writeWorkspaceBinding(workspaceRoot, selectedAgent.agent_id);

  console.log(`Mounted hooks for ${selectedAgent.agent_id} in ${workspaceRoot}`);
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  const rootDir = resolveStorageRoot();
  const workspaceRoot = resolveWorkspaceRoot();

  if (command === 'init') {
    const agentId = options.get('agent-id');
    if (!agentId) {
      throw new Error('Missing required option: --agent-id');
    }
    await handleInit(agentId, rootDir);
    return;
  }

  if (command === 'run') {
    const agentId = options.get('agent-id');
    const input = options.get('input');
    if (!agentId) {
      throw new Error('Missing required option: --agent-id');
    }
    if (!input) {
      throw new Error('Missing required option: --input');
    }
    await assertAgentVisible(agentId, rootDir, workspaceRoot);
    await handleRun(agentId, input, rootDir, workspaceRoot);
    return;
  }

  if (command === 'verify') {
    const agentId = options.get('agent-id');
    if (!agentId) {
      throw new Error('Missing required option: --agent-id');
    }
    await handleVerify(agentId, rootDir, workspaceRoot);
    return;
  }

  if (command === 'list') {
    await handleList(rootDir, workspaceRoot);
    return;
  }

  if (command === 'mount') {
    await handleMount(rootDir, workspaceRoot);
    return;
  }

  throw new Error(`Unknown command: ${command ?? '<missing>'}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
