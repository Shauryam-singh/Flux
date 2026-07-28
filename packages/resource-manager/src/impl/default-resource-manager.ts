import type { ResourceManager, ResourceManagerConfig } from "../interfaces/resource-manager.js";
import type { ResourceAllocation, ResourceBudget } from "@ai-agent/exec-types";

let allocIdCounter = 0;

const DEFAULT_CONFIG: ResourceManagerConfig = {
  totalTokens: 1000000,
  totalCostUsd: 10.0,
  maxConcurrentAgents: 5,
  tokensPerMinute: 100000,
};

export class DefaultResourceManager implements ResourceManager {
  private config: ResourceManagerConfig;
  private allocations: ResourceAllocation[] = [];
  private usedTokens = 0;
  private usedCostUsd = 0;
  private tokensUsedThisMinute = 0;
  private minuteStart = 0;

  constructor(config?: Partial<ResourceManagerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.minuteStart = Date.now();
  }

  allocate(agentId: string, taskId: string, tokens: number): ResourceAllocation | null {
    if (!this.canAllocate(tokens)) return null;

    const concurrentAgents = new Set(this.allocations.map((a) => a.agentId)).size;
    if (concurrentAgents >= this.config.maxConcurrentAgents) return null;

    const allocation: ResourceAllocation = {
      agentId,
      taskId,
      tokens,
      cpuShares: 1,
      memoryMb: 512,
      gpuShares: 0,
      allocatedAt: Date.now(),
      expiresAt: Date.now() + 600000,
    };

    this.allocations.push(allocation);
    this.usedTokens += tokens;
    return allocation;
  }

  release(allocationId: string): void {
    this.allocations = this.allocations.filter((a) => a.taskId !== allocationId);
  }

  getBudget(): ResourceBudget {
    return {
      totalTokens: this.config.totalTokens,
      usedTokens: this.usedTokens,
      totalCostUsd: this.config.totalCostUsd,
      usedCostUsd: this.usedCostUsd,
      concurrentAgents: new Set(this.allocations.map((a) => a.agentId)).size,
      maxConcurrentAgents: this.config.maxConcurrentAgents,
      tokensPerMinute: this.config.tokensPerMinute,
      tokensUsedThisMinute: this.tokensUsedThisMinute,
      resetAt: this.minuteStart + 60000,
    };
  }

  canAllocate(tokens: number): boolean {
    if (this.usedTokens + tokens > this.config.totalTokens) return false;
    if (this.usedCostUsd >= this.config.totalCostUsd) return false;

    const now = Date.now();
    if (now - this.minuteStart > 60000) {
      this.tokensUsedThisMinute = 0;
      this.minuteStart = now;
    }
    if (this.tokensUsedThisMinute + tokens > this.config.tokensPerMinute) return false;

    return true;
  }

  getAllocations(): ReadonlyArray<ResourceAllocation> {
    return this.allocations;
  }

  getAllocationsByAgent(agentId: string): ReadonlyArray<ResourceAllocation> {
    return this.allocations.filter((a) => a.agentId === agentId);
  }

  cleanup(): number {
    const now = Date.now();
    const before = this.allocations.length;
    this.allocations = this.allocations.filter((a) => a.expiresAt > now);
    return before - this.allocations.length;
  }

  updateUsage(tokens: number, cost: number): void {
    this.usedTokens += tokens;
    this.usedCostUsd += cost;
    this.tokensUsedThisMinute += tokens;
  }
}
