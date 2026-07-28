import type { PredictionEngine, PredictionRule, PredictionConfig } from "../interfaces/prediction-engine.js";
import type { Prediction, PredictionContext, PredictionType } from "@ai-agent/ambient-types";

const DEFAULT_CONFIG: PredictionConfig = {
  enabled: true,
  maxPredictionsPerCycle: 5,
  minConfidence: 0.3,
  historySize: 100,
};

const COMMIT_PATTERN_RULE: PredictionRule = {
  type: "next_action",
  evaluate: (ctx) => {
    const recentEdits = ctx.recentEvents.filter((e) => e.type === "file_created" || e.type === "file_deleted");
    if (recentEdits.length >= 3) {
      return {
        id: `pred_${Date.now()}`,
        type: "next_action",
        prediction: "Likely about to commit",
        confidence: 0.6,
        timeframe: "immediate",
        suggestedAction: "Review changes and commit",
        reasoning: `${recentEdits.length} recent file changes`,
        timestamp: Date.now(),
        evidence: recentEdits.map((e) => e.title),
        relatedGoalId: null,
      };
    }
    return null;
  },
  priority: 10,
};

const DEBUGGING_SESSION_RULE: PredictionRule = {
  type: "debugging_session",
  evaluate: (ctx) => {
    const hasErrors = ctx.recentEvents.some((e) => e.type === "build_failed");
    const currentPresence = ctx.currentPresence;
    if (hasErrors && currentPresence.state === "coding") {
      return {
        id: `pred_${Date.now()}`,
        type: "debugging_session",
        prediction: "Likely entering debugging session",
        confidence: 0.7,
        timeframe: "immediate",
        suggestedAction: "Set up debugging tools",
        reasoning: "Build failure while coding",
        timestamp: Date.now(),
        evidence: ["build_failed", currentPresence.state],
        relatedGoalId: null,
      };
    }
    return null;
  },
  priority: 20,
};

const RELEASE_PREPARATION_RULE: PredictionRule = {
  type: "release_preparation",
  evaluate: (ctx) => {
    const recentMerges = ctx.recentEvents.filter((e) => e.type === "git_branch_merged");
    const recentBuilds = ctx.recentEvents.filter((e) => e.type === "build_succeeded");
    if (recentMerges.length >= 2 && recentBuilds.length >= 2) {
      return {
        id: `pred_${Date.now()}`,
        type: "release_preparation",
        prediction: "Likely preparing a release",
        confidence: 0.5,
        timeframe: "hours",
        suggestedAction: "Check version and changelog",
        reasoning: "Multiple merges and successful builds",
        timestamp: Date.now(),
        evidence: recentMerges.map((e) => e.title).concat(recentBuilds.map((e) => e.title)),
        relatedGoalId: null,
      };
    }
    return null;
  },
  priority: 30,
};

const BREAK_RECOMMENDED_RULE: PredictionRule = {
  type: "break_recommended",
  evaluate: (ctx) => {
    if (ctx.currentPresence.state === "coding" || ctx.currentPresence.state === "debugging") {
      const sessionDuration = Date.now() - ctx.currentPresence.since;
      if (sessionDuration > 7200000) {
        return {
          id: `pred_${Date.now()}`,
          type: "break_recommended",
          prediction: "Break recommended after long session",
          confidence: 0.8,
          timeframe: "immediate",
          suggestedAction: "Take a 10-minute break",
          reasoning: `Coding for ${Math.round(sessionDuration / 60000)} minutes`,
          timestamp: Date.now(),
          evidence: [`session_duration: ${sessionDuration}`],
          relatedGoalId: null,
        };
      }
    }
    return null;
  },
  priority: 40,
};

const MEETING_APPROACHING_RULE: PredictionRule = {
  type: "meeting_approaching",
  evaluate: (ctx) => {
    const nextEvent = ctx.calendarState.nextEvent;
    if (nextEvent && nextEvent.type === "meeting") {
      const timeUntil = nextEvent.startTime - Date.now();
      if (timeUntil > 0 && timeUntil < 1800000) {
        return {
          id: `pred_${Date.now()}`,
          type: "meeting_approaching",
          prediction: `Meeting "${nextEvent.title}" in ${Math.round(timeUntil / 60000)} minutes`,
          confidence: 0.9,
          timeframe: "minutes",
          suggestedAction: "Prepare meeting notes",
          reasoning: "Calendar event approaching",
          timestamp: Date.now(),
          evidence: [nextEvent.title, `${timeUntil}ms`],
          relatedGoalId: null,
        };
      }
    }
    return null;
  },
  priority: 5,
};

const CONTEXT_SWITCH_RULE: PredictionRule = {
  type: "context_switch",
  evaluate: (ctx) => {
    const recentEvents = ctx.recentEvents;
    const projectSwitches = recentEvents.filter((e) => e.type === "project_switched");
    if (projectSwitches.length >= 2) {
      return {
        id: `pred_${Date.now()}`,
        type: "context_switch",
        prediction: "Frequent context switching detected",
        confidence: 0.6,
        timeframe: "immediate",
        suggestedAction: "Focus on one project",
        reasoning: `${projectSwitches.length} project switches recently`,
        timestamp: Date.now(),
        evidence: projectSwitches.map((e) => e.title),
        relatedGoalId: null,
      };
    }
    return null;
  },
  priority: 35,
};

const DEFAULT_RULES: PredictionRule[] = [
  MEETING_APPROACHING_RULE,
  COMMIT_PATTERN_RULE,
  DEBUGGING_SESSION_RULE,
  RELEASE_PREPARATION_RULE,
  BREAK_RECOMMENDED_RULE,
  CONTEXT_SWITCH_RULE,
];

export class DefaultPredictionEngine implements PredictionEngine {
  private config: PredictionConfig;
  private rules: PredictionRule[];
  private history: Prediction[] = [];
  private idCounter = 0;

  constructor(config?: Partial<PredictionConfig>, rules?: PredictionRule[]) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rules = rules ?? DEFAULT_RULES;
  }

  predict(context: PredictionContext): ReadonlyArray<Prediction> {
    const sorted = [...this.rules].sort((a, b) => a.priority - b.priority);
    const predictions: Prediction[] = [];

    for (const rule of sorted) {
      if (predictions.length >= this.config.maxPredictionsPerCycle) break;
      const prediction = rule.evaluate(context);
      if (prediction && prediction.confidence >= this.config.minConfidence) {
        predictions.push(prediction);
      }
    }

    this.history.push(...predictions);
    if (this.history.length > this.config.historySize) {
      this.history = this.history.slice(-this.config.historySize);
    }

    return predictions;
  }

  getRecentPredictions(count: number): ReadonlyArray<Prediction> {
    return this.history.slice(-count);
  }

  getStats() {
    const predictionsByType: Record<string, number> = {};
    for (const p of this.history) {
      predictionsByType[p.type] = (predictionsByType[p.type] ?? 0) + 1;
    }

    const avgConfidence = this.history.length > 0
      ? this.history.reduce((sum, p) => sum + p.confidence, 0) / this.history.length
      : 0;

    return {
      totalPredictions: this.history.length,
      averageConfidence: avgConfidence,
      predictionsByType,
      accuracyRate: 0,
    };
  }
}
