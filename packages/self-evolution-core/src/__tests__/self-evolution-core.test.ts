import { describe, it, expect, vi, beforeEach } from "vitest";
import { DefaultSelfEvolutionCore } from "../impl/default-self-evolution-core.js";

describe("DefaultSelfEvolutionCore", () => {
  let core: DefaultSelfEvolutionCore;

  beforeEach(() => {
    core = new DefaultSelfEvolutionCore();
  });

  it("should have default config", () => {
    const config = core.getConfig();
    expect(config.enabled).toBe(true);
    expect(config.maxExperiences).toBe(10000);
    expect(config.maxKnowledge).toBe(5000);
    expect(config.maxSkills).toBe(500);
    expect(config.decayIntervalMs).toBe(86400000);
    expect(config.consolidationIntervalMs).toBe(604800000);
    expect(config.healthCheckIntervalMs).toBe(3600000);
    expect(config.evaluationIntervalMs).toBe(86400000);
    expect(config.autoApplyStrategies).toBe(false);
    expect(config.maxStrategyAdaptations).toBe(10);
    expect(config.confidenceCalibrationEnabled).toBe(true);
    expect(config.researchModeEnabled).toBe(true);
    expect(config.simulationEnabled).toBe(true);
  });

  it("should accept config overrides", () => {
    const custom = new DefaultSelfEvolutionCore({ enabled: false, maxExperiences: 500 });
    const config = custom.getConfig();
    expect(config.enabled).toBe(false);
    expect(config.maxExperiences).toBe(500);
    expect(config.maxKnowledge).toBe(5000);
  });

  it("should configure dynamically", () => {
    core.configure({ enabled: false, maxSkills: 100 });
    const config = core.getConfig();
    expect(config.enabled).toBe(false);
    expect(config.maxSkills).toBe(100);
  });

  it("should return status with counts", () => {
    const status = core.getStatus();
    expect(status.totalExperiences).toBe(0);
    expect(status.totalKnowledge).toBe(0);
    expect(status.totalSkills).toBe(0);
    expect(status.totalWorkflows).toBe(0);
    expect(status.totalStrategies).toBe(0);
    expect(status.healthOverall).toBe("healthy");
  });

  it("should return health status", () => {
    const health = core.getHealth();
    expect(health.overall).toBe("healthy");
    expect(health.metrics.length).toBeGreaterThanOrEqual(0);
    expect(health.timestamp).toBeGreaterThan(0);
  });

  it("should run health check and update timestamp", () => {
    const before = Date.now();
    const health = core.runHealthCheck();
    expect(health.overall).toBe("healthy");
    expect(health.timestamp).toBeGreaterThanOrEqual(before);
  });

  it("should consolidate and return count", () => {
    const count = core.consolidate();
    expect(count).toBe(0);
  });

  it("should get recent evaluations", () => {
    const evaluations = core.getRecentEvaluations();
    expect(evaluations).toHaveLength(0);
  });

  it("should tick and run health check if interval elapsed", () => {
    const spy = vi.spyOn(core, "runHealthCheck");
    core.tick();
    expect(spy).toHaveBeenCalled();
  });

  it("should tick and consolidate if interval elapsed", () => {
    const spy = vi.spyOn(core, "consolidate");
    core.tick();
    expect(spy).toHaveBeenCalled();
  });
});
