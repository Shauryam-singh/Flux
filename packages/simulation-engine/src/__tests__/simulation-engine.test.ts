import { describe, it, expect, beforeEach } from "vitest";
import { DefaultSimulationEngine } from "../impl/default-simulation-engine.js";
import type { SimulationEngine } from "../interfaces/simulation-engine.js";

describe("DefaultSimulationEngine", () => {
  let engine: SimulationEngine;

  beforeEach(() => {
    engine = new DefaultSimulationEngine();
  });

  it("should create a scenario", () => {
    const result = engine.createScenario("Test Scenario", "desc", { risk: 0.5 });
    expect(result.id).toMatch(/^ss_/);
    expect(result.name).toBe("Test Scenario");
  });

  it("should get scenario by id", () => {
    const scenario = engine.createScenario("Test", "desc", {});
    expect(engine.getScenario(scenario.id)).toEqual(scenario);
  });

  it("should return null for non-existent scenario", () => {
    expect(engine.getScenario("non-existent")).toBeNull();
  });

  it("should get all scenarios", () => {
    engine.createScenario("A", "desc", {});
    engine.createScenario("B", "desc", {});
    expect(engine.getAllScenarios()).toHaveLength(2);
  });

  it("should run a scenario", () => {
    const scenario = engine.createScenario("Test", "desc", {});
    const result = engine.run(scenario.id);
    expect(result.scenarioId).toBe(scenario.id);
  });

  it("should throw for non-existent scenario run", () => {
    expect(() => engine.run("non-existent")).toThrow();
  });

  it("should store simulation results", () => {
    const scenario = engine.createScenario("Test", "desc", {});
    engine.run(scenario.id);
    engine.run(scenario.id);
    expect(engine.getResults(scenario.id)).toHaveLength(2);
  });

  it("should remove scenario and results", () => {
    const scenario = engine.createScenario("Test", "desc", {});
    engine.run(scenario.id);
    engine.removeScenario(scenario.id);
    expect(engine.getScenario(scenario.id)).toBeNull();
    expect(engine.getResults(scenario.id)).toHaveLength(0);
  });
});
