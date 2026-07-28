import type { SimulationScenario, SimulationResult, SimulationEngine } from "../interfaces/simulation-engine.js";

let scenarioCounter = 0;

export class DefaultSimulationEngine implements SimulationEngine {
  private scenarios: Map<string, SimulationScenario> = new Map();
  private results: Map<string, SimulationResult[]> = new Map();

  createScenario(name: string, description: string, parameters: Record<string, unknown>): SimulationScenario {
    const scenario: SimulationScenario = {
      id: `ss_${++scenarioCounter}`,
      name,
      description,
      parameters,
      createdAt: Date.now(),
    };
    this.scenarios.set(scenario.id, scenario);
    this.results.set(scenario.id, []);
    return scenario;
  }

  getScenario(scenarioId: string): SimulationScenario | null {
    return this.scenarios.get(scenarioId) ?? null;
  }

  getAllScenarios(): ReadonlyArray<SimulationScenario> {
    return Array.from(this.scenarios.values());
  }

  run(scenarioId: string): SimulationResult {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) throw new Error(`Scenario not found: ${scenarioId}`);
    const result: SimulationResult = {
      id: `sr_${++scenarioCounter}`,
      scenarioId,
      outcome: { completed: true },
      metrics: {},
      timestamp: Date.now(),
    };
    const results = this.results.get(scenarioId) ?? [];
    results.push(result);
    this.results.set(scenarioId, results);
    return result;
  }

  getResults(scenarioId: string): ReadonlyArray<SimulationResult> {
    return this.results.get(scenarioId) ?? [];
  }

  removeScenario(scenarioId: string): void {
    this.scenarios.delete(scenarioId);
    this.results.delete(scenarioId);
  }
}
