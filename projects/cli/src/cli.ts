import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

type AgentIdentity = {
  agent_id: string;
  canonical_name: string;
  specialization: string;
  mission: string;
  lineage: string;
};

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

function createTimestamp() {
  return new Date().toISOString();
}

async function writeJsonFile(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
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

async function handleVerify(agentId: string, rootDir: string) {
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

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();

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
    await handleRun(agentId, input, rootDir);
    return;
  }

  if (command === 'verify') {
    const agentId = options.get('agent-id');
    if (!agentId) {
      throw new Error('Missing required option: --agent-id');
    }
    await handleVerify(agentId, rootDir);
    return;
  }

  throw new Error(`Unknown command: ${command ?? '<missing>'}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
