import type { Observation } from "@ai-agent/attention";
import type { BehaviourPattern, PatternType } from "../types/behaviour-pattern.js";

export interface UserBehaviourModel {
  observe(observation: Observation): void;
  getPatterns(): ReadonlyArray<BehaviourPattern>;
  getPatternsByType(type: PatternType): ReadonlyArray<BehaviourPattern>;
  getConfidence(type: PatternType): number;
  getHabits(): ReadonlyArray<string>;
  updateConfidence(patternId: string, correct: boolean): void;
}
