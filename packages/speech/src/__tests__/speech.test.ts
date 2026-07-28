import { describe, it, expect } from "vitest";
import { DefaultSpeechGenerator } from "../impl/default-speech-generator.js";
import type { Intent } from "../types/intent.js";
import type { ExpressionGuidelines } from "@ai-agent/personality";

const mockGuidelines: ExpressionGuidelines = {
  preferredLength: "short",
  tone: "professional",
  formalityLevel: "neutral",
  useHumour: false,
  useSarcasm: false,
  includeEmojis: false,
  hedgingLevel: "some",
  warmthLevel: "neutral",
  customNotes: "",
};

const mockIntent: Intent = {
  type: "greeting",
  content: "Hello",
  context: "idle",
  confidence: 0.8,
  priority: 5,
  relatedGoalId: null,
};

describe("DefaultSpeechGenerator", () => {
  const gen = new DefaultSpeechGenerator();

  it("should generate greeting", () => {
    const result = gen.generate(mockIntent, mockGuidelines, "jarvis");
    expect(result.text).toBeTruthy();
    expect(result.intent.type).toBe("greeting");
    expect(result.personality).toBe("jarvis");
  });

  it("should generate celebration", () => {
    const intent: Intent = { ...mockIntent, type: "celebration", content: "Feature deployed" };
    const result = gen.generate(intent, mockGuidelines, "jarvis");
    expect(result.text).toContain("Feature deployed");
  });

  it("should respect length limits", () => {
    const guidelines = { ...mockGuidelines, preferredLength: "short" as const };
    const intent: Intent = { ...mockIntent, type: "explanation", content: "A".repeat(200) };
    const result = gen.generate(intent, guidelines, "jarvis");
    expect(result.text.length).toBeLessThanOrEqual(100);
  });

  it("should indicate when LLM is needed", () => {
    const intent: Intent = { ...mockIntent, type: "reflection", content: "Think deeply" };
    expect(gen.needsLlm(intent, mockGuidelines)).toBe(true);
  });

  it("should not need LLM for simple intents", () => {
    expect(gen.needsLlm(mockIntent, mockGuidelines)).toBe(false);
  });
});
