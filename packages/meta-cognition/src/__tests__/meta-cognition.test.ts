import { describe, it, expect, beforeEach } from "vitest";
import { DefaultMetaCognitionEngine } from "../impl/default-meta-cognition.js";

describe("DefaultMetaCognitionEngine", () => {
  let engine: DefaultMetaCognitionEngine;

  beforeEach(() => {
    engine = new DefaultMetaCognitionEngine();
  });

  it("should analyze and return self-analysis with prefixed id", () => {
    const analysis = engine.analyze("reasoning", "d1", "Test desc", "Test reasoning");
    expect(analysis.id).toMatch(/^mc_/);
    expect(analysis.category).toBe("reasoning");
    expect(analysis.decisionId).toBe("d1");
    expect(analysis.description).toBe("Test desc");
    expect(analysis.reasoning).toBe("Test reasoning");
    expect(analysis.quality).toBe(0);
    expect(analysis.improvements).toEqual([]);
    expect(analysis.alternatives).toEqual([]);
    expect(analysis.context).toEqual({});
  });

  it("should store context when provided", () => {
    const ctx = { key: "value" };
    const analysis = engine.analyze("planning", "d2", "desc", "reasoning", ctx);
    expect(analysis.context).toEqual(ctx);
  });

  it("should retrieve analysis by id", () => {
    const analysis = engine.analyze("delegation", "d3", "desc", "reasoning");
    expect(engine.getAnalysis(analysis.id)).toEqual(analysis);
  });

  it("should return null for nonexistent analysis", () => {
    expect(engine.getAnalysis("nonexistent")).toBeNull();
  });

  it("should filter by category", () => {
    engine.analyze("reasoning", "d1", "d", "r");
    engine.analyze("planning", "d2", "d", "r");
    engine.analyze("reasoning", "d3", "d", "r");
    expect(engine.getAnalysesByCategory("reasoning")).toHaveLength(2);
    expect(engine.getAnalysesByCategory("planning")).toHaveLength(1);
    expect(engine.getAnalysesByCategory("prediction")).toHaveLength(0);
  });

  it("should return all analyses", () => {
    engine.analyze("reasoning", "d1", "d", "r");
    engine.analyze("planning", "d2", "d", "r");
    expect(engine.getAllAnalyses()).toHaveLength(2);
  });

  it("should generate insight with prefixed id", () => {
    const insight = engine.generateInsight("pattern", "msg", 0.8, ["e1"], "high");
    expect(insight.id).toMatch(/^mi_/);
    expect(insight.type).toBe("pattern");
    expect(insight.message).toBe("msg");
    expect(insight.confidence).toBe(0.8);
    expect(insight.evidence).toEqual(["e1"]);
    expect(insight.actionability).toBe("high");
  });

  it("should retrieve all insights", () => {
    engine.generateInsight("pattern", "m1", 0.8, [], "high");
    engine.generateInsight("anomaly", "m2", 0.6, [], "low");
    expect(engine.getInsights()).toHaveLength(2);
  });

  it("should return recent insights sorted by timestamp", () => {
    engine.generateInsight("pattern", "m1", 0.8, [], "high");
    engine.generateInsight("anomaly", "m2", 0.6, [], "low");
    engine.generateInsight("recommendation", "m3", 0.9, [], "medium");
    const recent = engine.getRecentInsights(2);
    expect(recent).toHaveLength(2);
    expect(recent[0]!.message).toBe("m3");
    expect(recent[1]!.message).toBe("m2");
  });

  it("should identify strengths (quality > 7)", () => {
    const a1 = engine.analyze("reasoning", "d1", "d", "r");
    const a2 = engine.analyze("planning", "d2", "d", "r");
    const a3 = engine.analyze("delegation", "d3", "d", "r");
    (engine as unknown as { analyses: Map<string, { quality: number }> }).analyses.get(a1.id)!.quality = 8;
    (engine as unknown as { analyses: Map<string, { quality: number }> }).analyses.get(a2.id)!.quality = 5;
    (engine as unknown as { analyses: Map<string, { quality: number }> }).analyses.get(a3.id)!.quality = 9;
    expect(engine.getStrengths()).toHaveLength(2);
  });

  it("should identify weaknesses (0 < quality < 4)", () => {
    const a1 = engine.analyze("reasoning", "d1", "d", "r");
    const a2 = engine.analyze("planning", "d2", "d", "r");
    const a3 = engine.analyze("delegation", "d3", "d", "r");
    (engine as unknown as { analyses: Map<string, { quality: number }> }).analyses.get(a1.id)!.quality = 2;
    (engine as unknown as { analyses: Map<string, { quality: number }> }).analyses.get(a2.id)!.quality = 5;
    (engine as unknown as { analyses: Map<string, { quality: number }> }).analyses.get(a3.id)!.quality = 0;
    expect(engine.getWeaknesses()).toHaveLength(1);
    expect(engine.getWeaknesses()[0]!.id).toBe(a1.id);
  });
});
