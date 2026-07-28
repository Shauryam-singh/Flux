import type { Prediction, PredictionContext, PredictionType } from "@ai-agent/ambient-types";

export interface PredictionEngine {
  predict(context: PredictionContext): ReadonlyArray<Prediction>;
  getRecentPredictions(count: number): ReadonlyArray<Prediction>;
  getStats(): {
    totalPredictions: number;
    averageConfidence: number;
    predictionsByType: Record<string, number>;
    accuracyRate: number;
  };
}

export interface PredictionRule {
  readonly type: PredictionType;
  readonly evaluate: (context: PredictionContext) => Prediction | null;
  readonly priority: number;
}

export interface PredictionConfig {
  readonly enabled: boolean;
  readonly maxPredictionsPerCycle: number;
  readonly minConfidence: number;
  readonly historySize: number;
}
