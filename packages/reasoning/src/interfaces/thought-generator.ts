import type { Thought } from "@ai-agent/cognitive-types";
import type { ReasoningContext } from "./reasoning-engine.js";

export interface ThoughtGenerator {
  generate(context: ReasoningContext): Promise<ReadonlyArray<Thought>>;
  needsLlm(context: ReasoningContext): boolean;
}
