import type { DecisionEngine } from "../interfaces/decision-engine.js";
import type { DecisionContext } from "../interfaces/decision-engine.js";
import type { Decision, Action, Thought } from "@ai-agent/cognitive-types";

export class DefaultDecisionEngine implements DecisionEngine {
  private history: Decision[] = [];
  private readonly maxHistory: number;
  private readonly minConfidence: number;

  constructor(options?: { maxHistory?: number; minConfidence?: number }) {
    this.maxHistory = options?.maxHistory ?? 100;
    this.minConfidence = options?.minConfidence ?? 0.5;
  }

  async decide(context: DecisionContext): Promise<Decision> {
    const candidates = this.generateCandidates(context);
    const scored = candidates.map((action) => this.score(action, context));
    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best || best.score < this.minConfidence) {
      return this.makeDecision(
        { type: "silent", payload: {}, confidence: 0, reasoning: "No actionable thought" },
        false,
        0,
        "Below confidence threshold",
      );
    }

    const action = best.action;
    const interrupts = action.type === "speak" || action.type === "ask";
    const priority = interrupts ? Math.round(action.confidence * 100) : 0;

    return this.makeDecision(action, interrupts, priority, action.reasoning);
  }

  getHistory(): ReadonlyArray<Decision> {
    return this.history;
  }

  isDuplicate(action: Action, recentDecisions: ReadonlyArray<Decision>): boolean {
    const cutoff = Date.now() - 300000;
    return recentDecisions.some(
      (d) =>
        d.timestamp > cutoff &&
        d.action.type === action.type &&
        d.action.payload["tool"] === action.payload["tool"] &&
        d.action.payload["text"] === action.payload["text"],
    );
  }

  private generateCandidates(context: DecisionContext): Action[] {
    const actions: Action[] = [];

    for (const thought of context.thoughts) {
      if (thought.suggestedAction) {
        actions.push(thought.suggestedAction);
      }
    }

    if (context.goals.some((g) => g.status === "blocked")) {
      actions.push({
        type: "speak",
        payload: { text: "I noticed a blocker — want me to help?" },
        confidence: 0.7,
        reasoning: "Active goal is blocked",
      });
    }

    if (context.worldState.system.openErrors.length > 0) {
      const error = context.worldState.system.openErrors[0]!;
      actions.push({
        type: "speak",
        payload: { text: `Error detected: ${error.message}` },
        confidence: 0.75,
        reasoning: "Open error in world state",
      });
    }

    actions.push({ type: "silent", payload: {}, confidence: 0, reasoning: "Default: stay silent" });

    return actions;
  }

  private score(
    action: Action,
    context: DecisionContext,
  ): { action: Action; score: number } {
    let score = action.confidence;

    const activeGoal = context.goals.find((g) => g.status === "active" || g.status === "in_progress");
    if (activeGoal && action.reasoning.toLowerCase().includes(activeGoal.title.toLowerCase())) {
      score += 0.2;
    }

    if (context.worldState.system.openErrors.length > 0 && action.type === "speak") {
      score += 0.1;
    }

    if (context.userActive && action.type === "speak") {
      score -= 0.3;
    }

    if (this.isDuplicate(action, context.recentDecisions)) {
      score -= 0.5;
    }

    return { action, score: Math.max(0, Math.min(1, score)) };
  }

  private makeDecision(
    action: Action,
    interrupts: boolean,
    priority: number,
    reasoning: string,
  ): Decision {
    const decision: Decision = {
      action,
      interrupts,
      interruptPriority: priority,
      reasoning,
      timestamp: Date.now(),
    };
    this.history.push(decision);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
    return decision;
  }
}
