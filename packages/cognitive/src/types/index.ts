import type { WorldModel } from "@ai-agent/world-model";
import type { WorkingMemory } from "@ai-agent/working-memory";
import type { GoalManager } from "@ai-agent/goals";
import type { ReasoningEngine, ReasoningState } from "@ai-agent/reasoning";
import type { DecisionEngine, InterruptController } from "@ai-agent/decisions";
import type { Decision, Thought, ReasoningCycleResult } from "@ai-agent/cognitive-types";
import type { Observation } from "@ai-agent/attention";
import type { WorldState } from "@ai-agent/world-model";
import type { MemorySnapshot } from "@ai-agent/working-memory";
import type { Goal } from "@ai-agent/goals";

export interface CognitiveOrchestratorOptions {
  cycleInterval?: number;
  reflectionInterval?: number;
  memoryCapacity?: number;
  minActionConfidence?: number;
  llmProvider?: LlmProvider | null;
  onAction?: (decision: Decision) => void;
  onThought?: (thought: Thought) => void;
  onGoalChange?: (goal: Goal) => void;
  onWorldStateChange?: (state: WorldState) => void;
}

export interface CognitiveOrchestratorState {
  world: WorldState;
  memory: MemorySnapshot;
  goals: ReadonlyArray<Goal>;
  activeGoal: Goal | null;
  reasoningState: ReasoningState;
  lastCycleDuration: number;
  totalCycles: number;
  totalThoughts: number;
  totalActions: number;
}

export interface CognitiveOrchestrator {
  start(): void;
  stop(): void;
  observe(observation: Observation): void;
  message(text: string): void;
  getState(): CognitiveOrchestratorState;
  forceCycle(trigger?: import("@ai-agent/cognitive-types").ReasoningTrigger): Promise<ReasoningCycleResult>;
  shutdown(): Promise<void>;
}

export interface LlmProvider {
  complete(req: { model: string; prompt: string; temperature?: number }): Promise<{ text: string }>;
}

