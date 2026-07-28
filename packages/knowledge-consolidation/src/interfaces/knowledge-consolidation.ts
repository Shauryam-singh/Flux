import type { Knowledge, KnowledgeType } from "@ai-agent/evo-types";

export interface KnowledgeConsolidation {
  add(type: KnowledgeType, content: string, confidence: number, source: string, tags?: ReadonlyArray<string>): Knowledge;
  get(knowledgeId: string): Knowledge | null;
  getAll(): ReadonlyArray<Knowledge>;
  getByType(type: KnowledgeType): ReadonlyArray<Knowledge>;
  search(query: string): ReadonlyArray<Knowledge>;
  access(knowledgeId: string): void;
  strengthen(knowledgeId: string, amount: number): void;
  decay(decayRate?: number): number;
  merge(knowledgeIds: ReadonlyArray<string>, mergedContent: string): Knowledge;
  archive(knowledgeId: string): void;
  getStrongest(count: number): ReadonlyArray<Knowledge>;
  getWeakest(count: number): ReadonlyArray<Knowledge>;
  count(): number;
}
