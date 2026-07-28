import type { SelfEvaluation } from "../interfaces/self-evaluation.js";
import type { EvaluationReport, EvaluationDimension, EvaluationDimensionScore } from "@ai-agent/evo-types";

let counter = 0;

export class DefaultSelfEvaluation implements SelfEvaluation {
  private readonly reports: EvaluationReport[] = [];

  evaluate(
    goalId: string,
    scores: ReadonlyArray<{ dimension: EvaluationDimension; score: number; evidence: ReadonlyArray<string> }>,
  ): EvaluationReport {
    const id = `se_${++counter}`;
    const dimensions: EvaluationDimensionScore[] = scores.map((s) => ({
      dimension: s.dimension,
      score: s.score,
      evidence: s.evidence,
      improvementSuggestions: [],
    }));
    const overallScore = dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length;

    const report: EvaluationReport = {
      id,
      goalId,
      dimensions,
      overallScore,
      strengths: [],
      weaknesses: [],
      recommendations: [],
      timestamp: Date.now(),
    };

    this.reports.push(report);
    return report;
  }

  getReport(reportId: string): EvaluationReport | null {
    return this.reports.find((r) => r.id === reportId) ?? null;
  }

  getAllReports(): ReadonlyArray<EvaluationReport> {
    return this.reports;
  }

  getReportsByGoal(goalId: string): ReadonlyArray<EvaluationReport> {
    return this.reports.filter((r) => r.goalId === goalId);
  }

  getRecentReports(count: number): ReadonlyArray<EvaluationReport> {
    return this.reports.slice(-count);
  }

  getAverageScore(dimension: EvaluationDimension): number {
    const allScores = this.reports.flatMap((r) =>
      r.dimensions.filter((d: EvaluationDimensionScore) => d.dimension === dimension),
    );
    if (allScores.length === 0) return 0;
    return allScores.reduce((sum, d) => sum + d.score, 0) / allScores.length;
  }

  getOverallAverageScore(): number {
    if (this.reports.length === 0) return 0;
    return this.reports.reduce((sum, r) => sum + r.overallScore, 0) / this.reports.length;
  }

  getTrend(dimension: EvaluationDimension): "improving" | "stable" | "declining" {
    const recent = this.reports.slice(-5);
    const older = this.reports.slice(0, -5);

    const recentAvg = this.averageForGroup(recent, dimension);
    const olderAvg = older.length > 0 ? this.averageForGroup(older, dimension) : recentAvg;

    const diff = recentAvg - olderAvg;
    if (diff > 0.05) return "improving";
    if (diff < -0.05) return "declining";
    return "stable";
  }

  private averageForGroup(group: EvaluationReport[], dimension: EvaluationDimension): number {
    const scores = group.flatMap((r) =>
      r.dimensions.filter((d: EvaluationDimensionScore) => d.dimension === dimension),
    );
    if (scores.length === 0) return 0;
    return scores.reduce((sum, d) => sum + d.score, 0) / scores.length;
  }
}
