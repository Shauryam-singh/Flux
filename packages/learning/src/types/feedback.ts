export type FeedbackType =
  | "suggestion_accepted"
  | "suggestion_rejected"
  | "suggestion_ignored"
  | "action_succeeded"
  | "action_failed"
  | "user_correction"
  | "user_positive"
  | "user_negative";

export interface Feedback {
  readonly id: string;
  readonly type: FeedbackType;
  readonly actionId: string;
  readonly timestamp: number;
  readonly context: Record<string, unknown>;
}
