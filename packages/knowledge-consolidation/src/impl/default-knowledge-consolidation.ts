import type { KnowledgeConsolidation } from "../interfaces/knowledge-consolidation.js";
import type { Knowledge, KnowledgeType } from "@ai-agent/evo-types";

export class DefaultKnowledgeConsolidation implements KnowledgeConsolidation {
  private knowledge: Map<string, Knowledge> = new Map();
  private counter = 0;

  add(type: KnowledgeType, content: string, confidence: number, source: string, tags: ReadonlyArray<string> = []): Knowledge {
    const id = `kn_${++this.counter}`;
    const now = Date.now();
    const item: Knowledge = {
      id,
      type,
      content,
      confidence,
      strength: 1.0,
      accessCount: 0,
      lastAccessed: now,
      source,
      decayRate: 0.01,
      createdAt: now,
      tags,
      relatedIds: [],
      composedFrom: [],
    };
    this.knowledge.set(id, item);
    return item;
  }

  get(knowledgeId: string): Knowledge | null {
    return this.knowledge.get(knowledgeId) ?? null;
  }

  getAll(): ReadonlyArray<Knowledge> {
    return Array.from(this.knowledge.values());
  }

  getByType(type: KnowledgeType): ReadonlyArray<Knowledge> {
    return Array.from(this.knowledge.values()).filter((k) => k.type === type);
  }

  search(query: string): ReadonlyArray<Knowledge> {
    const lower = query.toLowerCase();
    return Array.from(this.knowledge.values()).filter(
      (k) => k.content.toLowerCase().includes(lower) || k.tags.some((t) => t.toLowerCase().includes(lower)),
    );
  }

  access(knowledgeId: string): void {
    const item = this.knowledge.get(knowledgeId);
    if (!item) throw new Error(`Knowledge not found: ${knowledgeId}`);
    this.knowledge.set(knowledgeId, {
      ...item,
      accessCount: item.accessCount + 1,
      lastAccessed: Date.now(),
      strength: Math.min(10, item.strength + 0.1),
    });
  }

  strengthen(knowledgeId: string, amount: number): void {
    const item = this.knowledge.get(knowledgeId);
    if (!item) throw new Error(`Knowledge not found: ${knowledgeId}`);
    this.knowledge.set(knowledgeId, {
      ...item,
      strength: Math.min(10, item.strength + amount),
    });
  }

  decay(decayRate: number = 0.01): number {
    let count = 0;
    for (const [id, item] of this.knowledge) {
      if (item.strength > 0) {
        const newStrength = Math.max(0, item.strength - decayRate);
        this.knowledge.set(id, { ...item, strength: newStrength });
        count++;
      }
    }
    return count;
  }

  merge(knowledgeIds: ReadonlyArray<string>, mergedContent: string): Knowledge {
    if (knowledgeIds.length === 0) throw new Error("At least one knowledge ID is required");

    let type: KnowledgeType = "fact";
    let confidence = 0;
    let source = "";
    const allTags: string[] = [];
    const relatedIds: string[] = [];

    for (const kid of knowledgeIds) {
      const item = this.knowledge.get(kid);
      if (!item) throw new Error(`Knowledge not found: ${kid}`);
      type = item.type;
      confidence = Math.max(confidence, item.confidence);
      source = item.source;
      allTags.push(...item.tags);
      relatedIds.push(kid);
    }

    const id = `kn_${++this.counter}`;
    const now = Date.now();
    const merged: Knowledge = {
      id,
      type,
      content: mergedContent,
      confidence,
      strength: 1.0,
      accessCount: 0,
      lastAccessed: now,
      source,
      decayRate: 0.01,
      createdAt: now,
      tags: [...new Set(allTags)],
      relatedIds,
      composedFrom: knowledgeIds,
    };
    this.knowledge.set(id, merged);
    return merged;
  }

  archive(knowledgeId: string): void {
    const item = this.knowledge.get(knowledgeId);
    if (!item) throw new Error(`Knowledge not found: ${knowledgeId}`);
    this.knowledge.set(knowledgeId, { ...item, strength: 0 });
  }

  getStrongest(count: number): ReadonlyArray<Knowledge> {
    return Array.from(this.knowledge.values())
      .sort((a, b) => b.strength - a.strength)
      .slice(0, count);
  }

  getWeakest(count: number): ReadonlyArray<Knowledge> {
    return Array.from(this.knowledge.values())
      .sort((a, b) => a.strength - b.strength)
      .slice(0, count);
  }

  count(): number {
    return this.knowledge.size;
  }
}
