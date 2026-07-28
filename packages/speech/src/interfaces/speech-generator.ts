import type { Intent } from "../types/intent.js";
import type { Expression } from "../types/expression.js";
import type { ExpressionGuidelines } from "@ai-agent/personality";

export interface SpeechGenerator {
  generate(intent: Intent, guidelines: ExpressionGuidelines, personalityId: string): Expression;
  generateSimple(intent: Intent, guidelines: ExpressionGuidelines, personalityId: string): Expression;
  needsLlm(intent: Intent, guidelines: ExpressionGuidelines): boolean;
}
