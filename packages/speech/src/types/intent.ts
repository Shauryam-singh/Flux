export type IntentType =
  | "suggestion"
  | "observation"
  | "question"
  | "celebration"
  | "concern"
  | "explanation"
  | "confirmation"
  | "greeting"
  | "farewell"
  | "encouragement"
  | "reminder"
  | "reflection";

export interface Intent {
  readonly type: IntentType;
  readonly content: string;
  readonly context: string;
  readonly confidence: number;
  readonly priority: number;
  readonly relatedGoalId: string | null;
}
