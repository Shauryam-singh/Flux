import type {
  BaseMemory,
  MemoryType,
  MemoryQuery,
  MemoryQueryResult,
  MemoryStats,
  SemanticMemory,
  EpisodicMemory,
  ProceduralMemory,
  RelationshipMemory,
  ProjectMemory,
  TimelineMemory,
  ReflectionMemory,
} from "../types/memory.js";

export interface MemoryManager {
  // ─── Store ────────────────────────────────────────────────────
  store(memory: Omit<BaseMemory, "id" | "timestamp" | "lastAccessed" | "accessCount">): BaseMemory;
  storeSemantic(memory: Omit<SemanticMemory, "id" | "timestamp" | "lastAccessed" | "accessCount">): SemanticMemory;
  storeEpisodic(memory: Omit<EpisodicMemory, "id" | "timestamp" | "lastAccessed" | "accessCount">): EpisodicMemory;
  storeProcedural(memory: Omit<ProceduralMemory, "id" | "timestamp" | "lastAccessed" | "accessCount">): ProceduralMemory;
  storeRelationship(memory: Omit<RelationshipMemory, "id" | "timestamp" | "lastAccessed" | "accessCount">): RelationshipMemory;
  storeProject(memory: Omit<ProjectMemory, "id" | "timestamp" | "lastAccessed" | "accessCount">): ProjectMemory;
  storeTimeline(memory: Omit<TimelineMemory, "id" | "timestamp" | "lastAccessed" | "accessCount">): TimelineMemory;
  storeReflection(memory: Omit<ReflectionMemory, "id" | "timestamp" | "lastAccessed" | "accessCount">): ReflectionMemory;

  // ─── Retrieve ─────────────────────────────────────────────────
  get(id: string): BaseMemory | null;
  query(query: MemoryQuery): MemoryQueryResult;
  getSemantic(filter?: { domain?: string; category?: string; subject?: string }): ReadonlyArray<SemanticMemory>;
  getEpisodic(filter?: { category?: string; participants?: string; location?: string }): ReadonlyArray<EpisodicMemory>;
  getProcedural(filter?: { category?: string; name?: string }): ReadonlyArray<ProceduralMemory>;
  getRelationship(filter?: { category?: string; attribute?: string }): ReadonlyArray<RelationshipMemory>;
  getProject(filter?: { projectName?: string; category?: string; component?: string }): ReadonlyArray<ProjectMemory>;
  getTimeline(filter?: { category?: string; significance?: number }): ReadonlyArray<TimelineMemory>;
  getReflection(filter?: { category?: string; verified?: boolean }): ReadonlyArray<ReflectionMemory>;

  // ─── Update ───────────────────────────────────────────────────
  access(id: string): BaseMemory | null;
  strengthen(id: string, amount: number): BaseMemory | null;
  decay(id: string, amount: number): BaseMemory | null;
  update(id: string, changes: Partial<Pick<BaseMemory, "content" | "strength" | "confidence" | "tags">>): BaseMemory | null;
  link(id1: string, id2: string): void;

  // ─── Consolidation ────────────────────────────────────────────
  consolidate(): ConsolidationResult;
  merge(memories: ReadonlyArray<string>): BaseMemory | null;
  prune(maxAge: number, minStrength: number): number;

  // ─── Stats ────────────────────────────────────────────────────
  getStats(): MemoryStats;
  reset(): void;
}

export interface ConsolidationResult {
  readonly merged: number;
  readonly pruned: number;
  readonly strengthened: number;
  readonly decayed: number;
  readonly promoted: number; // memories moved to longer-term storage
  readonly timestamp: number;
}
