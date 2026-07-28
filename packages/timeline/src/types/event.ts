export type TimelineEventType =
  | "work_session_start"
  | "work_session_end"
  | "file_edit"
  | "build_success"
  | "build_failure"
  | "test_pass"
  | "test_fail"
  | "commit"
  | "push"
  | "goal_created"
  | "goal_completed"
  | "goal_blocked"
  | "error_occurred"
  | "error_resolved"
  | "conversation"
  | "reflection"
  | "milestone"
  | "observation"
  | "suggestion_made"
  | "suggestion_accepted"
  | "suggestion_rejected"
  | "break_suggested"
  | "break_taken";

export interface TimelineEvent {
  readonly id: string;
  readonly type: TimelineEventType;
  readonly title: string;
  readonly detail: string;
  readonly timestamp: number;
  readonly project: string | null;
  readonly goalId: string | null;
  readonly duration: number | null;
  readonly metadata: Record<string, unknown>;
}

export interface DailySummary {
  readonly date: string;
  readonly events: ReadonlyArray<TimelineEvent>;
  readonly totalEvents: number;
  readonly workDuration: number;
  readonly goalsProgressed: ReadonlyArray<string>;
  readonly errorsEncountered: number;
  readonly commitsMade: number;
  readonly summary: string;
}
