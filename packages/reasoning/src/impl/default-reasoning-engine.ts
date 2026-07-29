import type {
  ReasoningCycleResult,
  ReasoningTrigger,
  Thought,
} from "@ai-agent/cognitive-types";
import type { Goal } from "@ai-agent/goals";
import type { MemorySnapshot } from "@ai-agent/working-memory";
import type { WorldState } from "@ai-agent/world-model";
import type {
  ReasoningContext,
  ReasoningEngine,
  ReasoningState,
} from "../interfaces/reasoning-engine.js";
import type { ThoughtGenerator } from "../interfaces/thought-generator.js";

export class DefaultReasoningEngine implements ReasoningEngine {
  private state: ReasoningState = "idle";
  private thoughtHandlers: Array<(thought: Thought) => void> = [];
  private thoughtHistory: Thought[] = [];
  private readonly maxHistory: number;
  private thoughtGenerator: ThoughtGenerator;

  constructor(
    thoughtGenerator: ThoughtGenerator,
    options?: { maxHistory?: number },
  ) {
    this.thoughtGenerator = thoughtGenerator;
    this.maxHistory = options?.maxHistory ?? 100;
  }

  shouldReason(
    worldState: WorldState,
    _memory: MemorySnapshot,
    goals: ReadonlyArray<Goal>,
  ): boolean {
    if (worldState.system.openErrors.length > 0) return true;
    if (goals.some((g) => g.status === "blocked")) return true;
    if (goals.some((g) => g.status === "created")) return true;
    if (this.thoughtHistory.length === 0) return true;
    const lastThought = this.thoughtHistory[this.thoughtHistory.length - 1]!;
    if (Date.now() - lastThought.timestamp > 1800000) return true; // 30 min reflection
    return false;
  }

  async cycle(context: ReasoningContext): Promise<ReasoningCycleResult> {
    const startTime = Date.now();
    this.state = "observing";

    const thoughts: Thought[] = [];

    this.state = "thinking";
    const ruleThoughts = this.generateRuleBasedThoughts(context);
    thoughts.push(...ruleThoughts);

    if (this.thoughtGenerator.needsLlm(context)) {
      const llmThoughts = await this.thoughtGenerator.generate(context);
      thoughts.push(...llmThoughts);
    }

    for (const thought of thoughts) {
      this.thoughtHistory.push(thought);
      if (this.thoughtHistory.length > this.maxHistory) {
        this.thoughtHistory = this.thoughtHistory.slice(-this.maxHistory);
      }
      for (const handler of this.thoughtHandlers) {
        handler(thought);
      }
    }

    this.state = "deciding";
    const recommendedAction = this.selectBestAction(thoughts);

    const confidence =
      thoughts.length > 0
        ? thoughts.reduce((sum, t) => sum + t.confidence, 0) / thoughts.length
        : 0;

    this.state = "idle";

    const trigger = this.classifyTrigger(context);

    return {
      thoughts,
      recommendedAction,
      confidence,
      durationMs: Date.now() - startTime,
      trigger,
    };
  }

  getState(): ReasoningState {
    return this.state;
  }

  onThought(handler: (thought: Thought) => void): () => void {
    this.thoughtHandlers.push(handler);
    return () => {
      this.thoughtHandlers = this.thoughtHandlers.filter((h) => h !== handler);
    };
  }

  private generateRuleBasedThoughts(context: ReasoningContext): Thought[] {
    const thoughts: Thought[] = [];
    const now = Date.now();

    if (context.worldState.system.openErrors.length > 0) {
      const err = context.worldState.system.openErrors[0]!;
      thoughts.push({
        id: `thought_${now}_error`,
        type: "concern",
        content: `Error detected: ${err.message}`,
        confidence: 0.9,
        reasoning: `Open error in system from ${err.source}`,
        timestamp: now,
        relatedGoalId:
          context.goals.find((g) => g.status === "in_progress")?.id ?? null,
        relatedObservationIds: [],
        suggestedAction: {
          type: "speak",
          payload: {
            text: `Error detected: ${err.message}. Want me to look at it?`,
          },
          confidence: 0.85,
          reasoning: "Error needs attention",
        },
      });
    }

    for (const goal of context.goals) {
      if (goal.status === "blocked") {
        thoughts.push({
          id: `thought_${now}_blocked_${goal.id}`,
          type: "goal_evaluation",
          content: `Goal "${goal.title}" is blocked`,
          confidence: 0.85,
          reasoning: `Goal has ${goal.blockers.length} active blocker(s)`,
          timestamp: now,
          relatedGoalId: goal.id,
          relatedObservationIds: [],
          suggestedAction: {
            type: "speak",
            payload: {
              text: `Goal "${goal.title}" is blocked. Want me to help resolve it?`,
            },
            confidence: 0.8,
            reasoning: "Blocked goal needs user input",
          },
        });
      }
    }

    if (context.recentObservations.length >= 3) {
      const recent = context.recentObservations.slice(-3);
      const sameSource = recent.every((o) => o.source === recent[0]!.source);
      if (sameSource) {
        thoughts.push({
          id: `thought_${now}_pattern`,
          type: "pattern_recognition",
          content: `User has ${recent.length} recent ${recent[0]!.source} events`,
          confidence: 0.6,
          reasoning: "Multiple events from same source in short time",
          timestamp: now,
          relatedGoalId: null,
          relatedObservationIds: recent.map((o) => o.id),
          suggestedAction: null,
        });
      }
    }

    return thoughts;
  }

  private selectBestAction(
    thoughts: Thought[],
  ): import("@ai-agent/cognitive-types").Action | null {
    let best: import("@ai-agent/cognitive-types").Action | null = null;
    let bestScore = 0;

    for (const thought of thoughts) {
      if (thought.suggestedAction && thought.confidence > bestScore) {
        best = thought.suggestedAction;
        bestScore = thought.confidence;
      }
    }

    return best;
  }

  private classifyTrigger(context: ReasoningContext): ReasoningTrigger {
    if (context.worldState.system.openErrors.length > 0) return "error";
    if (
      context.goals.some(
        (g) => g.status === "blocked" || g.status === "created",
      )
    )
      return "goal_change";
    if (context.recentObservations.some((o) => o.source === "user"))
      return "user_message";
    return "observation";
  }
}
