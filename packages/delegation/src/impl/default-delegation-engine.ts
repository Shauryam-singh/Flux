import type { Task, DelegationDecision, TaskPriority, RetryStrategy } from "@ai-agent/exec-types";

export interface DelegationEngine {
  delegate(task: Task): DelegationDecision;
  reevaluate(task: Task, currentAgent: string): DelegationDecision;
  getHistory(): ReadonlyArray<DelegationDecision>;
}

export interface DelegationConfig {
  readonly enabled: boolean;
  readonly defaultTimeoutMs: number;
  readonly defaultMaxRetries: number;
  readonly costWeight: number;
  readonly latencyWeight: number;
  readonly capabilityWeight: number;
}

const DEFAULT_RETRY: RetryStrategy = {
  maxRetries: 3,
  backoffMs: 1000,
  backoffMultiplier: 2,
  maxBackoffMs: 30000,
  retryableErrors: ["timeout", "rate_limit", "temporary_error"],
};

export class DefaultDelegationEngine implements DelegationEngine {
  private config: DelegationConfig;
  private getAgent: (taskId: string) => string | null;
  private history: DelegationDecision[] = [];

  constructor(
    getAgent: (taskId: string) => string | null,
    config?: Partial<DelegationConfig>,
  ) {
    this.getAgent = getAgent;
    this.config = {
      enabled: true,
      defaultTimeoutMs: 300000,
      defaultMaxRetries: 3,
      costWeight: 0.3,
      latencyWeight: 0.3,
      capabilityWeight: 0.4,
      ...config,
    };
  }

  delegate(task: Task): DelegationDecision {
    const agentId = this.getAgent(task.id) ?? "default";
    const decision: DelegationDecision = {
      agentId,
      model: task.constraints.modelPreference ?? "qwen2.5-coder:7b",
      priority: task.priority,
      timeoutMs: task.constraints.timeoutMs || this.config.defaultTimeoutMs,
      retryStrategy: { ...DEFAULT_RETRY, maxRetries: task.constraints.maxRetries || this.config.defaultMaxRetries },
      costEstimate: 0.01,
      latencyEstimate: 5000,
      reasoning: `Delegated to ${agentId} based on capability match`,
    };
    this.history.push(decision);
    return decision;
  }

  reevaluate(task: Task, currentAgent: string): DelegationDecision {
    return this.delegate(task);
  }

  getHistory(): ReadonlyArray<DelegationDecision> {
    return this.history;
  }
}
