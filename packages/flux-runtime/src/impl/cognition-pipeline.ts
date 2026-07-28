/**
 * CognitionPipeline - The 14-stage thinking engine
 *
 * Every tick, Flux goes through these stages:
 * 1. Observe        - Gather raw observations from all sources
 * 2. Merge          - Deduplicate and merge similar observations
 * 3. World Model    - Update the world model with merged observations
 * 4. Working Memory  - Store relevant observations in working memory
 * 5. Goal Eval      - Evaluate active goals against current state
 * 6. Intent Predict  - Predict what the user is likely to do next
 * 7. Generate       - Generate rich thoughts with evidence
 * 8. Compare        - Compare new thoughts with existing thought graph
 * 9. Opportunities  - Detect opportunities for proactive action
 * 10. Interrupt Eval - Evaluate whether to interrupt the user
 * 11. Choose Action  - Select the best action based on all analysis
 * 12. Store         - Store the thought in the graph with edges
 * 13. Explain       - Generate explanation chain for the decision
 * 14. Sleep         - Wait for next tick
 */

import type { DefaultThoughtGraph } from "@ai-agent/thought-graph";
import type {
  ThoughtNode,
  ThoughtEdge,
  MergedObservations,
  GoalEvaluation,
  UserIntentPrediction,
  Opportunity,
  CognitionResult,
  ThoughtExplanation,
} from "@ai-agent/thought-graph";
import type { WorldModel, WorldState } from "@ai-agent/world-model";
import type { WorkingMemory, MemorySnapshot } from "@ai-agent/working-memory";
import type { GoalManager } from "@ai-agent/goals";
import type { Goal, Blocker } from "@ai-agent/goals";
import type { AttentionManager, Observation } from "@ai-agent/attention";

export interface PipelineContext {
  readonly tickNumber: number;
  readonly timestamp: number;
  readonly worldState: WorldState;
  readonly memory: MemorySnapshot;
  readonly goals: ReadonlyArray<Goal>;
  readonly recentObservations: ReadonlyArray<Observation>;
  readonly recentThoughts: ReadonlyArray<ThoughtNode>;
}

export class CognitionPipeline {
  private thoughtGraph: DefaultThoughtGraph;
  private worldModel: WorldModel;
  private workingMemory: WorkingMemory;
  private goalManager: GoalManager;
  private llmProvider: { complete(req: { model: string; prompt: string; temperature?: number }): Promise<{ text: string }> };
  private attention: AttentionManager;
  private pendingObservations: Observation[] = [];
  private lastTickTime = 0;
  private tickCount = 0;

  constructor(
    thoughtGraph: DefaultThoughtGraph,
    worldModel: WorldModel,
    workingMemory: WorkingMemory,
    goalManager: GoalManager,
    llmProvider: { complete(req: { model: string; prompt: string; temperature?: number }): Promise<{ text: string }> },
    attention: AttentionManager,
  ) {
    this.thoughtGraph = thoughtGraph;
    this.worldModel = worldModel;
    this.workingMemory = workingMemory;
    this.goalManager = goalManager;
    this.llmProvider = llmProvider;
    this.attention = attention;
  }

  feedObservation(observation: Observation): void {
    this.pendingObservations.push(observation);
  }

  async runTick(): Promise<CognitionResult> {
    const tickStart = Date.now();
    this.tickCount++;
    const stages: Array<{ name: string; durationMs: number; result: unknown }> = [];

    const runStage = async <T>(name: string, fn: () => Promise<T> | T): Promise<T> => {
      const start = Date.now();
      const result = await fn();
      stages.push({ name, durationMs: Date.now() - start, result });
      return result;
    };

    // Stage 1: Observe - gather raw observations
    const observations = await runStage("observe", () =>
      Promise.resolve(this.stageObserve())
    );

    // Stage 2: Merge - deduplicate and compress
    const merged = await runStage("merge", () =>
      Promise.resolve(this.stageMerge(observations))
    );

    // Stage 3: World Model - update with merged observations
    const worldState = await runStage("world_model", () =>
      Promise.resolve(this.stageWorldModel(merged))
    );

    // Stage 4: Working Memory - store relevant observations
    await runStage("working_memory", () =>
      Promise.resolve(this.stageWorkingMemory(merged))
    );

    // Stage 5: Goal Eval - evaluate goals against current state
    const goalEval = await runStage("goal_eval", () =>
      Promise.resolve(this.stageGoalEval(worldState))
    );

    // Stage 6: Intent Predict - predict user intent
    const userIntent = await runStage("intent_predict", () =>
      this.stageIntentPredict(merged, goalEval, worldState)
    );

    // Stage 7: Generate - generate rich thoughts
    const newThoughts = await runStage("generate", () =>
      this.stageGenerate(merged, goalEval, userIntent, worldState)
    );

    // Stage 8: Compare - compare with existing thoughts
    const comparedThoughts = await runStage("compare", () =>
      Promise.resolve(this.stageCompare(newThoughts))
    );

    // Stage 9: Opportunities - detect proactive actions
    const opportunities = await runStage("opportunities", () =>
      Promise.resolve(this.stageOpportunities(comparedThoughts, worldState, goalEval))
    );

    // Stage 10: Interrupt Eval - evaluate interrupt policy
    const interruptResult = await runStage("interrupt_eval", () =>
      Promise.resolve(this.stageInterruptEval(comparedThoughts, worldState))
    );

    // Stage 11: Choose Action - select best action
    const selectedAction = await runStage("choose_action", () =>
      Promise.resolve(this.stageChooseAction(comparedThoughts, opportunities, interruptResult))
    );

    // Stage 12: Store - store thoughts and edges in graph
    await runStage("store", () =>
      Promise.resolve(this.stageStore(comparedThoughts, selectedAction))
    );

    // Stage 13: Explain - generate explanation chain
    const explanation = await runStage("explain", () =>
      Promise.resolve(this.stageExplain(selectedAction))
    );

    // Stage 14: Sleep - brief pause (handled by caller)
    await runStage("sleep", () => this.stageSleep());

    this.lastTickTime = Date.now();

    const graphSnapshot = this.thoughtGraph.snapshot();

    return {
      tickNumber: this.tickCount,
      timestamp: tickStart,
      durationMs: Date.now() - tickStart,
      stages,
      thoughts: comparedThoughts,
      edges: graphSnapshot.edges,
      opportunities,
      userIntent,
      selectedAction,
      explanation,
      graphSize: {
        nodes: graphSnapshot.nodeCount,
        edges: graphSnapshot.edgeCount,
      },
    };
  }

  getThoughtGraph(): DefaultThoughtGraph {
    return this.thoughtGraph;
  }

  // ─── Stage 1: Observe ──────────────────────────────────────────

  private stageObserve(): Observation[] {
    const observations = [...this.pendingObservations];
    this.pendingObservations = [];
    return observations;
  }

  // ─── Stage 2: Merge ────────────────────────────────────────────

  private stageMerge(observations: Observation[]): MergedObservations {
    const merged = new Map<string, Observation>();
    const patterns: Array<{ type: string; description: string; count: number }> = [];

    for (const obs of observations) {
      const key = `${obs.source}:${obs.title}`;
      const existing = merged.get(key);

      if (existing && obs.mergeable) {
        // Merge: keep the higher score, combine details
        merged.set(key, {
          ...existing,
          score: Math.max(existing.score, obs.score),
          detail: `${existing.detail} | ${obs.detail}`,
          timestamp: Math.max(existing.timestamp, obs.timestamp),
        });
      } else {
        merged.set(key, obs);
      }
    }

    // Detect patterns: multiple observations from same source
    const sourceCounts = new Map<string, number>();
    for (const obs of merged.values()) {
      sourceCounts.set(obs.source, (sourceCounts.get(obs.source) ?? 0) + 1);
    }

    for (const [source, count] of sourceCounts) {
      if (count >= 3) {
        patterns.push({
          type: "repeated_source",
          description: `${count} observations from ${source}`,
          count,
        });
      }
    }

    const result: MergedObservations = {
      observations: [...merged.values()].map((o) => ({
        id: o.id,
        source: o.source,
        title: o.title,
        detail: o.detail,
        score: o.score,
        timestamp: o.timestamp,
      })),
      patterns,
      summary: `Merged ${observations.length} observations into ${merged.size} unique`,
    };

    return result;
  }

  // ─── Stage 3: World Model ──────────────────────────────────────

  private stageWorldModel(merged: MergedObservations): WorldState {
    for (const obs of merged.observations) {
      const fullObs: Observation = {
        id: obs.id,
        source: obs.source as Observation["source"],
        title: obs.title,
        detail: obs.detail,
        priority: obs.score > 80 ? "high" : obs.score > 50 ? "medium" : "low",
        score: obs.score,
        timestamp: obs.timestamp,
        mergeable: true,
        consumed: false,
      };

      this.worldModel.update(fullObs);
    }

    return this.worldModel.getState();
  }

  // ─── Stage 4: Working Memory ───────────────────────────────────

  private stageWorkingMemory(merged: MergedObservations): void {
    for (const obs of merged.observations) {
      this.workingMemory.add({
        type: "observation",
        content: `${obs.title}: ${obs.detail}`,
        weight: Math.round(obs.score),
        source: obs.source,
      });
    }
  }

  // ─── Stage 5: Goal Eval ────────────────────────────────────────

  private stageGoalEval(worldState: WorldState): GoalEvaluation {
    const allGoals = this.goalManager.getAll();
    const activeGoals = allGoals
      .filter((g) => g.status === "active" || g.status === "in_progress")
      .map((g) => ({
        id: g.id,
        title: g.title,
        progress: g.progress,
        blockers: g.blockers.map((b) => b.description),
        nextStep: this.inferNextStep(g, worldState),
      }));

    const stalledGoals = allGoals
      .filter((g) => {
        if (g.status !== "active" && g.status !== "in_progress") return false;
        // Goal is stalled if it hasn't progressed in 30 minutes
        const elapsed = Date.now() - g.updatedAt;
        return elapsed > 1800000 && g.progress < 100;
      })
      .map((g) => g.id);

    const completedGoals = allGoals
      .filter((g) => g.status === "completed")
      .map((g) => g.id);

    // Detect blockers from world state
    if (worldState.system.openErrors.length > 0) {
      for (const goal of activeGoals) {
        if (goal.blockers.length === 0) {
          // Auto-detect blocker
          const existing = this.goalManager.getById(goal.id);
          if (existing) {
            const newBlocker: Blocker = {
              id: `blocker_${Date.now()}`,
              description: `Error: ${worldState.system.openErrors[0]?.message ?? "unknown"}`,
              severity: "high",
              detectedAt: Date.now(),
              resolvedAt: null,
            };
            this.goalManager.update({
              goalId: goal.id,
              changes: {
                blockers: [...existing.blockers, newBlocker],
              },
            });
          }
        }
      }
    }

    return { activeGoals, stalledGoals, completedGoals };
  }

  private inferNextStep(goal: Goal, worldState: WorldState): string | null {
    if (goal.progress === 0) return "Start implementation";
    if (goal.progress < 30) return "Continue core work";
    if (goal.progress < 70) return "Complete remaining pieces";
    if (goal.progress < 100) return "Finalize and test";
    return "Ready to complete";
  }

  // ─── Stage 6: Intent Predict ───────────────────────────────────

  private async stageIntentPredict(
    merged: MergedObservations,
    goalEval: GoalEvaluation,
    worldState: WorldState,
  ): Promise<UserIntentPrediction> {
    // Rule-based prediction first
    let primaryIntent = "continue_working";
    let confidence = 0.5;
    let reasoning = "No strong signals";
    let urgency: UserIntentPrediction["urgency"] = "none";

    // Check for errors → user likely wants them fixed
    if (worldState.system.openErrors.length > 0) {
      primaryIntent = "fix_errors";
      confidence = 0.8;
      reasoning = `${worldState.system.openErrors.length} open error(s) detected`;
      urgency = "high";
    }

    // Check for blocked goals → user likely wants help
    else if (goalEval.activeGoals.some((g) => g.blockers.length > 0)) {
      primaryIntent = "resolve_blocker";
      confidence = 0.75;
      reasoning = "Active goal has blockers";
      urgency = "medium";
    }

    // Check for stalled goals → user might be stuck
    else if (goalEval.stalledGoals.length > 0) {
      primaryIntent = "unblock_progress";
      confidence = 0.6;
      reasoning = "Goal appears stalled";
      urgency = "low";
    }

    // Check for high system load → user might be running builds/tests
    else if (worldState.system.cpuUsage > 80) {
      primaryIntent = "monitoring";
      confidence = 0.5;
      reasoning = "High CPU usage, likely build/test running";
      urgency = "none";
    }

    // Try LLM prediction if available and we have enough context
    if (merged.observations.length >= 3 && confidence < 0.7) {
      try {
        const llmPrediction = await this.llmPredictIntent(merged, goalEval, worldState);
        if (llmPrediction.confidence > confidence) {
          return llmPrediction;
        }
      } catch {
        // Fall back to rule-based
      }
    }

    return {
      primaryIntent,
      confidence,
      reasoning,
      relatedGoals: goalEval.activeGoals.map((g) => g.id),
      urgency,
    };
  }

  private async llmPredictIntent(
    merged: MergedObservations,
    goalEval: GoalEvaluation,
    worldState: WorldState,
  ): Promise<UserIntentPrediction> {
    const recentObs = merged.observations
      .slice(-5)
      .map((o) => `- ${o.source}: ${o.title}`)
      .join("\n");

    const goals = goalEval.activeGoals
      .map((g) => `- ${g.title} (${g.progress}% done)`)
      .join("\n");

    const response = await this.llmProvider.complete({
      model: "default",
      temperature: 0.2,
      prompt: `You are Flux, an AI's cognitive system. Predict what the user is likely to do next.

Current state:
- Errors: ${worldState.system.openErrors.length}
- Active goals: ${goals || "none"}
- Recent observations:
${recentObs || "none"}

Reply with a JSON object:
{
  "intent": "what the user is probably trying to do",
  "confidence": 0.0-1.0,
  "reasoning": "why you think this",
  "urgency": "none|low|medium|high"
}`,
    });

    const parsed = JSON.parse(response.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
    return {
      primaryIntent: parsed.intent,
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
      reasoning: parsed.reasoning,
      relatedGoals: goalEval.activeGoals.map((g) => g.id),
      urgency: parsed.urgency,
    };
  }

  // ─── Stage 7: Generate ─────────────────────────────────────────

  private async stageGenerate(
    merged: MergedObservations,
    goalEval: GoalEvaluation,
    userIntent: UserIntentPrediction,
    worldState: WorldState,
  ): Promise<ThoughtNode[]> {
    const thoughts: ThoughtNode[] = [];
    const now = Date.now();

    // Rule-based thought generation

    // Error thoughts
    for (const error of worldState.system.openErrors) {
      thoughts.push(this.thoughtGraph.addNode({
        type: "concern",
        content: `Error: ${error.message}`,
        reasoning: `Open error from ${error.source}`,
        confidence: { value: 0.9, reason: "Direct error observation", timestamp: now },
        evidence: [{
          id: `ev_${now}`,
          observationId: error.source,
          source: error.source,
          content: error.message,
          strength: 0.9,
          timestamp: now,
        }],
        counterarguments: [],
        relatedThoughtIds: [],
        observationIds: [],
        goalId: goalEval.activeGoals[0]?.id ?? null,
        expiresAt: now + 3600000, // 1 hour
        metadata: { errorSource: error.source },
      }));
    }

    // Goal progress thoughts
    for (const goal of goalEval.activeGoals) {
      if (goal.progress > 0 && goal.progress < 100) {
        thoughts.push(this.thoughtGraph.addNode({
          type: "goal_evaluation",
          content: `Goal "${goal.title}" at ${goal.progress}% — ${goal.nextStep ?? "continue"}`,
          reasoning: `Progress tracking for active goal`,
          confidence: { value: 0.8, reason: "Goal progress data", timestamp: now },
          evidence: [],
          counterarguments: goal.blockers.map((b) => ({
            id: `ca_${now}_${b}`,
            content: `Blocker: ${b}`,
            strength: 0.6,
            relatedEvidenceId: null,
          })),
          relatedThoughtIds: [],
          observationIds: [],
          goalId: goal.id,
          expiresAt: now + 86400000, // 24 hours
          metadata: { progress: goal.progress },
        }));
      }

      // Stalled goal thoughts
      if (goalEval.stalledGoals.includes(goal.id)) {
        thoughts.push(this.thoughtGraph.addNode({
          type: "concern",
          content: `Goal "${goal.title}" appears stalled`,
          reasoning: "No progress in 30+ minutes",
          confidence: { value: 0.7, reason: "Time-based stall detection", timestamp: now },
          evidence: [],
          counterarguments: [],
          relatedThoughtIds: [],
          observationIds: [],
          goalId: goal.id,
          expiresAt: now + 7200000, // 2 hours
          metadata: {},
        }));
      }
    }

    // Pattern recognition from merged observations
    for (const pattern of merged.patterns) {
      thoughts.push(this.thoughtGraph.addNode({
        type: "pattern_recognition",
        content: pattern.description,
        reasoning: `Detected pattern: ${pattern.type} (count: ${pattern.count})`,
        confidence: { value: 0.6, reason: "Pattern detection", timestamp: now },
        evidence: merged.observations
          .filter((o) => o.source === pattern.description.split(" from ")[1])
          .map((o) => ({
            id: `ev_${now}_${o.id}`,
            observationId: o.id,
            source: o.source,
            content: o.title,
            strength: 0.5,
            timestamp: o.timestamp,
          })),
        counterarguments: [],
        relatedThoughtIds: [],
        observationIds: merged.observations.map((o) => o.id),
        goalId: null,
        expiresAt: now + 1800000, // 30 minutes
        metadata: { patternType: pattern.type },
      }));
    }

    // User intent thought
    if (userIntent.confidence > 0.6) {
      thoughts.push(this.thoughtGraph.addNode({
        type: "user_intent",
        content: `User likely wants to: ${userIntent.primaryIntent}`,
        reasoning: userIntent.reasoning,
        confidence: {
          value: userIntent.confidence,
          reason: "Intent prediction",
          timestamp: now,
        },
        evidence: [],
        counterarguments: [],
        relatedThoughtIds: [],
        observationIds: [],
        goalId: null,
        expiresAt: now + 600000, // 10 minutes
        metadata: { urgency: userIntent.urgency },
      }));
    }

    // System health thoughts
    if (worldState.system.cpuUsage > 80) {
      thoughts.push(this.thoughtGraph.addNode({
        type: "concern",
        content: `High CPU usage: ${worldState.system.cpuUsage}%`,
        reasoning: "System load is elevated",
        confidence: { value: 0.7, reason: "System metric", timestamp: now },
        evidence: [],
        counterarguments: [],
        relatedThoughtIds: [],
        observationIds: [],
        goalId: null,
        expiresAt: now + 300000, // 5 minutes
        metadata: { cpuUsage: worldState.system.cpuUsage },
      }));
    }

    return thoughts;
  }

  // ─── Stage 8: Compare ──────────────────────────────────────────

  private stageCompare(newThoughts: ThoughtNode[]): ThoughtNode[] {
    const recentThoughts = this.thoughtGraph.getRecentThoughts(20);
    const compared: ThoughtNode[] = [];

    for (const newThought of newThoughts) {
      // Check for similar existing thoughts
      const similar = recentThoughts.find((existing) =>
        existing.id !== newThought.id &&
        existing.type === newThought.type &&
        this.thoughtsSimilar(existing, newThought)
      );

      if (similar) {
        // Link the new thought as extending the existing one
        this.thoughtGraph.addEdge({
          fromId: similar.id,
          toId: newThought.id,
          type: "extends",
          strength: 0.7,
        });

        // Boost confidence if the same observation keeps appearing
        const boostedConfidence = Math.min(1, newThought.confidence.value + 0.1);
        this.thoughtGraph.updateNode(newThought.id, {
          confidence: {
            ...newThought.confidence,
            value: boostedConfidence,
            reason: `${newThought.confidence.reason} (reinforced by existing thought)`,
          },
        });
      }

      // Check for contradictions
      const contradicting = recentThoughts.find((existing) =>
        existing.id !== newThought.id &&
        existing.type === newThought.type &&
        this.thoughtsContradict(existing, newThought)
      );

      if (contradicting) {
        this.thoughtGraph.addEdge({
          fromId: contradicting.id,
          toId: newThought.id,
          type: "contradicts",
          strength: 0.6,
        });
      }

      compared.push(newThought);
    }

    return compared;
  }

  private thoughtsSimilar(a: ThoughtNode, b: ThoughtNode): boolean {
    // Simple similarity: share keywords
    const wordsA = new Set(a.content.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.content.toLowerCase().split(/\s+/));
    let overlap = 0;
    for (const word of wordsA) {
      if (wordsB.has(word)) overlap++;
    }
    const similarity = overlap / Math.max(wordsA.size, wordsB.size);
    return similarity > 0.3;
  }

  private thoughtsContradict(a: ThoughtNode, b: ThoughtNode): boolean {
    // Check for negation patterns
    const negations = ["not", "no", "never", "failed", "broken", "fixed", "working", "success"];
    const wordsA = a.content.toLowerCase().split(/\s+/);
    const wordsB = b.content.toLowerCase().split(/\s+/);

    for (const neg of negations) {
      const aHas = wordsA.includes(neg);
      const bHas = wordsB.includes(neg);
      if (aHas !== bHas && wordsA.some((w) => wordsB.includes(w))) {
        return true;
      }
    }
    return false;
  }

  // ─── Stage 9: Opportunities ────────────────────────────────────

  private stageOpportunities(
    thoughts: ThoughtNode[],
    worldState: WorldState,
    goalEval: GoalEvaluation,
  ): Opportunity[] {
    const opportunities: Opportunity[] = [];
    const now = Date.now();

    // If there are errors, offer to fix them
    if (worldState.system.openErrors.length > 0) {
      opportunities.push({
        id: `opp_${now}_fix`,
        type: "prevention",
        description: "Offer to fix detected errors",
        reasoning: `${worldState.system.openErrors.length} error(s) need attention`,
        confidence: 0.8,
        relatedThoughtIds: thoughts
          .filter((t) => t.type === "concern")
          .map((t) => t.id),
      });
    }

    // If a goal is stalled, suggest next step
    if (goalEval.stalledGoals.length > 0) {
      opportunities.push({
        id: `opp_${now}_unblock`,
        type: "automation",
        description: "Suggest unblocking stalled goals",
        reasoning: "Goals appear stuck with no recent progress",
        confidence: 0.7,
        relatedThoughtIds: thoughts
          .filter((t) => t.type === "concern" && t.goalId !== null)
          .map((t) => t.id),
      });
    }

    // If user intent is clear, prepare proactive suggestion
    const intentThought = thoughts.find((t) => t.type === "user_intent");
    if (intentThought && intentThought.confidence.value > 0.7) {
      opportunities.push({
        id: `opp_${now}_proactive`,
        type: "learning",
        description: `Proactively address: ${intentThought.content}`,
        reasoning: "Strong user intent signal detected",
        confidence: intentThought.confidence.value,
        relatedThoughtIds: [intentThought.id],
      });
    }

    // If patterns suggest repeated work, suggest automation
    const patterns = thoughts.filter((t) => t.type === "pattern_recognition");
    for (const pattern of patterns) {
      if (pattern.metadata["patternType"] === "repeated_source") {
        opportunities.push({
          id: `opp_${now}_automate_${pattern.id}`,
          type: "automation",
          description: `Automate repeated task: ${pattern.content}`,
          reasoning: "Pattern suggests repetitive work",
          confidence: 0.6,
          relatedThoughtIds: [pattern.id],
        });
      }
    }

    return opportunities;
  }

  // ─── Stage 10: Interrupt Eval ──────────────────────────────────

  private stageInterruptEval(
    thoughts: ThoughtNode[],
    worldState: WorldState,
  ): { shouldInterrupt: boolean; priority: number; reason: string } {
    // Critical errors always interrupt
    if (worldState.system.openErrors.length > 3) {
      return {
        shouldInterrupt: true,
        priority: 90,
        reason: "Multiple critical errors detected",
      };
    }

    // High-confidence suggestions interrupt
    const highConfSuggestions = thoughts.filter(
      (t) => t.type === "suggestion" && t.confidence.value > 0.8,
    );
    if (highConfSuggestions.length > 0) {
      return {
        shouldInterrupt: true,
        priority: 60,
        reason: "High-confidence suggestion available",
      };
    }

    // Stalled goals with no user activity interrupt
    const stalledThoughts = thoughts.filter(
      (t) => t.type === "concern" && t.content.includes("stalled"),
    );
    if (stalledThoughts.length > 0) {
      return {
        shouldInterrupt: true,
        priority: 40,
        reason: "Goal appears stalled, user may need help",
      };
    }

    return {
      shouldInterrupt: false,
      priority: 0,
      reason: "No interrupt-worthy conditions",
    };
  }

  // ─── Stage 11: Choose Action ───────────────────────────────────

  private stageChooseAction(
    thoughts: ThoughtNode[],
    opportunities: Opportunity[],
    interruptResult: { shouldInterrupt: boolean; priority: number; reason: string },
  ): { type: string; reasoning: string; confidence: number } | null {
    // Priority 1: Fix errors
    const errorThoughts = thoughts.filter((t) => t.type === "concern" && t.content.includes("Error"));
    if (errorThoughts.length > 0) {
      const highest = errorThoughts.reduce((a, b) =>
        a.confidence.value > b.confidence.value ? a : b,
      );
      return {
        type: "speak",
        reasoning: `Error detected: ${highest.content}`,
        confidence: highest.confidence.value,
      };
    }

    // Priority 2: Help with stalled goals
    const stalledThoughts = thoughts.filter((t) => t.type === "concern" && t.content.includes("stalled"));
    if (stalledThoughts.length > 0) {
      return {
        type: "speak",
        reasoning: "Goal is stalled, offering help",
        confidence: 0.7,
      };
    }

    // Priority 3: Proactive opportunities
    const highOpps = opportunities.filter((o) => o.confidence > 0.7);
    if (highOpps.length > 0) {
      const best = highOpps.reduce((a, b) =>
        a.confidence > b.confidence ? a : b,
      );
      return {
        type: "speak",
        reasoning: best.reasoning,
        confidence: best.confidence,
      };
    }

    // Priority 4: High-confidence suggestions
    const suggestions = thoughts.filter((t) => t.type === "suggestion");
    if (suggestions.length > 0) {
      const best = suggestions.reduce((a, b) =>
        a.confidence.value > b.confidence.value ? a : b,
      );
      return {
        type: "speak",
        reasoning: best.reasoning,
        confidence: best.confidence.value,
      };
    }

    // Default: stay silent
    return null;
  }

  // ─── Stage 12: Store ───────────────────────────────────────────

  private stageStore(
    thoughts: ThoughtNode[],
    selectedAction: { type: string; reasoning: string; confidence: number } | null,
  ): void {
    // All thoughts are already added to graph in Stage 7
    // Now we add edges between related thoughts

    for (let i = 0; i < thoughts.length; i++) {
      for (let j = i + 1; j < thoughts.length; j++) {
        const a = thoughts[i]!;
        const b = thoughts[j]!;

        // Connect thoughts about the same goal
        if (a.goalId && a.goalId === b.goalId) {
          this.thoughtGraph.addEdge({
            fromId: a.id,
            toId: b.id,
            type: "supports",
            strength: 0.5,
          });
        }

        // Connect concerns to suggestions
        if (a.type === "concern" && b.type === "suggestion") {
          this.thoughtGraph.addEdge({
            fromId: a.id,
            toId: b.id,
            type: "follows",
            strength: 0.6,
          });
        }
      }
    }

    // Store working memory entries for strong thoughts
    for (const thought of thoughts) {
      if (thought.confidence.value > 0.7) {
        this.workingMemory.add({
          type: "thought",
          content: thought.content,
          weight: Math.round(thought.confidence.value * 100),
          source: "cognition",
        });
      }
    }
  }

  // ─── Stage 13: Explain ─────────────────────────────────────────

  private stageExplain(
    selectedAction: { type: string; reasoning: string; confidence: number } | null,
  ): ThoughtExplanation | null {
    if (!selectedAction) return null;

    // Find the thought that led to this action
    const actionThoughts = this.thoughtGraph.getRecentThoughts(10)
      .filter((t) => selectedAction.reasoning.includes(t.content) || t.content.includes(selectedAction.reasoning));

    if (actionThoughts.length === 0) {
      return {
        thoughtId: "action",
        mainThought: selectedAction.reasoning,
        evidenceChain: [],
        counterarguments: [],
        confidenceReasoning: `Confidence: ${selectedAction.confidence}`,
        relatedThoughts: [],
        timestamp: Date.now(),
      };
    }

    // Use the first matching thought to build explanation
    return this.thoughtGraph.explain(actionThoughts[0]!.id);
  }

  // ─── Stage 14: Sleep ───────────────────────────────────────────

  private async stageSleep(): Promise<void> {
    // Brief pause to yield to other operations
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
