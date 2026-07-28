import { describe, it, expect, beforeEach } from "vitest";
import { DefaultResourceManager } from "../impl/default-resource-manager.js";

describe("DefaultResourceManager", () => {
  let manager: DefaultResourceManager;

  beforeEach(() => {
    manager = new DefaultResourceManager({ totalTokens: 10000, totalCostUsd: 1.0, maxConcurrentAgents: 3, tokensPerMinute: 100000 });
  });

  it("should allocate resources", () => {
    const alloc = manager.allocate("agent1", "t1", 1000);
    expect(alloc).not.toBeNull();
    expect(alloc!.agentId).toBe("agent1");
  });

  it("should reject when over budget", () => {
    manager.allocate("a1", "t1", 9000);
    const alloc = manager.allocate("a2", "t2", 2000);
    expect(alloc).toBeNull();
  });

  it("should release resources", () => {
    manager.allocate("a1", "t1", 1000);
    manager.release("t1");
    expect(manager.getAllocations().length).toBe(0);
  });

  it("should check if can allocate", () => {
    expect(manager.canAllocate(5000)).toBe(true);
    expect(manager.canAllocate(20000)).toBe(false);
  });

  it("should provide budget", () => {
    const budget = manager.getBudget();
    expect(budget.totalTokens).toBe(10000);
    expect(budget.usedTokens).toBe(0);
  });

  it("should cleanup expired allocations", () => {
    manager.allocate("a1", "t1", 1000);
    const cleaned = manager.cleanup();
    expect(cleaned).toBeGreaterThanOrEqual(0);
  });
});
