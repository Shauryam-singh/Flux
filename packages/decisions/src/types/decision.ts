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
