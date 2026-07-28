export interface Reflection {
  readonly id: string;
  readonly date: string;
  readonly timestamp: number;
  readonly accomplishments: ReadonlyArray<string>;
  readonly blockers: ReadonlyArray<string>;
  readonly patterns: ReadonlyArray<string>;
  readonly goalsProgressed: ReadonlyArray<{ goalId: string; progress: number }>;
  readonly suggestedPriorities: ReadonlyArray<string>;
  readonly mood: string;
  readonly summary: string;
}

export interface ReflectionRequest {
  readonly type: "daily" | "weekly" | "on_demand";
  readonly dateRange: { start: number; end: number };
}
