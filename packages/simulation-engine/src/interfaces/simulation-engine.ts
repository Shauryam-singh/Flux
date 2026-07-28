export interface SimulationScenario {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
  readonly createdAt: number;
}

export interface SimulationResult {
  readonly id: string;
  readonly scenarioId: string;
  readonly outcome: Record<string, unknown>;
  readonly metrics: Record<string, number>;
  readonly timestamp: number;
}

export interface SimulationEngine {
  createScenario(name: string, description: string, parameters: Record<string, unknown>): SimulationScenario;
  getScenario(scenarioId: string): SimulationScenario | null;
  getAllScenarios(): ReadonlyArray<SimulationScenario>;
  run(scenarioId: string): SimulationResult;
  getResults(scenarioId: string): ReadonlyArray<SimulationResult>;
  removeScenario(scenarioId: string): void;
}
