export type PatternType =
  | "work_hours"
  | "break_frequency"
  | "testing_habit"
  | "commit_habit"
  | "planning_habit"
  | "branch_habit"
  | "error_response"
  | "input_preference"
  | "response_time"
  | "session_length"
  | "focus_pattern"
  | "communication_style";

export interface BehaviourPattern {
  readonly id: string;
  readonly type: PatternType;
  readonly description: string;
  readonly confidence: number;
  readonly occurrences: number;
  readonly firstSeen: number;
  readonly lastSeen: number;
  readonly metadata: Record<string, unknown>;
}
