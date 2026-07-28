import { describe, it, expect, beforeEach } from "vitest";
import { DefaultAdaptivePlanner } from "../impl/default-adaptive-planner.js";

describe("DefaultAdaptivePlanner", () => {
  let planner: DefaultAdaptivePlanner;

  beforeEach(() => {
    planner = new DefaultAdaptivePlanner();
  });

  it("should record duration and return estimate", () => {
    planner.recordDuration("build", 1000, 1200);
    const est = planner.getEstimate("build");
    expect(est).not.toBeNull();
    expect(est!.taskType).toBe("build");
    expect(est!.sampleSize).toBe(1);
    expect(est!.p50Ms).toBe(1200);
    expect(est!.p90Ms).toBe(1200);
  });

  it("should return null for unknown task type", () => {
    expect(planner.getEstimate("unknown")).toBeNull();
  });

  it("should calculate p50 and p90 from multiple samples", () => {
    for (let i = 1; i <= 10; i++) {
      planner.recordDuration("build", 1000, i * 100);
    }
    const est = planner.getEstimate("build")!;
    expect(est.sampleSize).toBe(10);
    expect(est.p50Ms).toBe(500);
    expect(est.p90Ms).toBe(900);
  });

  it("should return all estimates", () => {
    planner.recordDuration("build", 1000, 1200);
    planner.recordDuration("test", 500, 600);
    expect(planner.getAllEstimates()).toHaveLength(2);
  });

  it("should save template with prefixed id", () => {
    const steps = [{ name: "step1", taskType: "build", estimatedMs: 1000, dependencies: [], requiredCapabilities: [] }];
    const t = planner.saveTemplate("T1", "desc", "sequential", ["build"], steps);
    expect(t.id).toMatch(/^pt_/);
    expect(t.name).toBe("T1");
    expect(t.pattern).toBe("sequential");
    expect(t.taskTypes).toEqual(["build"]);
    expect(t.steps).toEqual(steps);
    expect(t.averageDuration).toBe(1000);
  });

  it("should retrieve template by id", () => {
    const t = planner.saveTemplate("T1", "desc", "sequential", [], []);
    expect(planner.getTemplate(t.id)).toEqual(t);
  });

  it("should return null for nonexistent template", () => {
    expect(planner.getTemplate("nonexistent")).toBeNull();
  });

  it("should get all templates", () => {
    planner.saveTemplate("T1", "d", "p", [], []);
    planner.saveTemplate("T2", "d", "p", [], []);
    expect(planner.getTemplates()).toHaveLength(2);
  });

  it("should filter templates by pattern", () => {
    planner.saveTemplate("T1", "d", "sequential", [], []);
    planner.saveTemplate("T2", "d", "parallel", [], []);
    planner.saveTemplate("T3", "d", "sequential", [], []);
    expect(planner.getTemplatesByPattern("sequential")).toHaveLength(2);
    expect(planner.getTemplatesByPattern("parallel")).toHaveLength(1);
  });

  it("should delete template", () => {
    const t = planner.saveTemplate("T1", "d", "p", [], []);
    planner.deleteTemplate(t.id);
    expect(planner.getTemplate(t.id)).toBeNull();
  });

  it("should not throw when deleting nonexistent template", () => {
    planner.deleteTemplate("nonexistent");
  });

  it("should predict blockers for high variance tasks", () => {
    planner.recordDuration("build", 1000, 100);
    planner.recordDuration("build", 1000, 500);
    planner.recordDuration("build", 1000, 2000);
    const blockers = planner.predictBlockers(["build"]);
    expect(blockers.length).toBeGreaterThanOrEqual(1);
    expect(blockers[0]).toContain("build");
  });

  it("should predict no blockers for low variance tasks", () => {
    planner.recordDuration("build", 1000, 1000);
    planner.recordDuration("build", 1000, 1050);
    planner.recordDuration("build", 1000, 1100);
    const blockers = planner.predictBlockers(["build"]);
    expect(blockers).toHaveLength(0);
  });

  it("should predict no blockers for unknown task types", () => {
    const blockers = planner.predictBlockers(["unknown"]);
    expect(blockers).toHaveLength(0);
  });
});
