import type { Task, TaskConstraints, TaskPriority, TaskGraph } from "@ai-agent/exec-types";

export interface ExecutivePlanner {
  plan(objective: string, context?: Record<string, unknown>): Promise<PlanResult>;
  replan(planId: string, reason: string): Promise<PlanResult>;
  getPlan(planId: string): PlanResult | null;
  getActivePlans(): ReadonlyArray<PlanResult>;
}

export interface PlanResult {
  readonly id: string;
  readonly objective: string;
  readonly tasks: ReadonlyArray<Task>;
  readonly graph: TaskGraph | null;
  readonly complexity: "simple" | "moderate" | "complex" | "epic";
  readonly estimatedDuration: number;
  readonly estimatedCost: number;
  readonly requiredCapabilities: ReadonlyArray<string>;
  readonly createdAt: number;
}

export interface PlanDecomposition {
  readonly tasks: ReadonlyArray<Partial<Task>>;
  readonly dependencies: ReadonlyArray<{ from: string; to: string }>;
  readonly parallelGroups: ReadonlyArray<ReadonlyArray<string>>;
  readonly estimatedDuration: number;
  readonly estimatedCost: number;
}

export interface PlannerConfig {
  readonly enabled: boolean;
  readonly maxTasksPerPlan: number;
  readonly defaultTimeoutMs: number;
  readonly defaultMaxRetries: number;
}
