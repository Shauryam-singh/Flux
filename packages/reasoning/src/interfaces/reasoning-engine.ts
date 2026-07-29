import type { Observation } from "@ai-agent/attention";
import type {
  ReasoningCycleResult,
  ReasoningTrigger,
  Thought,
} from "@ai-agent/cognitive-types";
import type { Goal } from "@ai-agent/goals";
import type { MemorySnapshot } from "@ai-agent/working-memory";
import type { WorldState } from "@ai-agent/world-model";

export type ReasoningState =
  | "idle"
  | "observing"
  | "thinking"
  | "deciding"
  | "sleeping";

export interface ReasoningContext {
  readonly worldState: WorldState;
  readonly memory: MemorySnapshot;
  readonly goals: ReadonlyArray<Goal>;
  readonly recentObservations: ReadonlyArray<Observation>;
  readonly recentThoughts: ReadonlyArray<Thought>;
}

export interface ReasoningEngine {
  cycle(context: ReasoningContext): Promise<ReasoningCycleResult>;
  shouldReason(
    worldState: WorldState,
    memory: MemorySnapshot,
    goals: ReadonlyArray<Goal>,
  ): boolean;
  getState(): ReasoningState;
  onThought(handler: (thought: Thought) => void): () => void;
}
