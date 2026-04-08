export type HydrationInput = {
  session_id?: string | null;
  thread_id?: string | null;
  turn_id?: string | null;
  event?: string | null;
  rollout_path_hint?: string | null;
  workspace_root?: string | null;
  message_id?: string | null;
};

export type HydratedContextWindow = {
  turn_id: string | null;
  event: string | null;
  user: string[];
  assistant: string[];
  tool: string[];
};

export type HydrationSuccess = {
  status: 'success';
  source: 'rollout_hint' | 'state_db';
  context_window: HydratedContextWindow;
  evidence_refs: string[];
};

export type HydrationUnavailable = {
  status: 'unavailable';
  reason: string;
};

export type HydrationResult = HydrationSuccess | HydrationUnavailable;

export type ContextHydrator = {
  hydrate(input: HydrationInput): Promise<HydrationResult>;
};

