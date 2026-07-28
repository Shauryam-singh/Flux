import type { ResourceAllocation, ResourceBudget } from "@ai-agent/exec-types";

export interface ResourceManager {
  allocate(agentId: string, taskId: string, tokens: number): ResourceAllocation | null;
  release(allocationId: string): void;
  getBudget(): ResourceBudget;
  canAllocate(tokens: number): boolean;
  getAllocations(): ReadonlyArray<ResourceAllocation>;
  getAllocationsByAgent(agentId: string): ReadonlyArray<ResourceAllocation>;
  cleanup(): number;
  updateUsage(tokens: number, cost: number): void;
}

export interface ResourceManagerConfig {
  readonly totalTokens: number;
  readonly totalCostUsd: number;
  readonly maxConcurrentAgents: number;
  readonly tokensPerMinute: number;
}
