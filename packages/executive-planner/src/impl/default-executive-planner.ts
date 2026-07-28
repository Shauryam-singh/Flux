import type { ExecutivePlanner, PlanResult, PlanDecomposition, PlannerConfig } from "../interfaces/executive-planner.js";
import type { Task, TaskConstraints, TaskGraph } from "@ai-agent/exec-types";
import type { TaskGraphEngine } from "@ai-agent/task-graph";

const DEFAULT_CONFIG: PlannerConfig = {
  enabled: true,
  maxTasksPerPlan: 20,
  defaultTimeoutMs: 300000,
  defaultMaxRetries: 3,
};

let planIdCounter = 0;
let taskIdCounter = 0;

const DEFAULT_CONSTRAINTS: TaskConstraints = {
  maxDurationMs: null,
  maxRetries: 3,
  timeoutMs: 300000,
  requiredCapabilities: [],
  excludedAgents: [],
  preferredAgents: [],
  modelPreference: null,
  costLimit: null,
};

export class DefaultExecutivePlanner implements ExecutivePlanner {
  private config: PlannerConfig;
  private graphEngine: TaskGraphEngine;
  private plans = new Map<string, PlanResult>();

  constructor(graphEngine: TaskGraphEngine, config?: Partial<PlannerConfig>) {
    this.graphEngine = graphEngine;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async plan(objective: string, context: Record<string, unknown> = {}): Promise<PlanResult> {
    const planId = `plan_${++planIdCounter}`;
    const decomposition = this.decompose(objective, context);
    const tasks = decomposition.tasks.map((t: Partial<Task>) => this.createTask(t, objective));

    let graph: TaskGraph | null = null;
    if (tasks.length > 1) {
      graph = this.graphEngine.createGraph(`Graph: ${objective}`, `Auto-generated for: ${objective}`, tasks);
    }

    const plan: PlanResult = {
      id: planId,
      objective,
      tasks,
      graph,
      complexity: this.estimateComplexity(objective, tasks.length),
      estimatedDuration: decomposition.estimatedDuration,
      estimatedCost: decomposition.estimatedCost,
      requiredCapabilities: this.extractCapabilities(tasks),
      createdAt: Date.now(),
    };

    this.plans.set(planId, plan);
    return plan;
  }

  async replan(planId: string, reason: string): Promise<PlanResult> {
    const existing = this.plans.get(planId);
    if (!existing) throw new Error(`Plan ${planId} not found`);
    return this.plan(existing.objective, { replanReason: reason, previousPlan: planId });
  }

  getPlan(planId: string): PlanResult | null {
    return this.plans.get(planId) ?? null;
  }

  getActivePlans(): ReadonlyArray<PlanResult> {
    return Array.from(this.plans.values());
  }

  private decompose(objective: string, context: Record<string, unknown>): PlanDecomposition {
    const tasks: Partial<Task>[] = [];
    const dependencies: Array<{ from: string; to: string }> = [];
    const parallelGroups: string[][] = [];

    const taskId = `task_${++taskIdCounter}`;
    tasks.push({
      objective,
      description: `Execute: ${objective}`,
      priority: "normal",
      constraints: { ...DEFAULT_CONSTRAINTS },
    });

    if (objective.toLowerCase().includes("implement") || objective.toLowerCase().includes("create")) {
      const designId = `task_${++taskIdCounter}`;
      const implementId = `task_${++taskIdCounter}`;
      const testId = `task_${++taskIdCounter}`;

      tasks.length = 0;
      tasks.push(
        { objective: `Design: ${objective}`, description: "Design and plan approach", priority: "high", constraints: { ...DEFAULT_CONSTRAINTS, requiredCapabilities: ["code_generation"] } },
        { objective: `Implement: ${objective}`, description: "Write the implementation", priority: "high", constraints: { ...DEFAULT_CONSTRAINTS, requiredCapabilities: ["code_generation", "code_editing"] } },
        { objective: `Test: ${objective}`, description: "Write and run tests", priority: "normal", constraints: { ...DEFAULT_CONSTRAINTS, requiredCapabilities: ["testing"] } },
      );
      dependencies.push({ from: tasks[0]!.objective!, to: tasks[1]!.objective! });
      dependencies.push({ from: tasks[1]!.objective!, to: tasks[2]!.objective! });
    }

    if (objective.toLowerCase().includes("find") || objective.toLowerCase().includes("debug")) {
      tasks.length = 0;
      tasks.push(
        { objective: `Investigate: ${objective}`, description: "Research and analyze", priority: "high", constraints: { ...DEFAULT_CONSTRAINTS, requiredCapabilities: ["research", "debugging"] } },
        { objective: `Fix: ${objective}`, description: "Implement the fix", priority: "high", constraints: { ...DEFAULT_CONSTRAINTS, requiredCapabilities: ["code_editing"] } },
        { objective: `Verify: ${objective}`, description: "Verify the fix works", priority: "normal", constraints: { ...DEFAULT_CONSTRAINTS, requiredCapabilities: ["testing"] } },
      );
      dependencies.push({ from: tasks[0]!.objective!, to: tasks[1]!.objective! });
      dependencies.push({ from: tasks[1]!.objective!, to: tasks[2]!.objective! });
    }

    return {
      tasks,
      dependencies,
      parallelGroups,
      estimatedDuration: tasks.length * 120000,
      estimatedCost: tasks.length * 0.01,
    };
  }

  private createTask(partial: Partial<Task>, parentObjective: string): Task {
    const id = `task_${++taskIdCounter}`;
    return {
      id,
      objective: partial.objective ?? parentObjective,
      description: partial.description ?? "",
      status: "created",
      priority: partial.priority ?? "normal",
      progress: 0,
      assignedAgent: null,
      parentId: null,
      subtaskIds: [],
      dependencies: partial.dependencies ?? [],
      constraints: partial.constraints ?? DEFAULT_CONSTRAINTS,
      result: null,
      artifacts: [],
      error: null,
      retryCount: 0,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      updatedAt: Date.now(),
      metadata: partial.metadata ?? {},
    };
  }

  private estimateComplexity(objective: string, taskCount: number): PlanResult["complexity"] {
    if (taskCount >= 10) return "epic";
    if (taskCount >= 5) return "complex";
    if (taskCount >= 2) return "moderate";
    return "simple";
  }

  private extractCapabilities(tasks: ReadonlyArray<Task>): ReadonlyArray<string> {
    const caps = new Set<string>();
    for (const task of tasks) {
      for (const cap of task.constraints.requiredCapabilities) {
        caps.add(cap);
      }
    }
    return Array.from(caps);
  }
}
