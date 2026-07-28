import type { WorldState, WorldModel } from "@ai-agent/world-model";
import type { Timeline, TimelineEvent } from "@ai-agent/timeline";
import type { GoalManager } from "@ai-agent/goals";
import type { PersonalityEngine, ExpressionGuidelines } from "@ai-agent/personality";
import type { UserStateEstimator, UserBehaviourModel } from "@ai-agent/user-model";
import type { RelationshipModel, RelationshipProfile } from "@ai-agent/relationship";
import type { ReflectionEngine, Reflection } from "@ai-agent/reflection";
import type { CompanionEngine, CompanionContext, CompanionInteraction } from "@ai-agent/companion";
import type { SpeechGenerator, Intent } from "@ai-agent/speech";
import type { LearningPipeline, Feedback, LearningUpdate } from "@ai-agent/learning";
import type { Observation } from "@ai-agent/attention";

export interface CompanionOrchestratorConfig {
  readonly enabled: boolean;
  readonly reflectionScheduleMs: number;
  readonly maxIdleCheckMs: number;
}

export interface CompanionOrchestratorDeps {
  readonly worldModel: WorldModel;
  readonly timeline: Timeline;
  readonly goals: GoalManager;
  readonly personality: PersonalityEngine;
  readonly userState: UserStateEstimator;
  readonly behaviour: UserBehaviourModel;
  readonly relationship: RelationshipModel;
  readonly reflection: ReflectionEngine;
  readonly companion: CompanionEngine;
  readonly speech: SpeechGenerator;
  readonly learning: LearningPipeline;
}

const DEFAULT_CONFIG: CompanionOrchestratorConfig = {
  enabled: true,
  reflectionScheduleMs: 86400000,
  maxIdleCheckMs: 300000,
};

export class CompanionOrchestrator {
  private config: CompanionOrchestratorConfig;
  private deps: CompanionOrchestratorDeps;
  private lastReflection = 0;
  private workSessionStart: number | null = null;
  private lastInteractionTime = 0;
  private goalProgressMap = new Map<string, number>();

  constructor(deps: CompanionOrchestratorDeps, config?: Partial<CompanionOrchestratorConfig>) {
    this.deps = deps;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async tick(): Promise<{
    interaction: CompanionInteraction | null;
    reflection: Reflection | null;
    speech: string | null;
    learning: ReadonlyArray<LearningUpdate>;
  }> {
    if (!this.config.enabled) return { interaction: null, reflection: null, speech: null, learning: [] };

    const worldState = this.deps.worldModel.getState();
    const userState = this.deps.userState.estimate(worldState, []);
    const relationship = this.deps.relationship.getProfile();
    const now = Date.now();

    if (this.workSessionStart === null) this.workSessionStart = now;

    const interaction = this.deps.companion.evaluate({
      worldState,
      timeline: this.deps.timeline.getRange(now - 3600000, now),
      goalProgress: this.getAverageGoalProgress(),
      workSessionDuration: now - this.workSessionStart,
      lastInteractionTime: this.lastInteractionTime,
      userState,
      relationship,
    });

    let reflection: Reflection | null = null;
    if (now - this.lastReflection > this.config.reflectionScheduleMs) {
      reflection = await this.generateReflection();
      this.lastReflection = now;
    }

    const learning = await this.deps.learning.process();

    let speech: string | null = null;
    if (interaction) {
      speech = this.generateSpeech(interaction, userState, relationship);
      this.lastInteractionTime = now;
    }

    return { interaction, reflection, speech, learning };
  }

  recordFeedback(feedback: Feedback): void {
    this.deps.learning.record(feedback);
  }

  updateGoalProgress(goalId: string, progress: number): void {
    this.goalProgressMap.set(goalId, progress);
  }

  resetSession(): void {
    this.workSessionStart = null;
  }

  getSummary(): {
    totalInteractions: number;
    totalReflections: number;
    currentGoalProgress: number;
    relationshipTrust: number;
    learningStats: ReturnType<LearningPipeline["getStats"]>;
    companionStats: ReturnType<CompanionEngine["getStats"]>;
  } {
    return {
      totalInteractions: this.deps.companion.getStats().totalInteractions,
      totalReflections: this.deps.reflection.getLatest() ? 1 : 0,
      currentGoalProgress: this.getAverageGoalProgress(),
      relationshipTrust: this.deps.relationship.getProfile().trustLevel,
      learningStats: this.deps.learning.getStats(),
      companionStats: this.deps.companion.getStats(),
    };
  }

  private getAverageGoalProgress(): number {
    const goals = this.deps.goals.getAll();
    if (goals.length === 0) return 0;
    const sum = goals.reduce((s, g) => s + g.progress, 0);
    return sum / goals.length;
  }

  private async generateReflection(): Promise<Reflection> {
    const now = Date.now();
    return this.deps.reflection.generate({
      type: "daily",
      dateRange: { start: now - 86400000, end: now },
    });
  }

  private generateSpeech(
    interaction: CompanionInteraction,
    userState: { current: string },
    relationship: RelationshipProfile,
  ): string {
    const intentType = this.mapInteractionToIntent(interaction.type);
    const intent: Intent = {
      type: intentType,
      content: interaction.message,
      context: userState.current,
      confidence: interaction.confidence,
      priority: 5,
      relatedGoalId: null,
    };

    const guidelines = this.deps.personality.getExpressionGuidelines(intentType);
    const expression = this.deps.speech.generate(intent, guidelines, this.deps.personality.getActive().id);
    return expression.text;
  }

  private mapInteractionToIntent(type: string): Intent["type"] {
    switch (type) {
      case "milestone_celebration": return "celebration";
      case "encouragement": return "encouragement";
      case "progress_observation": return "observation";
      case "break_suggestion": return "suggestion";
      case "work_session_recognition": return "greeting";
      case "observation_share": return "observation";
      case "light_humour": return "greeting";
      default: return "observation";
    }
  }
}
