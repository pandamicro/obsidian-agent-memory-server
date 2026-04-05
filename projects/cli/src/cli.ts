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
  const shortTermDir = join(agentRoot, 'memory', 'short-term');
  const longTermDir = join(agentRoot, 'memory', 'long-term');
  const runsDir = join(agentRoot, 'runs');

  await mkdir(identityDir, { recursive: true });
  await mkdir(shortTermDir, { recursive: true });
  await mkdir(longTermDir, { recursive: true });
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

async function handleRun(agentId: string, input: string, rootDir: string) {
  const agentRoot = join(rootDir, 'agents', agentId);
  const shortTermDir = join(agentRoot, 'memory', 'short-term');
  const longTermDir = join(agentRoot, 'memory', 'long-term');
  const runsDir = join(agentRoot, 'runs');

  const identity = await readIdentity(agentId, rootDir);
  await mkdir(shortTermDir, { recursive: true });
  await mkdir(longTermDir, { recursive: true });
  await mkdir(runsDir, { recursive: true });

  const observedAt = createTimestamp();
  const messageId = randomUUID();
  const objectRef = `episode:${messageId}`;

  const shortTermEvent = {
    message_id: messageId,
    identity_id: identity.agent_id,
    object_kind: 'episode',
    object_ref: objectRef,
    event_type: 'captured',
    evidence_refs: [`input:${messageId}`],
    observed_at: observedAt,
    input,
  };

  const shortTermPath = join(shortTermDir, `${observedAt.replaceAll(':', '-')}-${messageId}.json`);
  await writeJsonFile(shortTermPath, shortTermEvent);

  const longTermObject = {
    object_ref: `long-term:${messageId}`,
    identity_id: identity.agent_id,
    source_message_id: messageId,
    created_at: observedAt,
    summary: `Placeholder memory derived from input: ${input}`,
  };

  const longTermPath = join(longTermDir, `${observedAt.replaceAll(':', '-')}-${messageId}.json`);
  await writeJsonFile(longTermPath, longTermObject);

  const runSummary = {
    run_id: messageId,
    agent_id: identity.agent_id,
    short_term_event_path: shortTermPath,
    long_term_object_path: longTermPath,
    latest_long_term_ref: longTermObject.object_ref,
    observed_at: observedAt,
  };

  const runSummaryPath = join(runsDir, `${observedAt.replaceAll(':', '-')}-${messageId}.json`);
  await writeJsonFile(runSummaryPath, runSummary);

  console.log(`Agent: ${identity.agent_id}`);
  console.log(`Short-term event: ${shortTermPath}`);
  console.log(`Long-term object: ${longTermPath}`);
  console.log(`Latest long-term ref: ${longTermObject.object_ref}`);
}

async function readLatestLongTermObject(longTermDir: string) {
  const files = (await readdir(longTermDir)).filter((file) => file.endsWith('.json')).sort();
  if (files.length === 0) {
    throw new Error(`No long-term objects found in ${longTermDir}`);
  }

  const latestFile = files.at(-1)!;
  const latestPath = join(longTermDir, latestFile);
  const content = await readFile(latestPath, 'utf8');

  return {
    path: latestPath,
    value: JSON.parse(content) as { object_ref?: string },
  };
}

async function handleVerify(agentId: string, rootDir: string, workspaceRoot: string) {
  await assertAgentVisible(agentId, rootDir, workspaceRoot);
  const agentRoot = join(rootDir, 'agents', agentId);
  const identityDir = join(agentRoot, 'identity');
  const shortTermDir = join(agentRoot, 'memory', 'short-term');
  const longTermDir = join(agentRoot, 'memory', 'long-term');
  const runsDir = join(agentRoot, 'runs');

  await readdir(identityDir);
  await readdir(shortTermDir);
  await readdir(longTermDir);
  await readdir(runsDir);

  const identity = await readIdentity(agentId, rootDir);
  const latestLongTerm = await readLatestLongTermObject(longTermDir);

  console.log(`Verified agent: ${identity.agent_id}`);
  console.log(`Identity file is valid`);
  console.log(`Latest long-term ref: ${latestLongTerm.value.object_ref ?? '<missing>'}`);
  console.log(`Latest long-term path: ${latestLongTerm.path}`);
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
    await handleRun(agentId, input, rootDir);
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
