import type { WorldState } from "@ai-agent/world-model";
import type { MemorySnapshot } from "@ai-agent/working-memory";
import type { Goal } from "@ai-agent/goals";
import type { Thought, ReasoningCycleResult, ReasoningTrigger } from "@ai-agent/cognitive-types";
import type { Observation } from "@ai-agent/attention";

export type ReasoningState = "idle" | "observing" | "thinking" | "deciding" | "sleeping";

export interface ReasoningContext {
  readonly worldState: WorldState;
  readonly memory: MemorySnapshot;
  readonly goals: ReadonlyArray<Goal>;
  readonly recentObservations: ReadonlyArray<Observation>;
  readonly recentThoughts: ReadonlyArray<Thought>;
}

export interface ReasoningEngine {
  cycle(context: ReasoningContext): Promise<ReasoningCycleResult>;
  shouldReason(worldState: WorldState, memory: MemorySnapshot, goals: ReadonlyArray<Goal>): boolean;
  getState(): ReasoningState;
  onThought(handler: (thought: Thought) => void): () => void;
}
