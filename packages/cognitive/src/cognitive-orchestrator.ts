import type { CognitiveOrchestrator, CognitiveOrchestratorOptions, CognitiveOrchestratorState, LlmProvider } from "./types/index.js";
import type { WorldModel } from "@ai-agent/world-model";
import type { WorkingMemory } from "@ai-agent/working-memory";
import type { GoalManager } from "@ai-agent/goals";
import type { ReasoningEngine, ReasoningContext } from "@ai-agent/reasoning";
import type { DecisionEngine, InterruptController } from "@ai-agent/decisions";
import type { Decision, Thought, ReasoningCycleResult, ReasoningTrigger } from "@ai-agent/cognitive-types";
import type { Observation } from "@ai-agent/attention";
import type { WorldState } from "@ai-agent/world-model";
import type { MemorySnapshot } from "@ai-agent/working-memory";
import type { Goal } from "@ai-agent/goals";

export class DefaultCognitiveOrchestrator implements CognitiveOrchestrator {
  private worldModel: WorldModel;
  private workingMemory: WorkingMemory;
  private goalManager: GoalManager;
  private reasoningEngine: ReasoningEngine;
  private decisionEngine: DecisionEngine;
  private interruptController: InterruptController;

  private cycleInterval: number;
  private reflectionInterval: number;
  private minActionConfidence: number;

  private onAction?: (decision: Decision) => void;
  private onThought?: (thought: Thought) => void;
  private onGoalChange?: (goal: Goal) => void;
  private onWorldStateChange?: (state: WorldState) => void;

  private cycleTimer: ReturnType<typeof setInterval> | null = null;
  private reflectionTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  private totalCycles = 0;
  private totalThoughts = 0;
  private totalActions = 0;
  private lastCycleDuration = 0;

  private pendingObservations: Observation[] = [];
  private recentDecisions: Decision[] = [];
  private recentThoughts: Thought[] = [];

  constructor(
    worldModel: WorldModel,
    workingMemory: WorkingMemory,
    goalManager: GoalManager,
    reasoningEngine: ReasoningEngine,
    decisionEngine: DecisionEngine,
    interruptController: InterruptController,
    options?: CognitiveOrchestratorOptions,
  ) {
    this.worldModel = worldModel;
    this.workingMemory = workingMemory;
    this.goalManager = goalManager;
    this.reasoningEngine = reasoningEngine;
    this.decisionEngine = decisionEngine;
    this.interruptController = interruptController;

    this.cycleInterval = options?.cycleInterval ?? 5000;
    this.reflectionInterval = options?.reflectionInterval ?? 1800000;
    this.minActionConfidence = options?.minActionConfidence ?? 0.5;

    if (options?.onAction) this.onAction = options.onAction;
    if (options?.onThought) this.onThought = options.onThought;
    if (options?.onGoalChange) this.onGoalChange = options.onGoalChange;
    if (options?.onWorldStateChange) this.onWorldStateChange = options.onWorldStateChange;

    this.reasoningEngine.onThought((thought) => {
      this.recentThoughts.push(thought);
      if (this.recentThoughts.length > 20) {
        this.recentThoughts = this.recentThoughts.slice(-20);
      }
      this.workingMemory.add({
        type: "thought",
        content: thought.content,
        weight: Math.round(thought.confidence * 100),
        source: "reasoning",
      });
      this.onThought?.(thought);
    });
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    this.cycleTimer = setInterval(() => {
      void this.runCycle("observation");
    }, this.cycleInterval);

    this.reflectionTimer = setInterval(() => {
      void this.runCycle("reflection");
    }, this.reflectionInterval);
  }

  stop(): void {
    this.running = false;
    if (this.cycleTimer) {
      clearInterval(this.cycleTimer);
      this.cycleTimer = null;
    }
    if (this.reflectionTimer) {
      clearInterval(this.reflectionTimer);
      this.reflectionTimer = null;
    }
  }

  observe(observation: Observation): void {
    this.pendingObservations.push(observation);

    const delta = this.worldModel.update(observation);
    if (Object.keys(delta).length > 0) {
      this.onWorldStateChange?.(this.worldModel.getState());
    }

    this.workingMemory.add({
      type: "observation",
      content: `${observation.title}: ${observation.detail}`,
      weight: observation.score,
      source: observation.source,
    });

    const blockers = this.goalManager.detectBlockers(this.worldModel.getState());
    if (blockers.length > 0) {
      const active = this.goalManager.getActive();
      if (active) {
        this.goalManager.update({
          goalId: active.id,
          changes: { status: "blocked", blockers },
        });
        this.onGoalChange?.(this.goalManager.getById(active.id)!);
      }
    }
  }

  message(text: string): void {
    this.workingMemory.add({
      type: "context",
      content: `User: ${text}`,
      weight: 100,
      source: "user",
    });

    this.extractGoal(text);

    void this.runCycle("user_message");
  }

  getState(): CognitiveOrchestratorState {
    return {
      world: this.worldModel.getState(),
      memory: this.workingMemory.snapshot(),
      goals: this.goalManager.getAll(),
      activeGoal: this.goalManager.getActive(),
      reasoningState: this.reasoningEngine.getState(),
      lastCycleDuration: this.lastCycleDuration,
      totalCycles: this.totalCycles,
      totalThoughts: this.totalThoughts,
      totalActions: this.totalActions,
    };
  }

  async forceCycle(trigger: ReasoningTrigger = "observation"): Promise<ReasoningCycleResult> {
    return this.runCycle(trigger);
  }

  async shutdown(): Promise<void> {
    this.stop();
    this.pendingObservations = [];
    this.recentDecisions = [];
    this.recentThoughts = [];
  }

  private async runCycle(trigger: ReasoningTrigger): Promise<ReasoningCycleResult> {
    const startTime = Date.now();

    if (!this.reasoningEngine.shouldReason(
      this.worldModel.getState(),
      this.workingMemory.snapshot(),
      this.goalManager.getAll(),
    )) {
      this.pendingObservations = [];
      return {
        thoughts: [],
        recommendedAction: null,
        confidence: 0,
        durationMs: Date.now() - startTime,
        trigger,
      };
    }

    const context: ReasoningContext = {
      worldState: this.worldModel.getState(),
      memory: this.workingMemory.snapshot(),
      goals: this.goalManager.getAll(),
      recentObservations: [...this.pendingObservations],
      recentThoughts: [...this.recentThoughts],
    };

    const cycleResult = await this.reasoningEngine.cycle(context);
    this.totalCycles++;
    this.totalThoughts += cycleResult.thoughts.length;

    this.pendingObservations = [];

    if (cycleResult.recommendedAction) {
      const decisionContext = {
        worldState: this.worldModel.getState(),
        memory: this.workingMemory.snapshot(),
        goals: this.goalManager.getAll(),
        thoughts: cycleResult.thoughts,
        recentDecisions: this.recentDecisions,
        userActive: this.pendingObservations.some((o) => o.source === "user"),
      };

      const decision = await this.decisionEngine.decide(decisionContext);

      if (decision.action.type !== "silent" && decision.action.confidence >= this.minActionConfidence) {
        const interruptResult = this.interruptController.evaluate(
          decision.action,
          this.worldModel.getState(),
          this.interruptController.getPolicies(),
        );

        if (interruptResult.shouldInterrupt || decision.action.type === "remember") {
          this.totalActions++;
          this.recentDecisions.push(decision);
          if (this.recentDecisions.length > 50) {
            this.recentDecisions = this.recentDecisions.slice(-50);
          }
          this.onAction?.(decision);
        }
      }
    }

    this.lastCycleDuration = Date.now() - startTime;
    return cycleResult;
  }

  private extractGoal(text: string): void {
    const lower = text.toLowerCase();

    const goalPatterns = [
      { pattern: /(?:implement|build|create|add|fix|update|refactor)\s+(.+)/i, prefix: "" },
      { pattern: /(?:continue|work on|finish|complete)\s+(.+)/i, prefix: "" },
      { pattern: /(?:milestone|task)\s+(\d+)/i, prefix: "Milestone " },
    ];

    for (const { pattern, prefix } of goalPatterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const title = `${prefix}${match[1]}`.trim();
        const existing = this.goalManager.getAll().find(
          (g) => g.title.toLowerCase() === title.toLowerCase() && g.status !== "completed",
        );

        if (!existing) {
          const goal = this.goalManager.create({
            title,
            description: text,
            status: "active",
            priority: 80,
            progress: 0,
            source: "user_request",
            parentGoalId: null,
            blockers: [],
            dependencies: [],
            estimatedCompletion: null,
          });
          this.onGoalChange?.(goal);
        }
        break;
      }
    }
  }
}
