import { describe, it, expect, beforeEach } from "vitest";
import { DefaultStrategyLibrary } from "../impl/default-strategy-library.js";

describe("DefaultStrategyLibrary", () => {
  let lib: DefaultStrategyLibrary;

  const defaultParams = { riskTolerance: 0.5, verbosity: 0.5, autonomyLevel: 0.5, verificationLevel: 0.5, batchSize: 1, timeoutMultiplier: 1, retryAggressiveness: 0.5, costSensitivity: 0.5 };

  beforeEach(() => {
    lib = new DefaultStrategyLibrary();
  });

  it("should create strategy with prefixed id", () => {
    const s = lib.create("Test", "coding", "desc", defaultParams, ["tag1"]);
    expect(s.id).toMatch(/^str_/);
    expect(s.name).toBe("Test");
    expect(s.type).toBe("coding");
    expect(s.description).toBe("desc");
    expect(s.parameters).toEqual(defaultParams);
    expect(s.tags).toEqual(["tag1"]);
    expect(s.usageCount).toBe(0);
    expect(s.successRate).toBe(0);
    expect(s.lastUsed).toBe(0);
  });

  it("should default tags to empty array", () => {
    const s = lib.create("Test", "coding", "desc", defaultParams);
    expect(s.tags).toEqual([]);
  });

  it("should retrieve strategy by id", () => {
    const s = lib.create("Test", "coding", "desc", defaultParams);
    expect(lib.get(s.id)).toEqual(s);
  });

  it("should return null for nonexistent strategy", () => {
    expect(lib.get("nonexistent")).toBeNull();
  });

  it("should get all strategies", () => {
    lib.create("S1", "coding", "d", defaultParams);
    lib.create("S2", "debugging", "d", defaultParams);
    expect(lib.getAll()).toHaveLength(2);
  });

  it("should filter by type", () => {
    lib.create("S1", "coding", "d", defaultParams);
    lib.create("S2", "debugging", "d", defaultParams);
    lib.create("S3", "coding", "d", defaultParams);
    expect(lib.getByType("coding")).toHaveLength(2);
    expect(lib.getByType("research")).toHaveLength(0);
  });

  it("should getBest returns null when no strategies have usage", () => {
    lib.create("S1", "coding", "d", defaultParams);
    expect(lib.getBest()).toBeNull();
  });

  it("should getBest returns strategy with highest success rate", () => {
    const s1 = lib.create("S1", "coding", "d", defaultParams);
    const s2 = lib.create("S2", "debugging", "d", defaultParams);
    lib.recordOutcome({ strategyId: s1.id, taskId: "t1", success: true, duration: 100, cost: 0.1, userSatisfaction: 0.8, timestamp: Date.now() });
    lib.recordOutcome({ strategyId: s2.id, taskId: "t2", success: true, duration: 100, cost: 0.1, userSatisfaction: 0.9, timestamp: Date.now() });
    expect(lib.getBest()!.id).toBe(s2.id);
  });

  it("should recordOutcome updates usageCount and successRate", () => {
    const s = lib.create("S1", "coding", "d", defaultParams);
    lib.recordOutcome({ strategyId: s.id, taskId: "t1", success: true, duration: 100, cost: 0.1, userSatisfaction: 0.8, timestamp: Date.now() });
    const updated = lib.get(s.id)!;
    expect(updated.usageCount).toBe(1);
    expect(updated.successRate).toBe(1);
  });

  it("should recordOutcome computes running average", () => {
    const s = lib.create("S1", "coding", "d", defaultParams);
    lib.recordOutcome({ strategyId: s.id, taskId: "t1", success: true, duration: 100, cost: 0.1, userSatisfaction: 0.8, timestamp: Date.now() });
    lib.recordOutcome({ strategyId: s.id, taskId: "t2", success: false, duration: 100, cost: 0.1, userSatisfaction: 0.5, timestamp: Date.now() });
    const updated = lib.get(s.id)!;
    expect(updated.usageCount).toBe(2);
    expect(updated.successRate).toBe(0.5);
  });

  it("should updateParameters merges partial params", () => {
    const s = lib.create("S1", "coding", "d", defaultParams);
    lib.updateParameters(s.id, { riskTolerance: 0.9 });
    const updated = lib.get(s.id)!;
    expect(updated.parameters.riskTolerance).toBe(0.9);
    expect(updated.parameters.verbosity).toBe(0.5);
  });

  it("should getSuccessRate returns 0 for nonexistent strategy", () => {
    expect(lib.getSuccessRate("nonexistent")).toBe(0);
  });

  it("should remove strategy", () => {
    const s = lib.create("S1", "coding", "d", defaultParams);
    lib.remove(s.id);
    expect(lib.get(s.id)).toBeNull();
  });

  it("should not record outcome for nonexistent strategy", () => {
    lib.recordOutcome({ strategyId: "nonexistent", taskId: "t1", success: true, duration: 100, cost: 0.1, userSatisfaction: 1, timestamp: Date.now() });
    expect(lib.getAll()).toHaveLength(0);
  });

  it("should not update parameters for nonexistent strategy", () => {
    lib.updateParameters("nonexistent", { riskTolerance: 0.9 });
  });
});
