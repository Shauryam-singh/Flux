import type { Personality, PersonalityTraits } from "../types/traits.js";

export interface ExpressionGuidelines {
  readonly preferredLength: "short" | "medium" | "long";
  readonly tone: string;
  readonly formalityLevel: "casual" | "neutral" | "formal";
  readonly useHumour: boolean;
  readonly useSarcasm: boolean;
  readonly includeEmojis: boolean;
  readonly hedgingLevel: "none" | "some" | "heavy";
  readonly warmthLevel: "cold" | "neutral" | "warm";
  readonly customNotes: string;
}

export interface PersonalityEngine {
  getActive(): Personality;
  setActive(personalityId: string): void;
  getAll(): ReadonlyArray<Personality>;
  getById(id: string): Personality | null;
  getExpressionGuidelines(intentType: string, personality?: Personality): ExpressionGuidelines;
  register(personality: Personality): void;
}
