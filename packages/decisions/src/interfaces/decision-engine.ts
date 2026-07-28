import type { Action, Decision } from "@ai-agent/cognitive-types";
import type { WorldState } from "@ai-agent/world-model";
import type { MemorySnapshot } from "@ai-agent/working-memory";
import type { Goal } from "@ai-agent/goals";
import type { Thought } from "@ai-agent/cognitive-types";

export interface DecisionContext {
  readonly worldState: WorldState;
  readonly memory: MemorySnapshot;
  readonly goals: ReadonlyArray<Goal>;
  readonly thoughts: ReadonlyArray<Thought>;
  readonly recentDecisions: ReadonlyArray<Decision>;
  readonly userActive: boolean;
}

export interface DecisionEngine {
  decide(context: DecisionContext): Promise<Decision>;
  getHistory(): ReadonlyArray<Decision>;
  isDuplicate(action: Action, recentDecisions: ReadonlyArray<Decision>): boolean;
}
