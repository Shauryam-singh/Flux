import type { ExecutiveConfig, ExecutiveState, Task, LongGoal, BackgroundProject, ResourceBudget } from "@ai-agent/exec-types";
import type { AgentRegistry } from "@ai-agent/agent-registry";
import type { ExecutivePlanner, PlanResult } from "@ai-agent/executive-planner";
import type { TaskGraphEngine } from "@ai-agent/task-graph";
import type { ExecutionSupervisor } from "@ai-agent/execution-supervisor";
import type { ResourceManager } from "@ai-agent/resource-manager";
import type { ApprovalPipeline } from "@ai-agent/approval-pipeline";
import type { VerificationLayer } from "@ai-agent/verification";
import type { BackgroundProjectManager } from "@ai-agent/background-projects";
import type { LongGoalManager } from "@ai-agent/long-goals";
import type { MessageBus } from "@ai-agent/agent-protocol";

export interface ExecutiveCoreDeps {
  readonly registry: AgentRegistry;
  readonly planner: ExecutivePlanner;
  readonly taskGraph: TaskGraphEngine;
  readonly supervisor: ExecutionSupervisor;
  readonly resources: ResourceManager;
  readonly approval: ApprovalPipeline;
  readonly verification: VerificationLayer;
  readonly backgroundProjects: BackgroundProjectManager;
  readonly longGoals: LongGoalManager;
  readonly messageBus: MessageBus;
}

const DEFAULT_CONFIG: ExecutiveConfig = {
  enabled: true,
  maxConcurrentTasks: 10,
  maxQueuedTasks: 50,
  defaultTimeoutMs: 300000,
  defaultMaxRetries: 3,
  autoApproveLowRisk: true,
  enableVerification: true,
  enableBackgroundProjects: true,
  heartbeatIntervalMs: 30000,
  checkpointIntervalMs: 300000,
  resourceBudgetTokens: 1000000,
  resourceBudgetCostUsd: 10.0,
};

export class ExecutiveCore {
  private config: ExecutiveConfig;
  private deps: ExecutiveCoreDeps;
  private startTime = 0;
  private taskQueue: Task[] = [];
  private completedTasks = 0;
  private failedTasks = 0;
  private timers: NodeJS.Timeout[] = [];

  constructor(deps: ExecutiveCoreDeps, config?: Partial<ExecutiveConfig>) {
    this.deps = deps;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(): void {
    if (!this.config.enabled) return;
    this.startTime = Date.now();

    this.timers.push(
      setInterval(() => this.processQueue(), 1000),
    );

    this.timers.push(
      setInterval(() => this.checkBackgroundProjects(), this.config.heartbeatIntervalMs),
    );

    this.timers.push(
      setInterval(() => this.deps.supervisor.checkTimeouts(), this.config.heartbeatIntervalMs),
    );
  }

  stop(): void {
    for (const timer of this.timers) {
      clearInterval(timer);
    }
    this.timers = [];
  }

  async executeObjective(objective: string, context: Record<string, unknown> = {}): Promise<PlanResult> {
    const plan = await this.deps.planner.plan(objective, context);

    for (const task of plan.tasks) {
      this.queueTask(task);
    }

    return plan;
  }

  queueTask(task: Task): void {
    if (this.taskQueue.length >= this.config.maxQueuedTasks) {
      throw new Error("Task queue full");
    }
    this.taskQueue.push(task);
  }

  getState(): ExecutiveState {
    const budget = this.deps.resources.getBudget();
    return {
      activeTasks: this.deps.supervisor.getActive().length,
      queuedTasks: this.taskQueue.length,
      completedTasks: this.completedTasks,
      failedTasks: this.failedTasks,
      activeAgents: this.deps.registry.getActive().length,
      totalAgents: this.deps.registry.getAll().length,
      resourceBudget: budget,
      pendingApprovals: this.deps.approval.getPending().length,
      activeGoals: this.deps.longGoals.getActive().length,
      backgroundProjects: this.deps.backgroundProjects.getActive().length,
      uptime: this.startTime > 0 ? Date.now() - this.startTime : 0,
    };
  }

  async createLongGoal(title: string, description: string): Promise<LongGoal> {
    return this.deps.longGoals.create(title, description);
  }

  registerBackgroundProject(name: string, description: string, intervalMs: number): BackgroundProject {
    return this.deps.backgroundProjects.create({
      name,
      description,
      schedule: { type: "interval", intervalMs, cronExpression: null, eventTrigger: null, enabled: true },
      tasks: [],
    });
  }

  private processQueue(): void {
    if (this.taskQueue.length === 0) return;
    if (this.deps.supervisor.getActive().length >= this.config.maxConcurrentTasks) return;

    const task = this.taskQueue.shift()!;
    const agent = this.deps.registry.getBestAgent(task);
    if (!agent) {
      this.taskQueue.unshift(task);
      return;
    }

    this.deps.supervisor.track(task);
    this.deps.supervisor.updateProgress(task.id, 0, "Starting");

    agent.execute(task)
      .then((result) => {
        this.completedTasks++;
        this.deps.supervisor.updateProgress(task.id, 100, result.summary);
      })
      .catch((error) => {
        this.failedTasks++;
        this.deps.supervisor.updateProgress(task.id, 0, `Failed: ${error}`);
      });
  }

  private checkBackgroundProjects(): void {
    if (!this.config.enableBackgroundProjects) return;
    const due = this.deps.backgroundProjects.getDue();
    for (const project of due) {
      this.deps.backgroundProjects.recordRun(project.id, true);
    }
  }
}
