import { describe, it, expect, beforeEach } from "vitest";
import { DefaultExperienceDatabase } from "../impl/default-experience-db.js";

describe("DefaultExperienceDatabase", () => {
  let db: DefaultExperienceDatabase;

  beforeEach(() => {
    db = new DefaultExperienceDatabase();
  });

  it("should record experience with prefixed id and timestamp", () => {
    const exp = db.record({ situation: "build failed", decision: "retry", outcome: "success", confidence: 0.9, actualResult: {}, userFeedback: null, successScore: 0.9, recommendation: "retry", strategyUsed: null, duration: 100, cost: 0.1, tags: ["build"], context: {} });
    expect(exp.id).toMatch(/^exp_/);
    expect(exp.situation).toBe("build failed");
    expect(exp.decision).toBe("retry");
    expect(exp.outcome).toBe("success");
    expect(exp.successScore).toBe(0.9);
    expect(exp.timestamp).toBeGreaterThan(0);
  });

  it("should retrieve experience by id", () => {
    const exp = db.record({ situation: "s", decision: "a", outcome: "failure", confidence: 0.5, actualResult: {}, userFeedback: null, successScore: 0.1, recommendation: "r", strategyUsed: "str_1", duration: 100, cost: 0.1, tags: [], context: {} });
    expect(db.get(exp.id)).toEqual(exp);
  });

  it("should return null for nonexistent experience", () => {
    expect(db.get("nonexistent")).toBeNull();
  });

  it("should return all experiences", () => {
    db.record({ situation: "s1", decision: "a1", outcome: "success", confidence: 0.8, actualResult: {}, userFeedback: null, successScore: 0.8, recommendation: "r", strategyUsed: null, duration: 100, cost: 0.1, tags: [], context: {} });
    db.record({ situation: "s2", decision: "a2", outcome: "failure", confidence: 0.3, actualResult: {}, userFeedback: null, successScore: 0.2, recommendation: "r", strategyUsed: null, duration: 100, cost: 0.1, tags: [], context: {} });
    expect(db.getAll()).toHaveLength(2);
  });

  it("should query by situation", () => {
    db.record({ situation: "build failed", decision: "a", outcome: "success", confidence: 0.8, actualResult: {}, userFeedback: null, successScore: 0.8, recommendation: "r", strategyUsed: null, duration: 100, cost: 0.1, tags: [], context: {} });
    db.record({ situation: "test passed", decision: "a", outcome: "success", confidence: 0.9, actualResult: {}, userFeedback: null, successScore: 0.9, recommendation: "r", strategyUsed: null, duration: 100, cost: 0.1, tags: [], context: {} });
    const results = db.query({ situation: "build" });
    expect(results).toHaveLength(1);
    expect(results[0]!.situation).toBe("build failed");
  });

  it("should query by outcome", () => {
    db.record({ situation: "s", decision: "a", outcome: "success", confidence: 0.8, actualResult: {}, userFeedback: null, successScore: 0.8, recommendation: "r", strategyUsed: null, duration: 100, cost: 0.1, tags: [], context: {} });
    db.record({ situation: "s", decision: "a", outcome: "failure", confidence: 0.3, actualResult: {}, userFeedback: null, successScore: 0.2, recommendation: "r", strategyUsed: null, duration: 100, cost: 0.1, tags: [], context: {} });
    expect(db.query({ outcome: "success" })).toHaveLength(1);
    expect(db.query({ outcome: "failure" })).toHaveLength(1);
  });

  it("should query by minSuccessScore", () => {
    db.record({ situation: "s", decision: "a", outcome: "success", confidence: 0.8, actualResult: {}, userFeedback: null, successScore: 0.5, recommendation: "r", strategyUsed: null, duration: 100, cost: 0.1, tags: [], context: {} });
    db.record({ situation: "s", decision: "a", outcome: "success", confidence: 0.9, actualResult: {}, userFeedback: null, successScore: 0.9, recommendation: "r", strategyUsed: null, duration: 100, cost: 0.1, tags: [], context: {} });
    expect(db.query({ minSuccessScore: 0.7 })).toHaveLength(1);
  });

  it("should query by tags (all must match)", () => {
    db.record({ situation: "s", decision: "a", outcome: "success", confidence: 0.8, actualResult: {}, userFeedback: null, successScore: 0.8, recommendation: "r", strategyUsed: null, duration: 100, cost: 0.1, tags: ["build", "ci"], context: {} });
    db.record({ situation: "s", decision: "a", outcome: "success", confidence: 0.8, actualResult: {}, userFeedback: null, successScore: 0.8, recommendation: "r", strategyUsed: null, duration: 100, cost: 0.1, tags: ["build"], context: {} });
    expect(db.query({ tags: ["build"] })).toHaveLength(2);
    expect(db.query({ tags: ["build", "ci"] })).toHaveLength(1);
  });

  it("should query with limit", () => {
    db.record({ situation: "s", decision: "a", outcome: "success", confidence: 0.8, actualResult: {}, userFeedback: null, successScore: 0.8, recommendation: "r", strategyUsed: null, duration: 100, cost: 0.1, tags: [], context: {} });
    db.record({ situation: "s", decision: "a", outcome: "success", confidence: 0.8, actualResult: {}, userFeedback: null, successScore: 0.8, recommendation: "r", strategyUsed: null, duration: 100, cost: 0.1, tags: [], context: {} });
    db.record({ situation: "s", decision: "a", outcome: "success", confidence: 0.8, actualResult: {}, userFeedback: null, successScore: 0.8, recommendation: "r", strategyUsed: null, duration: 100, cost: 0.1, tags: [], context: {} });
    expect(db.query({ limit: 2 })).toHaveLength(2);
  });

  it("should return successful experiences", () => {
    db.record({ situation: "s", decision: "a", outcome: "success", confidence: 0.8, actualResult: {}, userFeedback: null, successScore: 0.8, recommendation: "r", strategyUsed: null, duration: 100, cost: 0.1, tags: [], context: {} });
    db.record({ situation: "s", decision: "a", outcome: "failure", confidence: 0.3, actualResult: {}, userFeedback: null, successScore: 0.2, recommendation: "r", strategyUsed: null, duration: 100, cost: 0.1, tags: [], context: {} });
    expect(db.getSuccessful()).toHaveLength(1);
  });

  it("should return failed experiences", () => {
    db.record({ situation: "s", decision: "a", outcome: "success", confidence: 0.8, actualResult: {}, userFeedback: null, successScore: 0.8, recommendation: "r", strategyUsed: null, duration: 100, cost: 0.1, tags: [], context: {} });
    db.record({ situation: "s", decision: "a", outcome: "failure", confidence: 0.3, actualResult: {}, userFeedback: null, successScore: 0.2, recommendation: "r", strategyUsed: null, duration: 100, cost: 0.1, tags: [], context: {} });
    expect(db.getFailed()).toHaveLength(1);
  });

  it("should get by strategy", () => {
    db.record({ situation: "s", decision: "a", outcome: "success", confidence: 0.8, actualResult: {}, userFeedback: null, successScore: 0.8, recommendation: "r", strategyUsed: "str_1", duration: 100, cost: 0.1, tags: [], context: {} });
    db.record({ situation: "s", decision: "a", outcome: "success", confidence: 0.8, actualResult: {}, userFeedback: null, successScore: 0.8, recommendation: "r", strategyUsed: "str_2", duration: 100, cost: 0.1, tags: [], context: {} });
    expect(db.getByStrategy("str_1")).toHaveLength(1);
  });

  it("should get recent sorted by timestamp desc", () => {
    db.record({ situation: "s1", decision: "a", outcome: "success", confidence: 0.8, actualResult: {}, userFeedback: null, successScore: 0.8, recommendation: "r", strategyUsed: null, duration: 100, cost: 0.1, tags: [], context: {} });
    db.record({ situation: "s2", decision: "a", outcome: "success", confidence: 0.8, actualResult: {}, userFeedback: null, successScore: 0.8, recommendation: "r", strategyUsed: null, duration: 100, cost: 0.1, tags: [], context: {} });
    db.record({ situation: "s3", decision: "a", outcome: "success", confidence: 0.8, actualResult: {}, userFeedback: null, successScore: 0.8, recommendation: "r", strategyUsed: null, duration: 100, cost: 0.1, tags: [], context: {} });
    const recent = db.getRecent(2);
    expect(recent).toHaveLength(2);
    expect(recent[0]!.situation).toBe("s3");
  });

  it("should compute average success score", () => {
    db.record({ situation: "s", decision: "a", outcome: "success", confidence: 0.8, actualResult: {}, userFeedback: null, successScore: 0.6, recommendation: "r", strategyUsed: null, duration: 100, cost: 0.1, tags: [], context: {} });
    db.record({ situation: "s", decision: "a", outcome: "success", confidence: 0.8, actualResult: {}, userFeedback: null, successScore: 0.8, recommendation: "r", strategyUsed: null, duration: 100, cost: 0.1, tags: [], context: {} });
    expect(db.getAverageSuccessScore()).toBeCloseTo(0.7);
  });

  it("should return 0 average when empty", () => {
    expect(db.getAverageSuccessScore()).toBe(0);
  });

  it("should count experiences", () => {
    expect(db.count()).toBe(0);
    db.record({ situation: "s", decision: "a", outcome: "success", confidence: 0.8, actualResult: {}, userFeedback: null, successScore: 0.8, recommendation: "r", strategyUsed: null, duration: 100, cost: 0.1, tags: [], context: {} });
    expect(db.count()).toBe(1);
  });

  it("should delete experience", () => {
    const exp = db.record({ situation: "s", decision: "a", outcome: "success", confidence: 0.8, actualResult: {}, userFeedback: null, successScore: 0.8, recommendation: "r", strategyUsed: null, duration: 100, cost: 0.1, tags: [], context: {} });
    db.delete(exp.id);
    expect(db.get(exp.id)).toBeNull();
    expect(db.count()).toBe(0);
  });

  it("should not throw when deleting nonexistent experience", () => {
    db.delete("nonexistent");
  });
});
