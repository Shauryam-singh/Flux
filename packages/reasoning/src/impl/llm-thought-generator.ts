import type { Thought } from "@ai-agent/cognitive-types";
import type { ReasoningContext } from "../interfaces/reasoning-engine.js";
import type { ThoughtGenerator } from "../interfaces/thought-generator.js";

export interface LlmProvider {
  complete(req: {
    model: string;
    prompt: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{ text: string }>;
}

export class LlmThoughtGenerator implements ThoughtGenerator {
  private llmProvider: LlmProvider | null;
  // Staggered initial offset so this timer doesn't expire at the same instant
  // as the pipeline's intent-predict throttle and the observeScreen tick —
  // synchronized expiry turns one background call into a 5-call burst.
  private lastGenerateAt = Date.now() + 90_000;

  constructor(llmProvider: LlmProvider | null) {
    this.llmProvider = llmProvider;
  }

  needsLlm(context: ReasoningContext): boolean {
    if (!this.llmProvider) return false;
    if (context.recentObservations.length < 3) return false;
    if (context.goals.length === 0) return false;
    return true;
  }

  async generate(context: ReasoningContext): Promise<ReadonlyArray<Thought>> {
    if (!this.llmProvider || !this.needsLlm(context)) return [];

    // Each local qwen3 LLM thought-generation call emits ~1500-2500 tokens
    // (~30-40s on a laptop 4050) and Ollama serves requests serially. Fire
    // at most one per 5 minutes so the first thought doesn't block the user's
    // chat response.
    if (Date.now() - this.lastGenerateAt < 300_000) return [];

    this.lastGenerateAt = Date.now();

    const prompt = this.buildPrompt(context);

    try {
      const response = await this.llmProvider.complete({
        model: "default",
        prompt,
        temperature: 0.3,
        maxTokens: 150,
      });

      return this.parseThoughts(response.text, context);
    } catch {
      return [];
    }
  }

  private buildPrompt(context: ReasoningContext): string {
    const worldSummary = `Project: ${context.worldState.project?.name ?? "none"}, Branch: ${context.worldState.project?.activeBranch ?? "none"}, Errors: ${context.worldState.system.openErrors.length}`;
    const goalSummary = context.goals
      .map((g) => `${g.title} (${g.status}, ${g.progress}%)`)
      .join(", ");
    const recentObs = context.recentObservations
      .slice(-5)
      .map((o) => `- ${o.title}`)
      .join("\n");

    return `You are an AI assistant's reasoning engine. Analyze the current state and generate 1-3 internal thoughts.

World State: ${worldSummary}
Goals: ${goalSummary || "none"}
Recent observations:
${recentObs || "none"}

Generate a JSON array of thoughts. Each thought should have:
- type: one of "observation_interpretation", "goal_evaluation", "pattern_recognition", "prediction", "suggestion", "reflection", "concern"
- content: what you think (1 sentence)
- confidence: 0-1
- reasoning: why you think this

Return ONLY the JSON array, no other text.`;
  }

  private parseThoughts(text: string, context: ReasoningContext): Thought[] {
    try {
      const json = text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      const parsed = JSON.parse(json) as Array<{
        type: Thought["type"];
        content: string;
        confidence: number;
        reasoning: string;
      }>;

      const now = Date.now();
      return parsed.map((t, i) => ({
        id: `thought_llm_${now}_${i}`,
        type: t.type,
        content: t.content,
        confidence: Math.max(0, Math.min(1, t.confidence)),
        reasoning: t.reasoning,
        timestamp: now,
        relatedGoalId: context.goals[0]?.id ?? null,
        relatedObservationIds: context.recentObservations
          .slice(-3)
          .map((o) => o.id),
        suggestedAction: null,
      }));
    } catch {
      return [];
    }
  }
}
