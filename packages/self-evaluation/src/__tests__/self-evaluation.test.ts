import { describe, it, expect, beforeEach } from "vitest";
import type { SelfEvaluation } from "../interfaces/self-evaluation.js";

describe("DefaultSelfEvaluation", () => {
  let evaluation: SelfEvaluation;

  beforeEach(async () => {
    const { DefaultSelfEvaluation } = await import("../impl/default-self-evaluation.js");
    evaluation = new DefaultSelfEvaluation();
  });

  it("creates evaluation report with correct structure", () => {
    const report = evaluation.evaluate("goal-1", [
      { dimension: "planning", score: 0.9, evidence: ["test passed"] },
      { dimension: "delegation", score: 0.8, evidence: ["mostly done"] },
    ]);
    expect(report.id).toMatch(/^se_\d+$/);
    expect(report.goalId).toBe("goal-1");
    expect(report.overallScore).toBeCloseTo(0.85, 5);
    expect(report.dimensions).toHaveLength(2);
  });

  it("retrieves report by id", () => {
    const report = evaluation.evaluate("goal-1", [
      { dimension: "planning", score: 0.7, evidence: [] },
    ]);
    expect(evaluation.getReport(report.id)).toEqual(report);
    expect(evaluation.getReport("nonexistent")).toBeNull();
  });

  it("filters reports by goal", () => {
    evaluation.evaluate("goal-1", [{ dimension: "planning", score: 0.8, evidence: [] }]);
    evaluation.evaluate("goal-2", [{ dimension: "planning", score: 0.6, evidence: [] }]);
    expect(evaluation.getReportsByGoal("goal-1")).toHaveLength(1);
  });

  it("returns recent reports", () => {
    for (let i = 0; i < 10; i++) {
      evaluation.evaluate("goal-1", [{ dimension: "planning", score: 0.5, evidence: [] }]);
    }
    expect(evaluation.getRecentReports(3)).toHaveLength(3);
  });

  it("calculates average score for dimension", () => {
    evaluation.evaluate("g1", [{ dimension: "planning", score: 0.8, evidence: [] }]);
    evaluation.evaluate("g2", [{ dimension: "planning", score: 0.6, evidence: [] }]);
    expect(evaluation.getAverageScore("planning")).toBeCloseTo(0.7, 5);
  });

  it("calculates overall average score", () => {
    evaluation.evaluate("g1", [{ dimension: "planning", score: 0.6, evidence: [] }]);
    evaluation.evaluate("g2", [{ dimension: "planning", score: 0.8, evidence: [] }]);
    expect(evaluation.getOverallAverageScore()).toBeCloseTo(0.7, 5);
  });

  it("detects trend", () => {
    for (let i = 0; i < 5; i++) {
      evaluation.evaluate("g", [{ dimension: "planning", score: 0.3, evidence: [] }]);
    }
    for (let i = 0; i < 5; i++) {
      evaluation.evaluate("g", [{ dimension: "planning", score: 0.9, evidence: [] }]);
    }
    expect(evaluation.getTrend("planning")).toBe("improving");
  });
});
