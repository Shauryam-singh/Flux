import type { SelfAnalysis, MetaCognitionInsight, AnalysisCategory } from "@ai-agent/evo-types";

export interface MetaCognitionEngine {
  analyze(category: AnalysisCategory, decisionId: string, description: string, reasoning: string, context?: Record<string, unknown>): SelfAnalysis;
  getAnalysis(analysisId: string): SelfAnalysis | null;
  getAnalysesByCategory(category: AnalysisCategory): ReadonlyArray<SelfAnalysis>;
  getAllAnalyses(): ReadonlyArray<SelfAnalysis>;
  generateInsight(type: MetaCognitionInsight["type"], message: string, confidence: number, evidence: ReadonlyArray<string>, actionability: MetaCognitionInsight["actionability"]): MetaCognitionInsight;
  getInsights(): ReadonlyArray<MetaCognitionInsight>;
  getRecentInsights(count: number): ReadonlyArray<MetaCognitionInsight>;
  getStrengths(): ReadonlyArray<SelfAnalysis>;
  getWeaknesses(): ReadonlyArray<SelfAnalysis>;
}
