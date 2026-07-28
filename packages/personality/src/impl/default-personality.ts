import type { PersonalityEngine, ExpressionGuidelines } from "../interfaces/personality.js";
import type { Personality } from "../types/traits.js";
import { ALL_PERSONALITIES, JARVIS_PERSONALITY } from "./presets/index.js";

export class DefaultPersonalityEngine implements PersonalityEngine {
  private personalities: Map<string, Personality>;
  private activeId: string;

  constructor(defaultId?: string) {
    this.personalities = new Map(ALL_PERSONALITIES.map((p) => [p.id, p]));
    this.activeId = defaultId ?? "jarvis";
  }

  getActive(): Personality {
    return this.personalities.get(this.activeId) ?? JARVIS_PERSONALITY;
  }

  setActive(personalityId: string): void {
    if (!this.personalities.has(personalityId)) {
      throw new Error(`Personality not found: ${personalityId}`);
    }
    this.activeId = personalityId;
  }

  getAll(): ReadonlyArray<Personality> {
    return [...this.personalities.values()];
  }

  getById(id: string): Personality | null {
    return this.personalities.get(id) ?? null;
  }

  getExpressionGuidelines(intentType: string, personality?: Personality): ExpressionGuidelines {
    const p = personality ?? this.getActive();
    const t = p.traits;

    const preferredLength = t.verbosity < 0.3 ? "short" : t.verbosity < 0.7 ? "medium" : "long";
    const formalityLevel = t.formality < 0.3 ? "casual" : t.formality < 0.7 ? "neutral" : "formal";
    const warmthLevel = t.warmth < 0.3 ? "cold" : t.warmth < 0.7 ? "neutral" : "warm";
    const hedgingLevel = t.confidence > 0.7 ? "none" : t.confidence > 0.4 ? "some" : "heavy";

    let tone = "neutral";
    if (intentType === "concern") tone = t.warmth > 0.5 ? "caring concern" : "clinical observation";
    else if (intentType === "celebration") tone = t.humour > 0.5 ? "playful celebration" : "warm acknowledgment";
    else if (intentType === "suggestion") tone = t.proactiveness > 0.6 ? "confident recommendation" : "gentle suggestion";
    else if (intentType === "explanation") tone = t.curiosity > 0.6 ? "engaging explanation" : "clear explanation";
    else if (intentType === "greeting") tone = t.warmth > 0.6 ? "warm greeting" : "brief acknowledgment";
    else if (intentType === "question") tone = t.curiosity > 0.6 ? "genuine curiosity" : "direct inquiry";
    else if (intentType === "reflection") tone = "thoughtful";
    else if (intentType === "encouragement") tone = t.warmth > 0.5 ? "sincere encouragement" : "professional acknowledgment";

    let customNotes = p.styleNotes;
    if (intentType === "greeting") customNotes += ` Greeting: "${p.greeting}"`;

    return {
      preferredLength,
      tone,
      formalityLevel,
      useHumour: t.humour > 0.4 && intentType !== "concern",
      useSarcasm: t.sarcasm > 0.5 && intentType !== "concern" && intentType !== "encouragement",
      includeEmojis: t.warmth > 0.7 && t.formality < 0.3,
      hedgingLevel,
      warmthLevel,
      customNotes,
    };
  }

  register(personality: Personality): void {
    this.personalities.set(personality.id, personality);
  }
}
