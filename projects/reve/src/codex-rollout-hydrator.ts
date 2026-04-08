import { readFile } from 'node:fs/promises';
import { accessSync, constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  ContextHydrator,
  HydratedContextWindow,
  HydrationInput,
  HydrationResult,
} from './context-hydrator.ts';

type HydratorOptions = {
  stateDbPath?: string;
  windowRadius?: number;
};

type RolloutEvent = {
  type?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
};

type RolloutLookupResult =
  | { status: 'found'; rolloutPath: string }
  | { status: 'not_found' }
  | { status: 'state_db_failure'; reason: 'state_db_unreadable' | 'state_db_query_failed' };

function canReadPath(path: string): boolean {
  try {
    accessSync(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNestedString(container: Record<string, unknown> | undefined, key: string): string | null {
  if (!container) {
    return null;
  }
  return asTrimmedString(container[key]);
}

function toSnippetText(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.replace(/\s+/gu, ' ').trim();
    return normalized.length > 0 ? normalized : null;
  }
  if (Array.isArray(value)) {
    const joined = value
      .map((item) => (typeof item === 'string' ? item : ''))
      .join(' ')
      .replace(/\s+/gu, ' ')
      .trim();
    return joined.length > 0 ? joined : null;
  }
  return null;
}

function getTurnId(event: RolloutEvent): string | null {
  const payload = event.payload;
  if (payload && typeof payload === 'object') {
    return readNestedString(payload, 'turn_id');
  }
  return asTrimmedString(event.turn_id);
}

function classifyEventKind(event: RolloutEvent): 'user' | 'assistant' | 'tool' | 'other' {
  const type = asTrimmedString(event.type)?.toLowerCase();
  if (!type) {
    return 'other';
  }
  if (type.includes('user')) {
    return 'user';
  }
  if (type.includes('assistant')) {
    return 'assistant';
  }
  if (type.includes('tool')) {
    return 'tool';
  }
  return 'other';
}

function extractSnippet(event: RolloutEvent): string | null {
  const payload = event.payload;
  if (!payload || typeof payload !== 'object') {
    return toSnippetText(event.content);
  }

  const textFields = ['text', 'output', 'summary', 'message', 'content'];
  for (const field of textFields) {
    const snippet = toSnippetText(payload[field]);
    if (snippet) {
      return snippet;
    }
  }

  return null;
}

function sliceContextWindow(events: RolloutEvent[], centerIndex: number, windowRadius: number): {
  window: HydratedContextWindow;
  evidenceRefs: string[];
} {
  const start = Math.max(0, centerIndex - windowRadius);
  const end = Math.min(events.length - 1, centerIndex + windowRadius);
  const window: HydratedContextWindow = {
    turn_id: getTurnId(events[centerIndex] ?? {}),
    event: asTrimmedString(events[centerIndex]?.type) ?? null,
    user: [],
    assistant: [],
    tool: [],
  };
  const evidenceRefs: string[] = [];

  for (let i = start; i <= end; i += 1) {
    const entry = events[i];
    if (!entry) {
      continue;
    }
    const snippet = extractSnippet(entry);
    if (!snippet) {
      continue;
    }
    const kind = classifyEventKind(entry);
    if (kind === 'user' && window.user.length < 2) {
      window.user.push(snippet);
    } else if (kind === 'assistant' && window.assistant.length < 2) {
      window.assistant.push(snippet);
    } else if (kind === 'tool' && window.tool.length < 2) {
      window.tool.push(snippet);
    }
    evidenceRefs.push(`rollout_line:${i + 1}`);
  }

  return { window, evidenceRefs };
}

async function readRolloutEvents(path: string): Promise<RolloutEvent[]> {
  const raw = await readFile(path, 'utf8');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RolloutEvent);
}

function findCenterIndex(events: RolloutEvent[], input: HydrationInput): number | null {
  const targetTurn = asTrimmedString(input.turn_id);
  if (targetTurn) {
    const turnIndex = events.findIndex((entry) => getTurnId(entry) === targetTurn);
    if (turnIndex >= 0) {
      return turnIndex;
    }
    return null;
  }

  const targetEvent = asTrimmedString(input.event)?.toLowerCase();
  if (targetEvent) {
    const eventIndex = events.findIndex((entry) => asTrimmedString(entry.type)?.toLowerCase() === targetEvent);
    if (eventIndex >= 0) {
      return eventIndex;
    }
  }

  if (!targetTurn && !targetEvent) {
    return events.length - 1;
  }

  return null;
}

async function lookupRolloutPathFromStateDb(
  stateDbPath: string,
  threadId: string | null,
  sessionId: string | null,
): Promise<RolloutLookupResult> {
  if (!threadId && !sessionId) {
    return { status: 'not_found' };
  }
  if (!canReadPath(stateDbPath)) {
    return { status: 'state_db_failure', reason: 'state_db_unreadable' };
  }

  const ids = [threadId, sessionId].filter((value): value is string => Boolean(value));
  if (ids.length === 0) {
    return { status: 'not_found' };
  }

  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(stateDbPath, { readonly: true });
    const statement = db.prepare('select rollout_path from threads where id = ? and rollout_path is not null limit 1');
    for (const id of ids) {
      const row = statement.get(id) as { rollout_path?: unknown } | undefined;
      const candidate = asTrimmedString(row?.rollout_path);
      if (candidate) {
        return { status: 'found', rolloutPath: candidate };
      }
    }
    return { status: 'not_found' };
  } catch {
    return { status: 'state_db_failure', reason: 'state_db_query_failed' };
  } finally {
    db?.close();
  }
}

function makePortableRolloutRef(rolloutPath: string): string {
  const digest = createHash('sha256').update(rolloutPath).digest('hex').slice(0, 16);
  return `rollout_ref:${digest}`;
}

export function createCodexRolloutHydrator(options: HydratorOptions = {}): ContextHydrator {
  const windowRadius = options.windowRadius ?? 2;
  const stateDbPath = options.stateDbPath ?? join(homedir(), '.codex', 'state_5.sqlite');

  return {
    async hydrate(input: HydrationInput): Promise<HydrationResult> {
      let rolloutPath: string | null = asTrimmedString(input.rollout_path_hint);
      let source: 'rollout_hint' | 'state_db' = 'rollout_hint';

      if (!rolloutPath || !canReadPath(rolloutPath)) {
        const lookup = await lookupRolloutPathFromStateDb(
          stateDbPath,
          asTrimmedString(input.thread_id),
          asTrimmedString(input.session_id),
        );
        if (lookup.status === 'state_db_failure') {
          return { status: 'unavailable', reason: lookup.reason };
        }
        if (lookup.status !== 'found') {
          return { status: 'unavailable', reason: 'rollout_not_found' };
        }
        rolloutPath = lookup.rolloutPath;
        source = 'state_db';
      }

      if (!canReadPath(rolloutPath)) {
        return { status: 'unavailable', reason: 'rollout_unreadable' };
      }

      let events: RolloutEvent[];
      try {
        events = await readRolloutEvents(rolloutPath);
      } catch {
        return { status: 'unavailable', reason: 'rollout_parse_failed' };
      }
      if (events.length === 0) {
        return { status: 'unavailable', reason: 'rollout_empty' };
      }

      const centerIndex = findCenterIndex(events, input);
      if (centerIndex === null) {
        return { status: 'unavailable', reason: 'target_not_found' };
      }
      const { window, evidenceRefs } = sliceContextWindow(events, centerIndex, windowRadius);
      if (window.user.length === 0 && window.assistant.length === 0 && window.tool.length === 0) {
        return { status: 'unavailable', reason: 'no_context_slice' };
      }

      return {
        status: 'success',
        source,
        context_window: window,
        evidence_refs: [makePortableRolloutRef(rolloutPath), `rollout_source:${source}`, ...evidenceRefs],
      };
    },
  };
}
