import type { SelfAnalysis, MetaCognitionInsight, AnalysisCategory } from "@ai-agent/evo-types";
import type { MetaCognitionEngine } from "../interfaces/meta-cognition.js";

let analysisCounter = 0;
let insightCounter = 0;

export class DefaultMetaCognitionEngine implements MetaCognitionEngine {
  private readonly analyses = new Map<string, SelfAnalysis>();
  private readonly insights = new Map<string, MetaCognitionInsight>();

  analyze(category: AnalysisCategory, decisionId: string, description: string, reasoning: string, context?: Record<string, unknown>): SelfAnalysis {
    const analysis: SelfAnalysis = {
      id: `mc_${++analysisCounter}`,
      category,
      decisionId,
      description,
      reasoning,
      quality: 0,
      improvements: [],
      alternatives: [],
      timestamp: Date.now(),
      context: context ?? {},
    };
    this.analyses.set(analysis.id, analysis);
    return analysis;
  }

  getAnalysis(analysisId: string): SelfAnalysis | null {
    return this.analyses.get(analysisId) ?? null;
  }

  getAnalysesByCategory(category: AnalysisCategory): ReadonlyArray<SelfAnalysis> {
    return [...this.analyses.values()].filter((a) => a.category === category);
  }

  getAllAnalyses(): ReadonlyArray<SelfAnalysis> {
    return [...this.analyses.values()];
  }

  generateInsight(type: MetaCognitionInsight["type"], message: string, confidence: number, evidence: ReadonlyArray<string>, actionability: MetaCognitionInsight["actionability"]): MetaCognitionInsight {
    const insight: MetaCognitionInsight = {
      id: `mi_${++insightCounter}`,
      type,
      message,
      confidence,
      evidence,
      actionability,
      timestamp: Date.now(),
    };
    this.insights.set(insight.id, insight);
    return insight;
  }

  getInsights(): ReadonlyArray<MetaCognitionInsight> {
    return [...this.insights.values()];
  }

  getRecentInsights(count: number): ReadonlyArray<MetaCognitionInsight> {
    return [...this.insights.values()]
      .sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id))
      .slice(0, count);
  }

  getStrengths(): ReadonlyArray<SelfAnalysis> {
    return [...this.analyses.values()].filter((a) => a.quality > 7);
  }

  getWeaknesses(): ReadonlyArray<SelfAnalysis> {
    return [...this.analyses.values()].filter((a) => a.quality > 0 && a.quality < 4);
  }
}
