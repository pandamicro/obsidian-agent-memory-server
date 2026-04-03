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
