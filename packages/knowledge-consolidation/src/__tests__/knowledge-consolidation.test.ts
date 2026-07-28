import { describe, it, expect } from "vitest";
import { DefaultKnowledgeConsolidation } from "../impl/default-knowledge-consolidation.js";

describe("DefaultKnowledgeConsolidation", () => {
  it("should add knowledge with generated id and initial strength", () => {
    const kc = new DefaultKnowledgeConsolidation();
    const k = kc.add("fact", "TypeScript is strongly typed", 0.9, "docs", ["typescript"]);
    expect(k.id).toMatch(/^kn_/);
    expect(k.type).toBe("fact");
    expect(k.content).toBe("TypeScript is strongly typed");
    expect(k.confidence).toBe(0.9);
    expect(k.strength).toBe(1.0);
    expect(k.source).toBe("docs");
    expect(k.tags).toEqual(["typescript"]);
    expect(k.composedFrom).toEqual([]);
  });

  it("should add knowledge without tags", () => {
    const kc = new DefaultKnowledgeConsolidation();
    const k = kc.add("fact", "content", 0.5, "source");
    expect(k.tags).toEqual([]);
  });

  it("should get knowledge by id", () => {
    const kc = new DefaultKnowledgeConsolidation();
    const k = kc.add("fact", "content", 0.5, "source");
    expect(kc.get(k.id)).not.toBeNull();
    expect(kc.get(k.id)!.id).toBe(k.id);
  });

  it("should return null for nonexistent knowledge", () => {
    const kc = new DefaultKnowledgeConsolidation();
    expect(kc.get("nonexistent")).toBeNull();
  });

  it("should get all knowledge", () => {
    const kc = new DefaultKnowledgeConsolidation();
    kc.add("fact", "a", 0.5, "s");
    kc.add("preference", "b", 0.5, "s");
    expect(kc.getAll()).toHaveLength(2);
  });

  it("should get knowledge by type", () => {
    const kc = new DefaultKnowledgeConsolidation();
    kc.add("fact", "a", 0.5, "s");
    kc.add("fact", "b", 0.5, "s");
    kc.add("preference", "c", 0.5, "s");
    expect(kc.getByType("fact")).toHaveLength(2);
    expect(kc.getByType("preference")).toHaveLength(1);
    expect(kc.getByType("procedure")).toHaveLength(0);
  });

  it("should search knowledge by content", () => {
    const kc = new DefaultKnowledgeConsolidation();
    kc.add("fact", "TypeScript is great", 0.5, "s");
    kc.add("fact", "Python is versatile", 0.5, "s");
    const results = kc.search("TypeScript");
    expect(results).toHaveLength(1);
    expect(results[0]!.content).toBe("TypeScript is great");
  });

  it("should search knowledge by tags", () => {
    const kc = new DefaultKnowledgeConsolidation();
    kc.add("fact", "content", 0.5, "s", ["typescript", "coding"]);
    kc.add("fact", "other", 0.5, "s", ["python"]);
    expect(kc.search("typescript")).toHaveLength(1);
    expect(kc.search("coding")).toHaveLength(1);
  });

  it("should access knowledge and increment stats", () => {
    const kc = new DefaultKnowledgeConsolidation();
    const k = kc.add("fact", "content", 0.5, "s");
    kc.access(k.id);
    kc.access(k.id);
    const accessed = kc.get(k.id)!;
    expect(accessed.accessCount).toBe(2);
    expect(accessed.strength).toBeCloseTo(1.2);
  });

  it("should throw when accessing nonexistent knowledge", () => {
    const kc = new DefaultKnowledgeConsolidation();
    expect(() => kc.access("nonexistent")).toThrow("Knowledge not found");
  });

  it("should strengthen knowledge capped at 10", () => {
    const kc = new DefaultKnowledgeConsolidation();
    const k = kc.add("fact", "content", 0.5, "s");
    kc.strengthen(k.id, 5);
    expect(kc.get(k.id)!.strength).toBe(6);
    kc.strengthen(k.id, 100);
    expect(kc.get(k.id)!.strength).toBe(10);
  });

  it("should throw when strengthening nonexistent knowledge", () => {
    const kc = new DefaultKnowledgeConsolidation();
    expect(() => kc.strengthen("nonexistent", 1)).toThrow("Knowledge not found");
  });

  it("should decay all knowledge and return count", () => {
    const kc = new DefaultKnowledgeConsolidation();
    kc.add("fact", "a", 0.5, "s");
    kc.add("fact", "b", 0.5, "s");
    const count = kc.decay(0.01);
    expect(count).toBe(2);
    const items = kc.getAll();
    expect(items[0]!.strength).toBeCloseTo(0.99);
    expect(items[1]!.strength).toBeCloseTo(0.99);
  });

  it("should not decay already-zero strength knowledge", () => {
    const kc = new DefaultKnowledgeConsolidation();
    const k = kc.add("fact", "a", 0.5, "s");
    kc.archive(k.id);
    const count = kc.decay(0.01);
    expect(count).toBe(0);
  });

  it("should merge multiple knowledge items", () => {
    const kc = new DefaultKnowledgeConsolidation();
    const k1 = kc.add("fact", "A is true", 0.8, "src1", ["a"]);
    const k2 = kc.add("fact", "B is true", 0.6, "src2", ["b"]);

    const merged = kc.merge([k1.id, k2.id], "A and B are true");
    expect(merged.id).toMatch(/^kn_/);
    expect(merged.content).toBe("A and B are true");
    expect(merged.composedFrom).toEqual([k1.id, k2.id]);
    expect(merged.confidence).toBe(0.8);
    expect(merged.tags).toEqual(["a", "b"]);
    expect(merged.strength).toBe(1.0);
  });

  it("should throw when merging with empty array", () => {
    const kc = new DefaultKnowledgeConsolidation();
    expect(() => kc.merge([], "content")).toThrow("At least one knowledge ID is required");
  });

  it("should throw when merging nonexistent knowledge", () => {
    const kc = new DefaultKnowledgeConsolidation();
    expect(() => kc.merge(["nonexistent"], "content")).toThrow("Knowledge not found");
  });

  it("should archive knowledge by setting strength to 0", () => {
    const kc = new DefaultKnowledgeConsolidation();
    const k = kc.add("fact", "content", 0.5, "s");
    kc.archive(k.id);
    expect(kc.get(k.id)!.strength).toBe(0);
  });

  it("should throw when archiving nonexistent knowledge", () => {
    const kc = new DefaultKnowledgeConsolidation();
    expect(() => kc.archive("nonexistent")).toThrow("Knowledge not found");
  });

  it("should get strongest knowledge sorted desc", () => {
    const kc = new DefaultKnowledgeConsolidation();
    const k1 = kc.add("fact", "weak", 0.5, "s");
    const k2 = kc.add("fact", "strong", 0.5, "s");
    kc.strengthen(k2.id, 5);
    const strongest = kc.getStrongest(2);
    expect(strongest[0]!.id).toBe(k2.id);
    expect(strongest[1]!.id).toBe(k1.id);
  });

  it("should get weakest knowledge sorted asc", () => {
    const kc = new DefaultKnowledgeConsolidation();
    const k1 = kc.add("fact", "weak", 0.5, "s");
    const k2 = kc.add("fact", "strong", 0.5, "s");
    kc.strengthen(k2.id, 5);
    const weakest = kc.getWeakest(2);
    expect(weakest[0]!.id).toBe(k1.id);
    expect(weakest[1]!.id).toBe(k2.id);
  });

  it("should count knowledge items", () => {
    const kc = new DefaultKnowledgeConsolidation();
    expect(kc.count()).toBe(0);
    kc.add("fact", "a", 0.5, "s");
    expect(kc.count()).toBe(1);
    kc.add("fact", "b", 0.5, "s");
    expect(kc.count()).toBe(2);
  });
});
