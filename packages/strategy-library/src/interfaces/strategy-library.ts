import type { Strategy, StrategyType, StrategyParameters, StrategyOutcome } from "@ai-agent/evo-types";

export interface StrategyLibrary {
  create(name: string, type: StrategyType, description: string, parameters: StrategyParameters, tags?: ReadonlyArray<string>): Strategy;
  get(strategyId: string): Strategy | null;
  getAll(): ReadonlyArray<Strategy>;
  getByType(type: StrategyType): ReadonlyArray<Strategy>;
  getBest(): Strategy | null;
  recordOutcome(outcome: StrategyOutcome): void;
  updateParameters(strategyId: string, parameters: Partial<StrategyParameters>): void;
  getSuccessRate(strategyId: string): number;
  remove(strategyId: string): void;
}
