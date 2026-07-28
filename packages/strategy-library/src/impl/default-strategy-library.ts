import type { Strategy, StrategyType, StrategyParameters, StrategyOutcome } from "@ai-agent/evo-types";
import type { StrategyLibrary } from "../interfaces/strategy-library.js";

let strategyCounter = 0;

export class DefaultStrategyLibrary implements StrategyLibrary {
  private readonly strategies = new Map<string, Strategy>();

  create(name: string, type: StrategyType, description: string, parameters: StrategyParameters, tags?: ReadonlyArray<string>): Strategy {
    const strategy: Strategy = {
      id: `str_${++strategyCounter}`,
      name,
      type,
      description,
      parameters,
      tags: tags ?? [],
      usageCount: 0,
      successRate: 0,
      lastUsed: 0,
      createdAt: Date.now(),
    };
    this.strategies.set(strategy.id, strategy);
    return strategy;
  }

  get(strategyId: string): Strategy | null {
    return this.strategies.get(strategyId) ?? null;
  }

  getAll(): ReadonlyArray<Strategy> {
    return [...this.strategies.values()];
  }

  getByType(type: StrategyType): ReadonlyArray<Strategy> {
    return [...this.strategies.values()].filter((s) => s.type === type);
  }

  getBest(): Strategy | null {
    let best: Strategy | null = null;
    for (const strategy of this.strategies.values()) {
      if (strategy.usageCount < 1) continue;
      if (best === null || strategy.successRate >= best.successRate) {
        best = strategy;
      }
    }
    return best;
  }

  recordOutcome(outcome: StrategyOutcome): void {
    const strategy = this.strategies.get(outcome.strategyId);
    if (strategy === null || strategy === undefined) return;
    const prevTotal = strategy.successRate * strategy.usageCount;
    const newUsageCount = strategy.usageCount + 1;
    const newSuccessRate = (prevTotal + (outcome.success ? 1 : 0)) / newUsageCount;
    const updated: Strategy = {
      ...strategy,
      usageCount: newUsageCount,
      successRate: newSuccessRate,
      lastUsed: outcome.timestamp,
    };
    this.strategies.set(outcome.strategyId, updated);
  }

  updateParameters(strategyId: string, parameters: Partial<StrategyParameters>): void {
    const strategy = this.strategies.get(strategyId);
    if (strategy === null || strategy === undefined) return;
    const updated: Strategy = {
      ...strategy,
      parameters: { ...strategy.parameters, ...parameters },
    };
    this.strategies.set(strategyId, updated);
  }

  getSuccessRate(strategyId: string): number {
    const strategy = this.strategies.get(strategyId);
    return strategy?.successRate ?? 0;
  }

  remove(strategyId: string): void {
    this.strategies.delete(strategyId);
  }
}
