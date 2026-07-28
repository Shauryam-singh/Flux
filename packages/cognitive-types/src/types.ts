export type ActionType =
  | "silent"
  | "remember"
  | "tool"
  | "speak"
  | "ask"
  | "schedule"
  | "remind"
  | "goal_update";

export interface Action {
  readonly type: ActionType;
  readonly payload: Record<string, unknown>;
  readonly confidence: number;
  readonly reasoning: string;
}

export interface Decision {
  readonly action: Action;
  readonly interrupts: boolean;
  readonly interruptPriority: number;
  readonly reasoning: string;
  readonly timestamp: number;
}

export type ThoughtType =
  | "observation_interpretation"
  | "goal_evaluation"
  | "pattern_recognition"
  | "prediction"
  | "suggestion"
  | "reflection"
  | "concern";

export interface Thought {
  readonly id: string;
  readonly type: ThoughtType;
  readonly content: string;
  readonly confidence: number;
  readonly reasoning: string;
  readonly timestamp: number;
  readonly relatedGoalId: string | null;
  readonly relatedObservationIds: ReadonlyArray<string>;
  readonly suggestedAction: Action | null;
}

export type ReasoningTrigger =
  | "observation"
  | "goal_change"
  | "timer"
  | "user_message"
  | "error"
  | "reflection";

export interface ReasoningCycleResult {
  readonly thoughts: ReadonlyArray<Thought>;
  readonly recommendedAction: Action | null;
  readonly confidence: number;
  readonly durationMs: number;
  readonly trigger: ReasoningTrigger;
}
