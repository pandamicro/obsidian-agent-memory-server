import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

export const repoRoot = resolve(fileURLToPath(new URL('../../../', import.meta.url)));

export function spawnAgents(args: string[], sharedRoot: string) {
  return spawnSync(join(repoRoot, 'bin', 'agents'), args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
      OBSIDIAN_AGENT_MEMORY_SERVER_ROOT: sharedRoot,
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export async function bindAgent(workspaceRoot: string, agentId: string) {
  const bindingDir = join(workspaceRoot, '.codex', 'agent-memory');
  await mkdir(bindingDir, { recursive: true });
  await writeFile(
    join(bindingDir, 'active-agent.json'),
    `${JSON.stringify({ agent_id: agentId }, null, 2)}\n`,
    'utf8',
  );
}

