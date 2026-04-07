import { appendFileSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
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
  identity_selection_declined?: boolean;
  last_session_start?: string;
  last_retrieval_turn?: string;
  last_inject_turn?: string;
  last_flush_at?: string;
  seen_events: Record<string, string>;
  pending_feedback: FeedbackEntry[];
  cooldown_turns: number;
  recent_failures: Record<string, { count: number; last_at: string; reason: string }>;
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

export function getHookLogPath(stateRoot: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return join(stateRoot, 'logs', `hooks-${day}.jsonl`);
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
    cooldown_turns: 8,
    recent_failures: {},
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
      recent_failures: parsed.recent_failures ?? {},
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

export function appendHookLog(
  stateRoot: string,
  payload: Record<string, unknown>,
): void {
  const path = getHookLogPath(stateRoot);
  ensureParentDir(path);
  try {
    appendFileSync(path, `${JSON.stringify({ timestamp: new Date().toISOString(), ...payload })}\n`, 'utf8');
  } catch {
    // best-effort logging only
  }
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

export function updateLastFlush(state: SessionState): void {
  state.last_flush_at = new Date().toISOString();
}

export function markAgentId(state: SessionState, agentId: string): void {
  state.agent_id = agentId;
  state.identity_selection_declined = false;
}

export function markIdentitySelectionDeclined(state: SessionState): void {
  delete state.agent_id;
  state.identity_selection_declined = true;
}

export function trackFailure(
  state: SessionState,
  key: string,
  reason: string,
  now = new Date(),
  suppressAfter = 1,
): { count: number; suppressed: boolean } {
  const at = now.toISOString();
  const current = state.recent_failures[key];
  const count = (current?.count ?? 0) + 1;
  state.recent_failures[key] = { count, last_at: at, reason };

  const entries = Object.entries(state.recent_failures);
  if (entries.length > 200) {
    const sorted = entries.sort((a, b) => a[1].last_at.localeCompare(b[1].last_at));
    const keep = sorted.slice(-200);
    state.recent_failures = Object.fromEntries(keep);
  }

  return {
    count,
    suppressed: count > suppressAfter,
  };
}

export function clearFailure(state: SessionState, key: string): void {
  if (state.recent_failures[key]) {
    delete state.recent_failures[key];
  }
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
