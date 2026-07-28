import type { Task, DelegationDecision } from "@ai-agent/exec-types";

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
