export interface LearningUpdate {
  readonly target: "relationship" | "behaviour" | "personality" | "interrupt";
  readonly field: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
  readonly confidence: number;
  readonly reason: string;
  readonly timestamp: number;
}
