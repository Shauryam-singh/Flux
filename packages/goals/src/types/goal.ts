export type GoalStatus =
  | "created"
  | "active"
  | "in_progress"
  | "blocked"
  | "deferred"
  | "completed"
  | "abandoned";

export type GoalSource =
  | "user_request"
  | "observation"
  | "reminder"
  | "autonomous"
  | "inherited";

export interface Blocker {
  readonly id: string;
  readonly description: string;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly detectedAt: number;
  readonly resolvedAt: number | null;
}

export interface Goal {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: GoalStatus;
  readonly priority: number;
  readonly progress: number;
  readonly source: GoalSource;
  readonly parentGoalId: string | null;
  readonly subGoalIds: ReadonlyArray<string>;
  readonly blockers: ReadonlyArray<Blocker>;
  readonly dependencies: ReadonlyArray<string>;
  readonly estimatedCompletion: number | null;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly completedAt: number | null;
}

export interface GoalUpdate {
  readonly goalId: string;
  readonly changes: Partial<Pick<Goal, "status" | "priority" | "progress" | "description">> & {
    readonly blockers?: ReadonlyArray<Blocker>;
  };
}
