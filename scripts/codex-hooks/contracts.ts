import { readFileSync } from 'node:fs';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export type HookEventName =
  | 'SessionStart'
  | 'UserPromptSubmit'
  | 'Stop'
  | 'PreToolUse'
  | 'PostToolUse';

export type HookInput = {
  hook_event_name?: HookEventName;
  session_id?: string;
  thread_id?: string;
  turn_id?: string;
  source?: 'startup' | 'resume';
  cwd?: string;
  prompt?: string;
  tool_name?: string;
  tool_use_id?: string;
  tool_input?: { command?: string } | string;
  tool_response?: unknown;
  last_assistant_message?: string;
  transcript_path?: string;
  model?: string;
};

export type HookEventSource = 'native' | 'derived';

export type HookEnvelope = {
  schema_version: '1';
  event: 'session-start' | 'user-prompt-submit' | 'stop' | 'pre-tool-use' | 'post-tool-use';
  source: HookEventSource;
  timestamp: string;
  session_id: string;
  thread_id?: string;
  turn_id?: string;
  agent_id?: string;
  context: Record<string, unknown>;
  confidence?: number;
  parser_reason?: string;
};

export const HOOK_DERIVED_SIGNALS_ENV = 'OBSIDIAN_AGENT_MEMORY_SERVER_HOOK_DERIVED_SIGNALS';

export type HookSpecificOutput = {
  hookEventName: HookEventName;
  additionalContext?: string;
  permissionDecision?: 'deny' | 'allow' | 'ask';
  permissionDecisionReason?: string;
};

export type HookResponse = {
  continue?: boolean;
  stopReason?: string;
  systemMessage?: string;
  suppressOutput?: boolean;
  hookSpecificOutput?: HookSpecificOutput;
};

export function readHookInput(): HookInput {
  const raw = readFileSync(0, 'utf8').trim();
  debugHookArtifact('stdin.raw', raw);
  if (!raw) {
    return {};
  }

  const parsed = JSON.parse(raw) as Record<string, unknown>;
  debugHookArtifact('stdin.parsed', JSON.stringify(parsed, null, 2));
  return parsed as HookInput;
}

export function writeHookResponse(response: HookResponse): void {
  const serialized = JSON.stringify(response, null, 2);
  debugHookArtifact('stdout.response', serialized);
  process.stdout.write(`${serialized}\n`);
}

export function asText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

export function compactText(text: string, limit = 220): string {
  const singleLine = text.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= limit) {
    return singleLine;
  }

  return `${singleLine.slice(0, limit - 1)}…`;
}

export function makeAdditionalContext(lines: string[]): string {
  return lines.filter(Boolean).join('\n').trim();
}

function toEnvelopeEventName(eventName: HookEventName): HookEnvelope['event'] {
  switch (eventName) {
    case 'SessionStart':
      return 'session-start';
    case 'UserPromptSubmit':
      return 'user-prompt-submit';
    case 'Stop':
      return 'stop';
    case 'PreToolUse':
      return 'pre-tool-use';
    case 'PostToolUse':
      return 'post-tool-use';
  }
}

export function normalizeHookEnvelope(
  input: HookInput,
  eventName: HookEventName,
  options?: {
    source?: HookEventSource;
    agentId?: string;
    context?: Record<string, unknown>;
    confidence?: number;
    parserReason?: string;
  },
): HookEnvelope {
  const source = options?.source ?? 'native';
  const envelope: HookEnvelope = {
    schema_version: '1',
    event: toEnvelopeEventName(eventName),
    source,
    timestamp: new Date().toISOString(),
    session_id: (input.session_id ?? 'unknown-session').trim() || 'unknown-session',
    context: options?.context ?? {},
  };

  const threadId = input.thread_id?.trim();
  const turnId = input.turn_id?.trim();
  const agentId = options?.agentId?.trim();

  if (threadId) envelope.thread_id = threadId;
  if (turnId) envelope.turn_id = turnId;
  if (agentId) envelope.agent_id = agentId;

  if (source === 'derived') {
    if (typeof options?.confidence === 'number') {
      const clamped = Math.max(0, Math.min(1, options.confidence));
      envelope.confidence = clamped;
    }
    if (options?.parserReason) {
      envelope.parser_reason = options.parserReason;
    }
  }

  return envelope;
}

export function isDerivedSignalsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env[HOOK_DERIVED_SIGNALS_ENV] ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function debugHookArtifact(kind: string, content: string): void {
  const debugDir = process.env.OBSIDIAN_AGENT_MEMORY_SERVER_HOOKS_DEBUG_DIR?.trim();
  if (!debugDir) {
    return;
  }

  try {
    mkdirSync(debugDir, { recursive: true });
    const stamp = new Date().toISOString().replaceAll(':', '-');
    const safeKind = kind.replaceAll('/', '_');
    const path = join(debugDir, `${stamp}-${process.pid}-${safeKind}.log`);
    appendFileSync(path, `${content}\n`, 'utf8');
  } catch {
    // best-effort debug logging only
  }
}
