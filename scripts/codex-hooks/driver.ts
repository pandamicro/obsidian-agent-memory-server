import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import {
  asText,
  compactText,
  makeAdditionalContext,
  normalizeHookEnvelope,
  type HookEnvelope,
  type HookEventName,
  type HookInput,
  type HookResponse,
} from './contracts.ts';
import {
  addPendingFeedback,
  appendHookLog,
  clearFailure,
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
  trackFailure,
  updateLastFlush,
  type FeedbackEntry,
  type SessionState,
} from './state.ts';

export type HookDriverOptions = {
  sourceRepoRoot?: string;
  sharedRoot?: string;
  stateRoot?: string;
  agentsTimeoutMs?: number;
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

function getReveCommand(sourceRepoRoot: string): string {
  return join(sourceRepoRoot, 'bin', 'reve');
}

type AgentsCommandReason = 'ok' | 'timeout' | 'spawn_error' | 'exit_nonzero';

type AgentsCommandResult = {
  code: number;
  stdout: string;
  stderr: string;
  reason: AgentsCommandReason;
};

function readAgentsTimeoutMs(options: HookDriverOptions): number {
  const raw = options.agentsTimeoutMs ?? Number.parseInt(process.env.OBSIDIAN_AGENT_MEMORY_SERVER_HOOKS_AGENTS_TIMEOUT_MS ?? '', 10);
  if (!Number.isFinite(raw)) {
    return 12000;
  }
  const rounded = Math.floor(raw);
  if (rounded < 1000) return 1000;
  if (rounded > 120000) return 120000;
  return rounded;
}

function readReveTimeoutMs(): number {
  const raw = Number.parseInt(process.env.OBSIDIAN_AGENT_MEMORY_SERVER_HOOKS_REVE_TIMEOUT_MS ?? '', 10);
  if (!Number.isFinite(raw)) {
    return 12000;
  }
  const rounded = Math.floor(raw);
  if (rounded < 1000) return 1000;
  if (rounded > 120000) return 120000;
  return rounded;
}

function isStopDistillEnabled(): boolean {
  const raw = (process.env.OBSIDIAN_AGENT_MEMORY_SERVER_HOOKS_STOP_TRIGGER_DISTILL ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function runAgentsCommand(
  sourceRepoRoot: string,
  args: string[],
  sharedRoot: string,
  workspaceRoot: string,
  timeoutMs: number,
): AgentsCommandResult {
  const result = spawnSync(getAgentsCommand(sourceRepoRoot), args, {
    env: {
      ...process.env,
      OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
      OBSIDIAN_AGENT_MEMORY_SERVER_ROOT: sharedRoot,
      OBSIDIAN_AGENT_MEMORY_SERVER_WORKSPACE_ROOT: workspaceRoot,
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: timeoutMs,
  });

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const errorCode = (result.error as NodeJS.ErrnoException | undefined)?.code;
  const errorMessage = result.error?.message ?? '';

  if (result.status === 0) {
    return {
      code: 0,
      stdout,
      stderr,
      reason: 'ok',
    };
  }

  if (errorCode === 'ETIMEDOUT' || /timed?\s*out/i.test(errorMessage)) {
    return {
      code: 124,
      stdout,
      stderr: compactText(`${stderr}\n${errorMessage}`.trim() || `agents command timed out after ${timeoutMs}ms`),
      reason: 'timeout',
    };
  }

  if (result.error) {
    return {
      code: result.status ?? 1,
      stdout,
      stderr: compactText(`${stderr}\n${errorMessage}`.trim() || 'agents command failed to spawn'),
      reason: 'spawn_error',
    };
  }

  return {
    code: result.status ?? 1,
    stdout,
    stderr,
    reason: 'exit_nonzero',
  };
}

function runReveDistillCommand(
  sourceRepoRoot: string,
  agentId: string,
  sharedRoot: string,
  workspaceRoot: string,
  timeoutMs: number,
): AgentsCommandResult {
  const args = ['distill', '--agent-id', agentId, '--limit', process.env.OBSIDIAN_AGENT_MEMORY_SERVER_HOOKS_STOP_DISTILL_LIMIT ?? '20'];
  const result = spawnSync(getReveCommand(sourceRepoRoot), args, {
    env: {
      ...process.env,
      OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT: sharedRoot,
      OBSIDIAN_AGENT_MEMORY_SERVER_ROOT: sharedRoot,
      OBSIDIAN_AGENT_MEMORY_SERVER_WORKSPACE_ROOT: workspaceRoot,
    },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: timeoutMs,
  });

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const errorCode = (result.error as NodeJS.ErrnoException | undefined)?.code;
  const errorMessage = result.error?.message ?? '';

  if (result.status === 0) {
    return {
      code: 0,
      stdout,
      stderr,
      reason: 'ok',
    };
  }

  if (errorCode === 'ETIMEDOUT' || /timed?\s*out/i.test(errorMessage)) {
    return {
      code: 124,
      stdout,
      stderr: compactText(`${stderr}\n${errorMessage}`.trim() || `reve distill timed out after ${timeoutMs}ms`),
      reason: 'timeout',
    };
  }

  if (result.error) {
    return {
      code: result.status ?? 1,
      stdout,
      stderr: compactText(`${stderr}\n${errorMessage}`.trim() || 'reve distill failed to spawn'),
      reason: 'spawn_error',
    };
  }

  return {
    code: result.status ?? 1,
    stdout,
    stderr,
    reason: 'exit_nonzero',
  };
}

function logHookEvent(
  stateRoot: string,
  workspaceRoot: string,
  sessionId: string,
  payload: Record<string, unknown>,
): void {
  appendHookLog(stateRoot, {
    workspace_root: workspaceRoot,
    session_id: sessionId,
    ...payload,
  });
}

function listAgents(sourceRepoRoot: string, sharedRoot: string, workspaceRoot: string, agentsTimeoutMs: number) {
  const result = runAgentsCommand(sourceRepoRoot, ['list'], sharedRoot, workspaceRoot, agentsTimeoutMs);
  if (result.code !== 0) {
    return [] as Array<{ agent_id: string; canonical_name?: string }>;
  }

  try {
    return JSON.parse(result.stdout) as Array<{ agent_id: string; canonical_name?: string }>;
  } catch {
    return [] as Array<{ agent_id: string; canonical_name?: string }>;
  }
}

type AgentProfile = {
  agent_id: string;
  canonical_name?: string;
  specialization?: string;
  mission?: string;
};

function readAgentProfile(sharedRoot: string, agentId: string): AgentProfile | null {
  const identityPath = join(sharedRoot, 'agents', agentId, 'identity', 'agent_identity.json');
  try {
    const parsed = JSON.parse(readFileSync(identityPath, 'utf8')) as Partial<AgentProfile>;
    return {
      agent_id: agentId,
      canonical_name: asText(parsed.canonical_name ?? '').trim() || undefined,
      specialization: asText(parsed.specialization ?? '').trim() || undefined,
      mission: asText(parsed.mission ?? '').trim() || undefined,
    };
  } catch {
    return null;
  }
}

function listAgentProfiles(
  sourceRepoRoot: string,
  sharedRoot: string,
  workspaceRoot: string,
  agentsTimeoutMs: number,
): AgentProfile[] {
  return listAgents(sourceRepoRoot, sharedRoot, workspaceRoot, agentsTimeoutMs)
    .map((entry) => readAgentProfile(sharedRoot, entry.agent_id))
    .filter((entry): entry is AgentProfile => Boolean(entry));
}

type StrictRule = {
  specialization: string;
  strongPromptPatterns: RegExp[];
  promptPatterns: RegExp[];
  workspacePatterns: RegExp[];
};

const STRICT_SPECIALIZATION_RULES: StrictRule[] = [
  {
    specialization: 'agentic-memory-framework-development',
    strongPromptPatterns: [
      /\bagentic\s+memory\b/i,
      /\bagent(?:\s+identity)?\s+memory\b/i,
      /\bcodex\s+hooks?\b/i,
      /\bhooks?\s+memory\s+registration\b/i,
      /agent\s+identity/i,
      /记忆.*hook|hook.*记忆/u,
      /agent\s*identity/u,
    ],
    promptPatterns: [
      /\bmemory\b/i,
      /\bhook\b/i,
      /\bhooks\b/i,
      /\blong[-\s]?term\b/i,
      /\bshort[-\s]?term\b/i,
      /\bportable[-\s]?agent[-\s]?contract\b/i,
      /动态记忆|长期记忆|短期记忆|记忆注册/u,
    ],
    workspacePatterns: [
      /obsidian-agent-memory-server/i,
      /agent-memory/i,
    ],
  },
  {
    specialization: 'research',
    strongPromptPatterns: [
      /\bresearch\b/i,
      /\binvestigate\b/i,
      /\bevidence\b/i,
      /\bliterature\b/i,
      /调研|研究|证据|一手资料/u,
    ],
    promptPatterns: [
      /\banaly[sz]e\b/i,
      /\bcompare\b/i,
      /\bsurvey\b/i,
      /\bpaper\b/i,
      /\bbenchmark\b/i,
      /对比|分析/u,
    ],
    workspacePatterns: [
      /research/i,
      /paper/i,
      /docs/i,
    ],
  },
  {
    specialization: 'unity-performance-optimization',
    strongPromptPatterns: [
      /\bunity\b/i,
      /\bprofiler\b/i,
      /\bgc\b/i,
      /\ballocation\b/i,
      /\bframe\s*time\b/i,
      /\bfps\b/i,
      /\bmemory\s+spike\b/i,
      /性能优化|内存抖动|帧率|卡顿/u,
    ],
    promptPatterns: [
      /\bc#\b/i,
      /\bil2cpp\b/i,
      /\bburst\b/i,
      /\bmono\b/i,
      /\bhot\s+path\b/i,
      /unity|优化|垃圾回收/u,
    ],
    workspacePatterns: [
      /unity/i,
      /assets/i,
      /projectsettings/i,
      /packages/i,
    ],
  },
];

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((count, pattern) => (pattern.test(text) ? count + 1 : count), 0);
}

function resolveStrictRule(profile: AgentProfile): StrictRule | null {
  const specialization = profile.specialization?.trim();
  if (!specialization) {
    return null;
  }
  return STRICT_SPECIALIZATION_RULES.find((rule) => rule.specialization === specialization) ?? null;
}

function tryStrictAutoMount(
  profiles: AgentProfile[],
  prompt: string,
  workspaceRoot: string,
): { agentId: string; reason: string } | null {
  const normalizedPrompt = compactText(prompt).toLowerCase();
  if (!normalizedPrompt) {
    return null;
  }

  const normalizedWorkspace = workspaceRoot.toLowerCase();
  const qualified: Array<{ profile: AgentProfile; promptHits: number; pathHit: boolean }> = [];

  for (const profile of profiles) {
    const rule = resolveStrictRule(profile);
    if (!rule) {
      continue;
    }

    const strongHits = countMatches(normalizedPrompt, rule.strongPromptPatterns);
    const promptHits = countMatches(normalizedPrompt, rule.promptPatterns);
    const pathHit = rule.workspacePatterns.some((pattern) => pattern.test(normalizedWorkspace));

    const strictQualified =
      strongHits >= 2 ||
      (strongHits >= 1 && promptHits >= 1) ||
      (strongHits >= 1 && pathHit);

    if (!strictQualified) {
      continue;
    }

    qualified.push({ profile, promptHits: strongHits + promptHits, pathHit });
  }

  if (qualified.length !== 1) {
    return null;
  }

  const selected = qualified[0];
  const reasonParts = [
    `specialization=${selected.profile.specialization ?? 'unknown'}`,
    `prompt_signals=${selected.promptHits}`,
  ];
  if (selected.pathHit) {
    reasonParts.push('workspace_signal=matched');
  }

  return {
    agentId: selected.profile.agent_id,
    reason: reasonParts.join(', '),
  };
}

function readLatestLongTermSummary(sharedRoot: string, agentId: string): { path: string; summary: string; ref?: string } | null {
  const shortTermDir = join(sharedRoot, 'agents', agentId, 'memory', 'short-term');

  try {
    const files = readdirSync(shortTermDir).filter((file) => file.endsWith('.json')).sort();
    if (files.length === 0) {
      return null;
    }

    const latestPath = join(shortTermDir, files.at(-1)!);
    const parsed = JSON.parse(readFileSync(latestPath, 'utf8')) as {
      object_ref?: string;
      assistant_summary?: string | null;
      summary?: string | null;
      quality?: { status?: string };
    };

    const summaryParts = [
      asText(parsed.assistant_summary ?? '').trim(),
      asText(parsed.summary ?? '').trim(),
      parsed.quality?.status ? `quality=${parsed.quality.status}` : '',
    ].filter(Boolean);

    return {
      path: latestPath,
      summary: compactText(summaryParts.join(' | ') || asText(parsed.object_ref ?? '')),
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

function eventKey(eventName: HookEventName, envelope: HookEnvelope, input: HookInput): string {
  const sessionId = envelope.session_id;
  const turnId = envelope.turn_id ?? input.tool_use_id ?? input.source ?? 'unknown-turn';
  return [eventName, sessionId, turnId].join(':');
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
  agentsTimeoutMs: number,
): string | null {
  if (state.identity_selection_declined) {
    return null;
  }

  const available = listAgents(sourceRepoRoot, sharedRoot, workspaceRoot, agentsTimeoutMs);
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
    lines.push(`Latest short-term ref: ${latest.ref ?? latest.path}`);
    if (latest.summary) {
      lines.push(`Latest summary: ${latest.summary}`);
    }
  } else {
    lines.push('Latest short-term ref: <none>');
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

function inputTurnKey(value: string | undefined): string {
  const text = compactText(asText(value ?? ''), 60);
  return text || 'none';
}

function handleAgentsFailure(
  state: SessionState,
  failureKey: string,
  reason: AgentsCommandReason,
  stderr: string,
  stdout: string,
  messageFactory: (reasonPrefix: string, details: string) => string,
): HookResponse {
  const tracked = trackFailure(state, failureKey, reason);
  if (tracked.suppressed) {
    return {
      continue: true,
    };
  }

  const reasonPrefix = reason === 'timeout' ? 'timed out' : reason === 'spawn_error' ? 'spawn failed' : 'failed';
  return {
    continue: true,
    systemMessage: messageFactory(reasonPrefix, compactText(stderr || stdout || 'unknown error')),
  };
}

export function createMemoryHookDriver(options: HookDriverOptions = {}): HookDriver {
  const sourceRepoRoot = options.sourceRepoRoot ?? defaultSourceRepoRoot;
  const sharedRoot = resolveSharedRoot(options);
  const stateRoot = options.stateRoot ?? resolveStateRoot();
  const agentsTimeoutMs = readAgentsTimeoutMs(options);

  return {
    handleSessionStart(input) {
      const envelope = normalizeHookEnvelope(input, 'SessionStart', {
        context: {
          trigger_source: input.source ?? 'unknown',
        },
      });
      const workspaceRoot = detectWorkspaceRoot(input);
      const sessionId = envelope.session_id;
      const state = loadSessionState(stateRoot, workspaceRoot, sessionId);
      const key = eventKey('SessionStart', envelope, input);
      logHookEvent(stateRoot, workspaceRoot, sessionId, {
        event: 'session-start',
        phase: 'received',
        dedupe_key: key,
      });

      if (!rememberEvent(state, key)) {
        return null;
      }

      let autoMountReason: string | null = null;
      let agentId = resolveCandidateAgentId(sourceRepoRoot, sharedRoot, workspaceRoot, stateRoot, state, agentsTimeoutMs);
      if (!agentId && !state.identity_selection_declined) {
        const profiles = listAgentProfiles(sourceRepoRoot, sharedRoot, workspaceRoot, agentsTimeoutMs);
        const decision = tryStrictAutoMount(profiles, asText(input.prompt ?? ''), workspaceRoot);
        if (decision) {
          agentId = decision.agentId;
          autoMountReason = decision.reason;
        }
      }
      if (!agentId) {
        maybePersistState(stateRoot, workspaceRoot, sessionId, state);
        return null;
      }

      markAgentId(state, agentId);
      state.last_session_start = new Date().toISOString();

      const verifyResult = runAgentsCommand(
        sourceRepoRoot,
        ['verify', '--agent-id', agentId],
        sharedRoot,
        workspaceRoot,
        agentsTimeoutMs,
      );
      logHookEvent(stateRoot, workspaceRoot, sessionId, {
        event: 'session-start',
        phase: 'agents_verify',
        agent_id: agentId,
        result_reason: verifyResult.reason,
        result_code: verifyResult.code,
      });
      if (verifyResult.code !== 0) {
        const failureResponse = handleAgentsFailure(
          state,
          `agents-verify:session-start:${sessionId}:${agentId}`,
          verifyResult.reason,
          verifyResult.stderr,
          verifyResult.stdout,
          (reasonPrefix, details) => `Mounted identity ${agentId}: memory verify ${reasonPrefix}: ${details}`,
        );
        maybePersistState(stateRoot, workspaceRoot, sessionId, state);
        return failureResponse;
      }
      clearFailure(state, `agents-verify:session-start:${sessionId}:${agentId}`);

      const latest = readLatestLongTermSummary(sharedRoot, agentId);
      state.last_retrieval_turn = input.turn_id ?? state.last_retrieval_turn;
      state.last_inject_turn = input.turn_id ?? state.last_inject_turn;
      maybePersistState(stateRoot, workspaceRoot, sessionId, state);

      return {
        continue: true,
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: makeAdditionalContext([
            buildMemoryContext(agentId, latest),
            autoMountReason ? `Auto-mounted by strict match: ${autoMountReason}` : '',
          ]),
        },
      };
    },

    handleUserPromptSubmit(input) {
      const prompt = input.prompt ?? '';
      const envelope = normalizeHookEnvelope(input, 'UserPromptSubmit', {
        context: {
          prompt_preview: compactText(prompt, 120),
        },
      });
      const workspaceRoot = detectWorkspaceRoot(input);
      const sessionId = envelope.session_id;
      const state = loadSessionState(stateRoot, workspaceRoot, sessionId);
      const key = eventKey('UserPromptSubmit', envelope, input);
      logHookEvent(stateRoot, workspaceRoot, sessionId, {
        event: 'user-prompt-submit',
        phase: 'received',
        dedupe_key: key,
      });

      if (!rememberEvent(state, key)) {
        return null;
      }

      const boundAgentId = resolveCandidateAgentId(sourceRepoRoot, sharedRoot, workspaceRoot, stateRoot, state, agentsTimeoutMs);
      const available = listAgents(sourceRepoRoot, sharedRoot, workspaceRoot, agentsTimeoutMs);
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
          systemMessage: 'The user explicitly selected no identity for this session. Continue without memory-assisted identity support.',
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
          agentsTimeoutMs,
        );
        logHookEvent(stateRoot, workspaceRoot, sessionId, {
          event: 'user-prompt-submit',
          phase: 'agents_verify_selection',
          agent_id: selection.agentId,
          result_reason: verifyResult.reason,
          result_code: verifyResult.code,
        });
        if (verifyResult.code !== 0) {
          const failureResponse = handleAgentsFailure(
            state,
            `agents-verify:selection:${sessionId}:${selection.agentId}`,
            verifyResult.reason,
            verifyResult.stderr,
            verifyResult.stdout,
            (reasonPrefix, details) => `Identity selection ${reasonPrefix} for ${selection.agentId}: ${details}`,
          );
          maybePersistState(stateRoot, workspaceRoot, sessionId, state);
          return failureResponse;
        }
        clearFailure(state, `agents-verify:selection:${sessionId}:${selection.agentId}`);

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

      let agentId = boundAgentId;
      let autoMountReason: string | null = null;
      if (!agentId && !state.identity_selection_declined) {
        const profiles = listAgentProfiles(sourceRepoRoot, sharedRoot, workspaceRoot, agentsTimeoutMs);
        const decision = tryStrictAutoMount(profiles, prompt, workspaceRoot);
        if (decision) {
          agentId = decision.agentId;
          autoMountReason = decision.reason;
        }
      }

      if (!agentId) {
        maybePersistState(stateRoot, workspaceRoot, sessionId, state);
        return null;
      }

      if (!shouldRefreshPrompt(prompt) && !autoMountReason) {
        return null;
      }

      markAgentId(state, agentId);
      state.last_retrieval_turn = input.turn_id ?? state.last_retrieval_turn;

      const verifyResult = runAgentsCommand(
        sourceRepoRoot,
        ['verify', '--agent-id', agentId],
        sharedRoot,
        workspaceRoot,
        agentsTimeoutMs,
      );
      logHookEvent(stateRoot, workspaceRoot, sessionId, {
        event: 'user-prompt-submit',
        phase: 'agents_verify',
        agent_id: agentId,
        result_reason: verifyResult.reason,
        result_code: verifyResult.code,
      });
      if (verifyResult.code !== 0) {
        const failureResponse = handleAgentsFailure(
          state,
          `agents-verify:user-prompt:${sessionId}:${agentId}`,
          verifyResult.reason,
          verifyResult.stderr,
          verifyResult.stdout,
          (reasonPrefix, details) => `Mounted identity ${agentId}: memory verify ${reasonPrefix}: ${details}`,
        );
        maybePersistState(stateRoot, workspaceRoot, sessionId, state);
        return failureResponse;
      }
      clearFailure(state, `agents-verify:user-prompt:${sessionId}:${agentId}`);

      const latest = readLatestLongTermSummary(sharedRoot, agentId);
      maybePersistState(stateRoot, workspaceRoot, sessionId, state);

      return {
        continue: true,
        systemMessage: autoMountReason
          ? `Auto-mounted identity ${agentId} via strict match (${autoMountReason}).`
          : undefined,
        hookSpecificOutput: {
          hookEventName: 'UserPromptSubmit',
          additionalContext: makeAdditionalContext([
            buildMemoryContext(agentId, latest),
            autoMountReason ? `Auto-mounted by strict match: ${autoMountReason}` : '',
          ]),
        },
      };
    },

    handleStop(input) {
      const envelope = normalizeHookEnvelope(input, 'Stop', {
        context: {
          has_assistant_summary: Boolean(readLastAssistantSummary(input)),
        },
      });
      const workspaceRoot = detectWorkspaceRoot(input);
      const sessionId = envelope.session_id;
      const state = loadSessionState(stateRoot, workspaceRoot, sessionId);
      const key = eventKey('Stop', envelope, input);
      logHookEvent(stateRoot, workspaceRoot, sessionId, {
        event: 'stop',
        phase: 'received',
        dedupe_key: key,
      });

      if (!rememberEvent(state, key)) {
        return {
          continue: true,
        };
      }

      const agentId = resolveCandidateAgentId(sourceRepoRoot, sharedRoot, workspaceRoot, stateRoot, state, agentsTimeoutMs);
      if (!agentId) {
        maybePersistState(stateRoot, workspaceRoot, sessionId, state);
        return {
          continue: true,
        };
      }

      markAgentId(state, agentId);
      const lastAssistantMessage = readLastAssistantSummary(input);
      if (lastAssistantMessage) {
        const entry = makeFeedbackEntry(
          sessionId,
          `agent:${agentId}`,
          'explicit',
          compactText(`Assistant summary captured for ${agentId}: ${lastAssistantMessage}`),
          [`turn:${input.turn_id ?? 'unknown-turn'}`],
        );
        addPendingFeedback(state, entry);
      }

      state.pending_feedback = [];
      updateLastFlush(state);

      maybePersistState(stateRoot, workspaceRoot, sessionId, state);

      if (isStopDistillEnabled()) {
        const reveResult = runReveDistillCommand(
          sourceRepoRoot,
          agentId,
          sharedRoot,
          workspaceRoot,
          readReveTimeoutMs(),
        );
        logHookEvent(stateRoot, workspaceRoot, sessionId, {
          event: 'stop',
          phase: 'reve_distill',
          status: reveResult.code === 0 ? 'ok' : 'error',
          reason: reveResult.reason,
          code: reveResult.code,
          stderr: compactText(reveResult.stderr, 300),
        });
      }

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

      const envelope = normalizeHookEnvelope(input, 'PreToolUse', {
        context: {
          tool_name: input.tool_name ?? '',
          command_preview: compactText(command, 120),
        },
      });
      const workspaceRoot = detectWorkspaceRoot(input);
      const sessionId = envelope.session_id;
      const state = loadSessionState(stateRoot, workspaceRoot, sessionId);
      const key = eventKey('PreToolUse', envelope, input);
      logHookEvent(stateRoot, workspaceRoot, sessionId, {
        event: 'pre-tool-use',
        phase: 'received',
        dedupe_key: key,
      });

      if (!rememberEvent(state, key)) {
        return null;
      }

      const agentId = resolveCandidateAgentId(sourceRepoRoot, sharedRoot, workspaceRoot, stateRoot, state, agentsTimeoutMs);
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

      const envelope = normalizeHookEnvelope(input, 'PostToolUse', {
        context: {
          tool_name: input.tool_name ?? '',
          has_tool_response: input.tool_response !== undefined,
        },
      });
      const workspaceRoot = detectWorkspaceRoot(input);
      const sessionId = envelope.session_id;
      const state = loadSessionState(stateRoot, workspaceRoot, sessionId);
      const key = eventKey('PostToolUse', envelope, input);
      logHookEvent(stateRoot, workspaceRoot, sessionId, {
        event: 'post-tool-use',
        phase: 'received',
        dedupe_key: key,
      });

      if (!rememberEvent(state, key)) {
        return null;
      }

      const agentId = resolveCandidateAgentId(sourceRepoRoot, sharedRoot, workspaceRoot, stateRoot, state, agentsTimeoutMs);
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
