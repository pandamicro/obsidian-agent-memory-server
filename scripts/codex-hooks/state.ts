import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import os from 'node:os';

import type {
  HookEventName,
  HookInput,
} from './contracts.ts';

export type FeedbackEntry = {
  feedback_id: string;
  target_ref: string;
  signal_type: 'explicit' | 'implicit_behavior' | 'environmental_outcome' | 'review_trace';
  polarity: 'supporting' | 'conflicting' | 'insufficient';
  evidence_refs: string[];
  observed_at: string;
  summary: string;
};

export type SessionState = {
  session_id: string;
  workspace_root: string;
  workspace_key: string;
  agent_id?: string;
  last_session_start?: string;
  last_retrieval_turn?: string;
  last_inject_turn?: string;
  last_flush_at?: string;
  seen_events: Record<string, string>;
  pending_feedback: FeedbackEntry[];
  pending_long_term_candidates: FeedbackEntry[];
  cooldown_turns: number;
};

export function resolveWorkspaceRoot(cwd: string): string {
  let current = resolve(cwd);

  while (true) {
    if (existsGitMarker(current)) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return resolve(cwd);
    }

    current = parent;
  }
}

export function resolveStateRoot(): string {
  const envRoot =
    process.env.OBSIDIAN_AGENT_MEMORY_SERVER_HOOKS_STATE_ROOT ??
    process.env.XDG_STATE_HOME ??
    join(os.homedir(), '.codex', 'memories');

  return resolve(join(envRoot, 'obsidian-agent-memory-server', 'hooks'));
}

export function workspaceKey(workspaceRoot: string): string {
  return createHash('sha1').update(workspaceRoot).digest('hex').slice(0, 12);
}

export function getSessionStatePath(stateRoot: string, workspaceRoot: string, sessionId: string): string {
  return join(stateRoot, 'workspaces', workspaceKey(workspaceRoot), 'sessions', `${sessionId}.json`);
}

export function getWorkspaceBindingPath(workspaceRoot: string): string {
  return join(workspaceRoot, '.codex', 'agent-memory', 'active-agent.json');
}

export function getWorkspaceBindingTextPath(workspaceRoot: string): string {
  return join(workspaceRoot, '.codex', 'agent-memory', 'active-agent-id.txt');
}

export function getStateBindingPath(stateRoot: string, workspaceRoot: string): string {
  return join(stateRoot, 'workspaces', workspaceKey(workspaceRoot), 'binding.json');
}

function existsGitMarker(path: string): boolean {
  try {
    statSync(join(path, '.git'));
    return true;
  } catch {
    return false;
  }
}

function ensureParentDir(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

export function createDefaultSessionState(sessionId: string, workspaceRoot: string): SessionState {
  return {
    session_id: sessionId,
    workspace_root: workspaceRoot,
    workspace_key: workspaceKey(workspaceRoot),
    seen_events: {},
    pending_feedback: [],
    pending_long_term_candidates: [],
    cooldown_turns: 8,
  };
}

export function loadSessionState(
  stateRoot: string,
  workspaceRoot: string,
  sessionId: string,
): SessionState {
  const path = getSessionStatePath(stateRoot, workspaceRoot, sessionId);
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<SessionState>;
    return {
      ...createDefaultSessionState(sessionId, workspaceRoot),
      ...parsed,
      session_id: sessionId,
      workspace_root: workspaceRoot,
      workspace_key: workspaceKey(workspaceRoot),
      seen_events: parsed.seen_events ?? {},
      pending_feedback: parsed.pending_feedback ?? [],
      pending_long_term_candidates: parsed.pending_long_term_candidates ?? [],
    };
  } catch (error) {
    const typed = error as NodeJS.ErrnoException;
    if (typed.code === 'ENOENT') {
      return createDefaultSessionState(sessionId, workspaceRoot);
    }
    throw error;
  }
}

export function saveSessionState(
  stateRoot: string,
  workspaceRoot: string,
  sessionId: string,
  state: SessionState,
): void {
  const path = getSessionStatePath(stateRoot, workspaceRoot, sessionId);
  ensureParentDir(path);

  const tempPath = `${path}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  renameSync(tempPath, path);
}

export function rememberEvent(state: SessionState, eventKey: string): boolean {
  if (state.seen_events[eventKey]) {
    return false;
  }

  state.seen_events[eventKey] = new Date().toISOString();

  const entries = Object.entries(state.seen_events);
  if (entries.length > 200) {
    const trimmed = entries.slice(-200);
    state.seen_events = Object.fromEntries(trimmed);
  }

  return true;
}

export function addPendingFeedback(state: SessionState, entry: FeedbackEntry): void {
  if (state.pending_feedback.some((current) => current.feedback_id === entry.feedback_id)) {
    return;
  }

  state.pending_feedback.push(entry);
}

export function addPendingLongTermCandidate(state: SessionState, entry: FeedbackEntry): void {
  if (state.pending_long_term_candidates.some((current) => current.feedback_id === entry.feedback_id)) {
    return;
  }

  state.pending_long_term_candidates.push(entry);
}

export function clearPendingLongTermCandidates(state: SessionState): void {
  state.pending_long_term_candidates = [];
}

export function updateLastFlush(state: SessionState): void {
  state.last_flush_at = new Date().toISOString();
}

export function markAgentId(state: SessionState, agentId: string): void {
  state.agent_id = agentId;
}

export function readWorkspaceBinding(workspaceRoot: string, stateRoot: string): string | null {
  const envAgentId = process.env.OBSIDIAN_AGENT_MEMORY_SERVER_ACTIVE_AGENT_ID?.trim();
  if (envAgentId) {
    return envAgentId;
  }

  const jsonCandidates = [getWorkspaceBindingPath(workspaceRoot), getStateBindingPath(stateRoot, workspaceRoot)];
  for (const path of jsonCandidates) {
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as { agent_id?: string; agentId?: string };
      const agentId = parsed.agent_id ?? parsed.agentId;
      if (typeof agentId === 'string' && agentId.trim()) {
        return agentId.trim();
      }
    } catch {
      // ignore
    }
  }

  try {
    const text = readFileSync(getWorkspaceBindingTextPath(workspaceRoot), 'utf8').trim();
    if (text) {
      return text;
    }
  } catch {
    // ignore
  }

  return null;
}

export function hasAgentBinding(workspaceRoot: string, stateRoot: string): boolean {
  return readWorkspaceBinding(workspaceRoot, stateRoot) !== null;
}

export function normalizeEventName(input: HookInput, fallback: HookEventName): HookEventName {
  return input.hook_event_name ?? fallback;
}

