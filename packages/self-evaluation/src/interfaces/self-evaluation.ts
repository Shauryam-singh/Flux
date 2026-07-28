import type { EvaluationReport, EvaluationDimension, EvaluationDimensionScore } from "@ai-agent/evo-types";

export interface SelfEvaluation {
  evaluate(goalId: string, scores: ReadonlyArray<{ dimension: EvaluationDimension; score: number; evidence: ReadonlyArray<string> }>): EvaluationReport;
  getReport(reportId: string): EvaluationReport | null;
  getAllReports(): ReadonlyArray<EvaluationReport>;
  getReportsByGoal(goalId: string): ReadonlyArray<EvaluationReport>;
  getRecentReports(count: number): ReadonlyArray<EvaluationReport>;
  getAverageScore(dimension: EvaluationDimension): number;
  getOverallAverageScore(): number;
  getTrend(dimension: EvaluationDimension): "improving" | "stable" | "declining";
}
