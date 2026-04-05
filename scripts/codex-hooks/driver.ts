import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import {
  asText,
  compactText,
  makeAdditionalContext,
  type HookEventName,
  type HookInput,
  type HookResponse,
} from './contracts.ts';
import {
  addPendingFeedback,
  addPendingLongTermCandidate,
  clearPendingLongTermCandidates,
  createDefaultSessionState,
  getSessionStatePath,
  getStateBindingPath,
  getWorkspaceBindingPath,
  loadSessionState,
  markAgentId,
  markIdentitySelectionDeclined,
  rememberEvent,
  readWorkspaceBinding,
  resolveStateRoot,
  resolveWorkspaceRoot,
  saveSessionState,
  updateLastFlush,
  type FeedbackEntry,
  type SessionState,
} from './state.ts';

export type HookDriverOptions = {
  sourceRepoRoot?: string;
  sharedRoot?: string;
  stateRoot?: string;
};

export type HookDriver = {
  handleSessionStart(input: HookInput): HookResponse | null;
  handleUserPromptSubmit(input: HookInput): HookResponse | null;
  handleStop(input: HookInput): HookResponse;
  handlePreToolUse(input: HookInput): HookResponse | null;
  handlePostToolUse(input: HookInput): HookResponse | null;
};

const defaultSourceRepoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));

function resolveSharedRoot(options: HookDriverOptions): string {
  return (
    options.sharedRoot ??
    process.env.OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT ??
    process.env.OBSIDIAN_AGENT_MEMORY_SERVER_ROOT ??
    defaultSourceRepoRoot
  );
}

function getAgentsCommand(sourceRepoRoot: string): string {
  return join(sourceRepoRoot, 'bin', 'agents');
}

function runAgentsCommand(
  sourceRepoRoot: string,
  args: string[],
  sharedRoot: string,
  workspaceRoot: string,
): { code: number; stdout: string; stderr: string } {
  const result = spawnSync(getAgentsCommand(sourceRepoRoot), args, {
    env: {
      ...process.env,
      OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
      OBSIDIAN_AGENT_MEMORY_SERVER_ROOT: sharedRoot,
      OBSIDIAN_AGENT_MEMORY_SERVER_WORKSPACE_ROOT: workspaceRoot,
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return {
    code: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function listAgents(sourceRepoRoot: string, sharedRoot: string, workspaceRoot: string) {
  const result = runAgentsCommand(sourceRepoRoot, ['list'], sharedRoot, workspaceRoot);
  if (result.code !== 0) {
    return [] as Array<{ agent_id: string; canonical_name?: string }>;
  }

  try {
    return JSON.parse(result.stdout) as Array<{ agent_id: string; canonical_name?: string }>;
  } catch {
    return [] as Array<{ agent_id: string; canonical_name?: string }>;
  }
}

function readLatestLongTermSummary(sharedRoot: string, agentId: string): { path: string; summary: string; ref?: string } | null {
  const longTermDir = join(sharedRoot, 'agents', agentId, 'memory', 'long-term');

  try {
    const files = readdirSync(longTermDir).filter((file) => file.endsWith('.json')).sort();
    if (files.length === 0) {
      return null;
    }

    const latestPath = join(longTermDir, files.at(-1)!);
    const parsed = JSON.parse(readFileSync(latestPath, 'utf8')) as {
      summary?: string;
      object_ref?: string;
    };

    return {
      path: latestPath,
      summary: compactText(asText(parsed.summary ?? parsed.object_ref ?? '')),
      ref: parsed.object_ref,
    };
  } catch {
    return null;
  }
}

function readLastAssistantSummary(input: HookInput): string {
  return compactText(asText(input.last_assistant_message ?? input.prompt ?? ''));
}

function extractCommand(input: HookInput): string {
  if (typeof input.tool_input === 'string') {
    return input.tool_input.trim();
  }

  if (input.tool_input && typeof input.tool_input === 'object') {
    const command = input.tool_input.command ?? '';
    return asText(command).trim();
  }

  return '';
}

function eventKey(eventName: HookEventName, input: HookInput): string {
  const sessionId = input.session_id ?? 'unknown-session';
  const turnId = input.turn_id ?? input.tool_use_id ?? input.source ?? 'unknown-turn';
  const toolName = input.tool_name ?? 'no-tool';
  return [eventName, sessionId, turnId, toolName].join(':');
}

function detectWorkspaceRoot(input: HookInput): string {
  return resolveWorkspaceRoot(input.cwd ?? process.cwd());
}

function maybePersistState(
  stateRoot: string,
  workspaceRoot: string,
  sessionId: string,
  state: SessionState,
): void {
  saveSessionState(stateRoot, workspaceRoot, sessionId, state);
}

function resolveCandidateAgentId(
  sourceRepoRoot: string,
  sharedRoot: string,
  workspaceRoot: string,
  stateRoot: string,
  state: SessionState,
): string | null {
  if (state.identity_selection_declined) {
    return null;
  }

  const available = listAgents(sourceRepoRoot, sharedRoot, workspaceRoot);
  const knownIds = new Set(available.map((entry) => entry.agent_id));

  if (state.agent_id && knownIds.has(state.agent_id)) {
    return state.agent_id;
  }

  const explicit = readWorkspaceBinding(workspaceRoot, stateRoot);
  if (explicit && knownIds.has(explicit)) {
    return explicit;
  }

  return null;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function trimSelectionRemainder(text: string): string {
  return text.replace(/^[\s:;,.-]+/, '').trim();
}

function buildIdentitySelectionPrompt(available: Array<{ agent_id: string; canonical_name?: string }>): string {
  const lines = [
    'Agent memory is not initialized for this session.',
    'Before doing memory-assisted work, ask the user to choose an Agent Identity.',
    'Present these options exactly once and wait for the user choice:',
  ];

  for (const [index, agent] of available.entries()) {
    lines.push(`${index + 1}. ${agent.agent_id}${agent.canonical_name ? ` (${agent.canonical_name})` : ''}`);
  }

  lines.push('0. No identity (Not applicable Agent Identity / 不适用 Agent Identity)');
  lines.push('Accept either a number, an exact agent_id, or "no identity".');
  lines.push('Also accept "choice + task" in one message, for example "1 summarize the issue".');
  lines.push('If the user has not chosen yet, do not proceed with memory-assisted task execution.');

  return lines.join('\n');
}

function buildIdentitySelectionContext(available: Array<{ agent_id: string; canonical_name?: string }>): string {
  const lines = ['Identity selection required for this session.'];

  for (const [index, agent] of available.entries()) {
    lines.push(`${index + 1}. ${agent.agent_id}${agent.canonical_name ? ` (${agent.canonical_name})` : ''}`);
  }

  lines.push('0. No identity (Not applicable Agent Identity / 不适用 Agent Identity)');
  lines.push('Reply with a number, an exact agent_id, or "no identity".');
  lines.push('You can also send "choice + task" in one message.');

  return makeAdditionalContext(lines);
}

type ParsedSelection =
  | { kind: 'agent'; agentId: string; remainingPrompt: string }
  | { kind: 'none'; remainingPrompt: string }
  | null;

function parseIdentitySelection(
  prompt: string,
  available: Array<{ agent_id: string; canonical_name?: string }>,
): ParsedSelection {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return null;
  }

  const noneMatch = trimmed.match(
    /^(?:0|no(?:\s+agent(?:\s+identity)?)?|no\s+identity|none|not\s+applicable\s+agent\s+identity|不适用\s*agent\s*identity)\b([\s\S]*)$/iu,
  );
  if (noneMatch) {
    return {
      kind: 'none',
      remainingPrompt: trimSelectionRemainder(noneMatch[1] ?? ''),
    };
  }

  const numericMatch = trimmed.match(/^(\d+)\b([\s\S]*)$/u);
  if (numericMatch) {
    const index = Number.parseInt(numericMatch[1] ?? '', 10);
    if (index === 0) {
      return {
        kind: 'none',
        remainingPrompt: trimSelectionRemainder(numericMatch[2] ?? ''),
      };
    }

    const selected = available[index - 1];
    if (!selected) {
      return null;
    }

    return {
      kind: 'agent',
      agentId: selected.agent_id,
      remainingPrompt: trimSelectionRemainder(numericMatch[2] ?? ''),
    };
  }

  for (const agent of [...available].sort((left, right) => right.agent_id.length - left.agent_id.length)) {
    const match = trimmed.match(new RegExp(`^(${escapeRegExp(agent.agent_id)})\\b([\\s\\S]*)$`, 'u'));
    if (match) {
      return {
        kind: 'agent',
        agentId: agent.agent_id,
        remainingPrompt: trimSelectionRemainder(match[2] ?? ''),
      };
    }
  }

  return null;
}

function buildMemoryContext(
  agentId: string,
  latest: { path: string; summary: string; ref?: string } | null,
): string {
  const lines = [`Mounted identity: ${agentId}`];

  if (latest) {
    lines.push(`Latest long-term ref: ${latest.ref ?? latest.path}`);
    if (latest.summary) {
      lines.push(`Latest summary: ${latest.summary}`);
    }
  } else {
    lines.push('Latest long-term ref: <none>');
  }

  return makeAdditionalContext(lines);
}

function makeFeedbackEntry(
  sessionId: string,
  targetRef: string,
  signalType: FeedbackEntry['signal_type'],
  summary: string,
  evidenceRefs: string[],
): FeedbackEntry {
  return {
    feedback_id: `${sessionId}:${signalType}:${evidenceRefs.join('|') || summary}`,
    target_ref: targetRef,
    signal_type: signalType,
    polarity: 'supporting',
    evidence_refs: evidenceRefs,
    observed_at: new Date().toISOString(),
    summary,
  };
}

function shouldRefreshPrompt(prompt: string): boolean {
  const text = prompt.toLowerCase();
  if (!text.trim()) {
    return false;
  }

  const patterns = [
    'remember',
    'recall',
    'memory',
    'load history',
    'what do we know',
    'what did we decide',
    'what was',
    'previous',
    'resume',
    'continue from',
    'switch',
    'new task',
    'summarize',
    'context',
    'implement',
    'fix',
    'debug',
    'refactor',
    'design',
    'review',
    'test',
    'build',
    'error',
    'retry',
    'restore',
    'plan',
  ];

  return patterns.some((pattern) => text.includes(pattern));
}

function shouldBlockCommand(command: string): string | null {
  const checks: Array<[RegExp, string]> = [
    [/\brm\s+-rf\s+\/(?:\s|$)/i, 'refusing to remove the filesystem root'],
    [/\bgit\s+reset\s+--hard\b/i, 'refusing destructive git reset'],
    [/\bmkfs(\.|)\b/i, 'refusing filesystem formatting commands'],
    [/\bdd\s+if=/i, 'refusing raw disk copy commands'],
    [/\bsudo\s+rm\s+-rf\b/i, 'refusing privileged recursive delete'],
  ];

  for (const [pattern, reason] of checks) {
    if (pattern.test(command)) {
      return reason;
    }
  }

  return null;
}

function flushPendingCandidates(
  sourceRepoRoot: string,
  sharedRoot: string,
  stateRoot: string,
  workspaceRoot: string,
  sessionId: string,
  state: SessionState,
  agentId: string,
  lastAssistantMessage?: string,
): HookResponse | null {
  const candidateLines = state.pending_long_term_candidates.map((candidate) => {
    return `- ${candidate.signal_type}/${candidate.polarity}: ${candidate.summary} [${candidate.evidence_refs.join(', ')}]`;
  });

  if (candidateLines.length === 0 && !lastAssistantMessage) {
    return null;
  }

  const flushLines = [
    `[hook flush] session=${sessionId}`,
    `agent=${agentId}`,
    `workspace=${workspaceRoot}`,
  ];

  if (lastAssistantMessage) {
    flushLines.push(`assistant=${lastAssistantMessage}`);
  }

  if (candidateLines.length > 0) {
    flushLines.push('candidates:');
    flushLines.push(...candidateLines);
  }

  const flushInput = flushLines.join('\n');
  const result = runAgentsCommand(
    sourceRepoRoot,
    ['run', '--agent-id', agentId, '--input', flushInput],
    sharedRoot,
    workspaceRoot,
  );
  if (result.code !== 0) {
    return {
      continue: true,
      systemMessage: `Mounted identity ${agentId}: memory flush failed: ${compactText(result.stderr || result.stdout || 'unknown error')}`,
    };
  }

  clearPendingLongTermCandidates(state);
  state.pending_feedback = [];
  updateLastFlush(state);
  maybePersistState(stateRoot, workspaceRoot, sessionId, state);

  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'Stop',
      additionalContext: `Flushed memory candidates for ${agentId}.`,
    },
  };
}

export function createMemoryHookDriver(options: HookDriverOptions = {}): HookDriver {
  const sourceRepoRoot = options.sourceRepoRoot ?? defaultSourceRepoRoot;
  const sharedRoot = resolveSharedRoot(options);
  const stateRoot = options.stateRoot ?? resolveStateRoot();

  return {
    handleSessionStart(input) {
      const workspaceRoot = detectWorkspaceRoot(input);
      const sessionId = input.session_id ?? 'unknown-session';
      const state = loadSessionState(stateRoot, workspaceRoot, sessionId);
      const key = eventKey('SessionStart', input);

      if (!rememberEvent(state, key)) {
        return null;
      }

      const agentId = resolveCandidateAgentId(sourceRepoRoot, sharedRoot, workspaceRoot, stateRoot, state);
      if (!agentId) {
        const available = listAgents(sourceRepoRoot, sharedRoot, workspaceRoot);
        maybePersistState(stateRoot, workspaceRoot, sessionId, state);
        return {
          continue: true,
          systemMessage: buildIdentitySelectionPrompt(available),
          hookSpecificOutput: {
            hookEventName: 'SessionStart',
            additionalContext: buildIdentitySelectionContext(available),
          },
        };
      }

      markAgentId(state, agentId);
      state.last_session_start = new Date().toISOString();

      const flushResponse = flushPendingCandidates(
        sourceRepoRoot,
        sharedRoot,
        stateRoot,
        workspaceRoot,
        sessionId,
        state,
        agentId,
        readLastAssistantSummary(input),
      );

      if (flushResponse && flushResponse.systemMessage) {
        maybePersistState(stateRoot, workspaceRoot, sessionId, state);
        return flushResponse;
      }

      const verifyResult = runAgentsCommand(
        sourceRepoRoot,
        ['verify', '--agent-id', agentId],
        sharedRoot,
        workspaceRoot,
      );
      if (verifyResult.code !== 0) {
        maybePersistState(stateRoot, workspaceRoot, sessionId, state);
        return {
          continue: true,
          systemMessage: `Mounted identity ${agentId}: memory verify failed: ${compactText(verifyResult.stderr || verifyResult.stdout || 'unknown error')}`,
        };
      }

      const latest = readLatestLongTermSummary(sharedRoot, agentId);
      state.last_retrieval_turn = input.turn_id ?? state.last_retrieval_turn;
      state.last_inject_turn = input.turn_id ?? state.last_inject_turn;
      maybePersistState(stateRoot, workspaceRoot, sessionId, state);

      return {
        continue: true,
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: buildMemoryContext(agentId, latest),
        },
      };
    },

    handleUserPromptSubmit(input) {
      const prompt = input.prompt ?? '';
      const workspaceRoot = detectWorkspaceRoot(input);
      const sessionId = input.session_id ?? 'unknown-session';
      const state = loadSessionState(stateRoot, workspaceRoot, sessionId);
      const key = eventKey('UserPromptSubmit', input);

      if (!rememberEvent(state, key)) {
        return null;
      }

      const agentId = resolveCandidateAgentId(sourceRepoRoot, sharedRoot, workspaceRoot, stateRoot, state);
      if (!agentId) {
        const available = listAgents(sourceRepoRoot, sharedRoot, workspaceRoot);
        const selection = parseIdentitySelection(prompt, available);

        if (selection?.kind === 'none') {
          markIdentitySelectionDeclined(state);
          maybePersistState(stateRoot, workspaceRoot, sessionId, state);

          if (selection.remainingPrompt) {
            return {
              continue: true,
              systemMessage: `The user explicitly selected no identity for this session. Do not use agent memory. Continue with the remaining request: ${selection.remainingPrompt}`,
              hookSpecificOutput: {
                hookEventName: 'UserPromptSubmit',
                additionalContext: 'No Agent Identity selected for this session.',
              },
            };
          }

          return {
            continue: true,
            systemMessage: 'The user explicitly selected no identity for this session. Acknowledge that no Agent Identity will assist in this session and ask for the actual task.',
            hookSpecificOutput: {
              hookEventName: 'UserPromptSubmit',
              additionalContext: 'No Agent Identity selected for this session.',
            },
          };
        }

        if (selection?.kind === 'agent') {
          const verifyResult = runAgentsCommand(
            sourceRepoRoot,
            ['verify', '--agent-id', selection.agentId],
            sharedRoot,
            workspaceRoot,
          );
          if (verifyResult.code !== 0) {
            maybePersistState(stateRoot, workspaceRoot, sessionId, state);
            return {
              continue: true,
              systemMessage: `Identity selection failed for ${selection.agentId}: ${compactText(verifyResult.stderr || verifyResult.stdout || 'unknown error')}`,
            };
          }

          markAgentId(state, selection.agentId);
          state.last_retrieval_turn = input.turn_id ?? state.last_retrieval_turn;
          state.last_inject_turn = input.turn_id ?? state.last_inject_turn;
          maybePersistState(stateRoot, workspaceRoot, sessionId, state);

          const latest = readLatestLongTermSummary(sharedRoot, selection.agentId);
          const additionalLines = [buildMemoryContext(selection.agentId, latest)];
          let systemMessage = `The user's leading token selected the mounted identity ${selection.agentId}.`;

          if (selection.remainingPrompt) {
            additionalLines.push(`Remaining user request: ${selection.remainingPrompt}`);
            systemMessage = `${systemMessage} Treat the remaining request as the actual task: ${selection.remainingPrompt}`;
          } else {
            systemMessage = `${systemMessage} The user's message was selection-only. Confirm the mounted identity and ask for the actual task.`;
          }

          return {
            continue: true,
            systemMessage,
            hookSpecificOutput: {
              hookEventName: 'UserPromptSubmit',
              additionalContext: makeAdditionalContext(additionalLines),
            },
          };
        }

        if (state.identity_selection_declined) {
          maybePersistState(stateRoot, workspaceRoot, sessionId, state);
          return null;
        }

        maybePersistState(stateRoot, workspaceRoot, sessionId, state);
        return {
          continue: true,
          systemMessage: buildIdentitySelectionPrompt(available),
          hookSpecificOutput: {
            hookEventName: 'UserPromptSubmit',
            additionalContext: buildIdentitySelectionContext(available),
          },
        };
      }

      if (!shouldRefreshPrompt(prompt)) {
        return null;
      }

      markAgentId(state, agentId);
      state.last_retrieval_turn = input.turn_id ?? state.last_retrieval_turn;

      const verifyResult = runAgentsCommand(
        sourceRepoRoot,
        ['verify', '--agent-id', agentId],
        sharedRoot,
        workspaceRoot,
      );
      if (verifyResult.code !== 0) {
        maybePersistState(stateRoot, workspaceRoot, sessionId, state);
        return {
          continue: true,
          systemMessage: `Mounted identity ${agentId}: memory verify failed: ${compactText(verifyResult.stderr || verifyResult.stdout || 'unknown error')}`,
        };
      }

      const latest = readLatestLongTermSummary(sharedRoot, agentId);
      maybePersistState(stateRoot, workspaceRoot, sessionId, state);

      return {
        continue: true,
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: buildMemoryContext(agentId, latest),
        },
      };
    },

    handleStop(input) {
      const workspaceRoot = detectWorkspaceRoot(input);
      const sessionId = input.session_id ?? 'unknown-session';
      const state = loadSessionState(stateRoot, workspaceRoot, sessionId);
      const key = eventKey('Stop', input);

      if (!rememberEvent(state, key)) {
        return {
          continue: true,
        };
      }

      const agentId = resolveCandidateAgentId(sourceRepoRoot, sharedRoot, workspaceRoot, stateRoot, state);
      if (!agentId) {
        maybePersistState(stateRoot, workspaceRoot, sessionId, state);
        return {
          continue: true,
        };
      }

      markAgentId(state, agentId);
      const lastAssistantMessage = readLastAssistantSummary(input);

      if (state.pending_long_term_candidates.length === 0 && !lastAssistantMessage) {
        maybePersistState(stateRoot, workspaceRoot, sessionId, state);
        return {
          continue: true,
        };
      }

      const response = flushPendingCandidates(
        sourceRepoRoot,
        sharedRoot,
        stateRoot,
        workspaceRoot,
        sessionId,
        state,
        agentId,
        lastAssistantMessage || undefined,
      );

      if (response) {
        maybePersistState(stateRoot, workspaceRoot, sessionId, state);
        return {
          continue: true,
        };
      }

      maybePersistState(stateRoot, workspaceRoot, sessionId, state);
      return {
        continue: true,
      };
    },

    handlePreToolUse(input) {
      if ((input.tool_name ?? '').trim() !== 'Bash') {
        return null;
      }

      const command = extractCommand(input);
      if (!command) {
        return null;
      }

      const workspaceRoot = detectWorkspaceRoot(input);
      const sessionId = input.session_id ?? 'unknown-session';
      const state = loadSessionState(stateRoot, workspaceRoot, sessionId);
      const key = eventKey('PreToolUse', input);

      if (!rememberEvent(state, key)) {
        return null;
      }

      const agentId = resolveCandidateAgentId(sourceRepoRoot, sharedRoot, workspaceRoot, stateRoot, state);
      if (!agentId) {
        maybePersistState(stateRoot, workspaceRoot, sessionId, state);
        return null;
      }

      const blockedReason = shouldBlockCommand(command);
      if (blockedReason) {
        maybePersistState(stateRoot, workspaceRoot, sessionId, state);
        return {
          continue: true,
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: blockedReason,
          },
          systemMessage: `Mounted identity ${agentId}: ${blockedReason}`,
        };
      }

      const summary = compactText(`Planned Bash command: ${command}`);
      const entry = makeFeedbackEntry(
        sessionId,
        `agent:${agentId}`,
        'review_trace',
        summary,
        [`turn:${input.turn_id ?? 'unknown-turn'}`, `command:${command}`],
      );
      addPendingFeedback(state, entry);
      maybePersistState(stateRoot, workspaceRoot, sessionId, state);
      return null;
    },

    handlePostToolUse(input) {
      if ((input.tool_name ?? '').trim() !== 'Bash') {
        return null;
      }

      const workspaceRoot = detectWorkspaceRoot(input);
      const sessionId = input.session_id ?? 'unknown-session';
      const state = loadSessionState(stateRoot, workspaceRoot, sessionId);
      const key = eventKey('PostToolUse', input);

      if (!rememberEvent(state, key)) {
        return null;
      }

      const agentId = resolveCandidateAgentId(sourceRepoRoot, sharedRoot, workspaceRoot, stateRoot, state);
      if (!agentId) {
        maybePersistState(stateRoot, workspaceRoot, sessionId, state);
        return null;
      }

      const command = extractCommand(input);
      const responseText = compactText(asText(input.tool_response));
      const evidenceRefs = [
        `turn:${input.turn_id ?? 'unknown-turn'}`,
        `tool-use:${input.tool_use_id ?? 'unknown-tool-use'}`,
      ];

      if (command) {
        evidenceRefs.push(`command:${command}`);
      }
      if (responseText) {
        evidenceRefs.push(`response:${responseText}`);
      }

      const entry = makeFeedbackEntry(
        sessionId,
        `agent:${agentId}`,
        responseText ? 'environmental_outcome' : 'review_trace',
        compactText(
          responseText
            ? `Bash result captured for ${agentId}: ${responseText}`
            : `Bash evidence captured for ${agentId}`,
        ),
        evidenceRefs,
      );

      addPendingFeedback(state, entry);
      addPendingLongTermCandidate(state, entry);
      maybePersistState(stateRoot, workspaceRoot, sessionId, state);

      return {
        continue: true,
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: compactText(`Mounted identity: ${agentId}. Captured Bash evidence.`),
        },
      };
    },
  };
}

export function createDefaultHookDriver(): HookDriver {
  return createMemoryHookDriver();
}
