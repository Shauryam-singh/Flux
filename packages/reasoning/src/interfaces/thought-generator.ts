import type { ReasoningContext } from "./reasoning-engine.js";
import type { Thought } from "@ai-agent/cognitive-types";

export interface ThoughtGenerator {
  generate(context: ReasoningContext): Promise<ReadonlyArray<Thought>>;
  needsLlm(context: ReasoningContext): boolean;
}
