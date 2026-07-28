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
import type { MemoryManager, ConsolidationResult } from "../interfaces/memory-manager.js";

let memoryCounter = 0;

export class DefaultMemoryManager implements MemoryManager {
  private memories: Map<string, BaseMemory> = new Map();
  private typeIndex: Map<MemoryType, Set<string>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private consolidationCount = 0;
  private readonly maxMemories: number;

  constructor(maxMemories = 1000) {
    this.maxMemories = maxMemories;
  }

  // ─── Store ────────────────────────────────────────────────────

  store(memory: Omit<BaseMemory, "id" | "timestamp" | "lastAccessed" | "accessCount">): BaseMemory {
    const now = Date.now();
    const full: BaseMemory = {
      ...memory,
      id: `mem_${memory.type}_${++memoryCounter}`,
      timestamp: now,
      lastAccessed: now,
      accessCount: 0,
    };

    this.addMemory(full);
    return full;
  }

  storeSemantic(memory: Omit<SemanticMemory, "id" | "timestamp" | "lastAccessed" | "accessCount">): SemanticMemory {
    return this.store(memory) as SemanticMemory;
  }

  storeEpisodic(memory: Omit<EpisodicMemory, "id" | "timestamp" | "lastAccessed" | "accessCount">): EpisodicMemory {
    return this.store(memory) as EpisodicMemory;
  }

  storeProcedural(memory: Omit<ProceduralMemory, "id" | "timestamp" | "lastAccessed" | "accessCount">): ProceduralMemory {
    return this.store(memory) as ProceduralMemory;
  }

  storeRelationship(memory: Omit<RelationshipMemory, "id" | "timestamp" | "lastAccessed" | "accessCount">): RelationshipMemory {
    return this.store(memory) as RelationshipMemory;
  }

  storeProject(memory: Omit<ProjectMemory, "id" | "timestamp" | "lastAccessed" | "accessCount">): ProjectMemory {
    return this.store(memory) as ProjectMemory;
  }

  storeTimeline(memory: Omit<TimelineMemory, "id" | "timestamp" | "lastAccessed" | "accessCount">): TimelineMemory {
    return this.store(memory) as TimelineMemory;
  }

  storeReflection(memory: Omit<ReflectionMemory, "id" | "timestamp" | "lastAccessed" | "accessCount">): ReflectionMemory {
    return this.store(memory) as ReflectionMemory;
  }

  // ─── Retrieve ─────────────────────────────────────────────────

  get(id: string): BaseMemory | null {
    const memory = this.memories.get(id);
    if (memory) {
      // Update access stats
      const updated = {
        ...memory,
        lastAccessed: Date.now(),
        accessCount: memory.accessCount + 1,
      };
      this.memories.set(id, updated);
      return updated;
    }
    return null;
  }

  query(query: MemoryQuery): MemoryQueryResult {
    const start = Date.now();
    let results: BaseMemory[] = [...this.memories.values()];

    // Filter by types
    if (query.types && query.types.length > 0) {
      const typeSet = new Set(query.types);
      results = results.filter((m) => typeSet.has(m.type));
    }

    // Filter by categories
    if (query.categories && query.categories.length > 0) {
      const catSet = new Set(query.categories);
      results = results.filter((m) => {
        const mem = m as unknown as Record<string, unknown>;
        return catSet.has(mem["category"] as string);
      });
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      const tagSet = new Set(query.tags);
      results = results.filter((m) => m.tags.some((t) => tagSet.has(t)));
    }

    // Filter by min strength
    if (query.minStrength !== undefined) {
      results = results.filter((m) => m.strength >= query.minStrength!);
    }

    // Filter by min confidence
    if (query.minConfidence !== undefined) {
      results = results.filter((m) => m.confidence >= query.minConfidence!);
    }

    // Filter by max age
    if (query.maxAge !== undefined) {
      const cutoff = Date.now() - query.maxAge!;
      results = results.filter((m) => m.timestamp >= cutoff);
    }

    // Free text search
    if (query.text) {
      const lower = query.text.toLowerCase();
      results = results.filter((m) => m.content.toLowerCase().includes(lower));
    }

    // Sort
    const sortBy = query.sortBy ?? "relevance";
    switch (sortBy) {
      case "strength":
        results.sort((a, b) => b.strength - a.strength);
        break;
      case "recency":
        results.sort((a, b) => b.timestamp - a.timestamp);
        break;
      case "accessCount":
        results.sort((a, b) => b.accessCount - a.accessCount);
        break;
      case "relevance":
      default:
        // Relevance = strength * confidence * recency factor
        results.sort((a, b) => {
          const scoreA = a.strength * a.confidence * (1 / (1 + (Date.now() - a.timestamp) / 3600000));
          const scoreB = b.strength * b.confidence * (1 / (1 + (Date.now() - b.timestamp) / 3600000));
          return scoreB - scoreA;
        });
    }

    // Limit
    const totalMatches = results.length;
    if (query.limit !== undefined) {
      results = results.slice(0, query.limit);
    }

    // Generate suggestions
    const suggestions = this.generateSuggestions(results);

    return {
      memories: results,
      totalMatches,
      queryTime: Date.now() - start,
      suggestions,
    };
  }

  getSemantic(filter?: { domain?: string; category?: string; subject?: string }): ReadonlyArray<SemanticMemory> {
    const ids = this.typeIndex.get("semantic");
    if (!ids) return [];
    let semantics = [...ids].map((id) => this.memories.get(id)).filter((m): m is SemanticMemory => m !== undefined && m !== null && m.type === "semantic");

    if (filter?.domain) semantics = semantics.filter((m) => m.domain === filter.domain);
    if (filter?.category) semantics = semantics.filter((m) => m.category === filter.category);
    if (filter?.subject) semantics = semantics.filter((m) => m.subject === filter.subject);

    return semantics;
  }

  getEpisodic(filter?: { category?: string; participants?: string; location?: string }): ReadonlyArray<EpisodicMemory> {
    const ids = this.typeIndex.get("episodic");
    if (!ids) return [];
    const episodics = [...ids].map((id) => this.memories.get(id)).filter((m): m is EpisodicMemory => m !== undefined && m !== null && m.type === "episodic");

    if (filter?.category) return episodics.filter((m) => m.category === filter.category);
    if (filter?.participants) return episodics.filter((m) => m.participants.includes(filter.participants!));
    if (filter?.location) return episodics.filter((m) => m.location === filter.location);

    return episodics;
  }

  getProcedural(filter?: { category?: string; name?: string }): ReadonlyArray<ProceduralMemory> {
    const ids = this.typeIndex.get("procedural");
    if (!ids) return [];
    const procedurels = [...ids].map((id) => this.memories.get(id)).filter((m): m is ProceduralMemory => m !== undefined && m !== null && m.type === "procedural");

    if (filter?.category) return procedurels.filter((m) => m.category === filter.category);
    if (filter?.name) return procedurels.filter((m) => m.name === filter.name);

    return procedurels;
  }

  getRelationship(filter?: { category?: string; attribute?: string }): ReadonlyArray<RelationshipMemory> {
    const ids = this.typeIndex.get("relationship");
    if (!ids) return [];
    const relationships = [...ids].map((id) => this.memories.get(id)).filter((m): m is RelationshipMemory => m !== undefined && m !== null && m.type === "relationship");

    if (filter?.category) return relationships.filter((m) => m.category === filter.category);
    if (filter?.attribute) return relationships.filter((m) => m.attribute === filter.attribute);

    return relationships;
  }

  getProject(filter?: { projectName?: string; category?: string; component?: string }): ReadonlyArray<ProjectMemory> {
    const ids = this.typeIndex.get("project");
    if (!ids) return [];
    const projects = [...ids].map((id) => this.memories.get(id)).filter((m): m is ProjectMemory => m !== undefined && m !== null && m.type === "project");

    if (filter?.projectName) return projects.filter((m) => m.projectName === filter.projectName);
    if (filter?.category) return projects.filter((m) => m.category === filter.category);
    if (filter?.component) return projects.filter((m) => m.component === filter.component);

    return projects;
  }

  getTimeline(filter?: { category?: string; significance?: number }): ReadonlyArray<TimelineMemory> {
    const ids = this.typeIndex.get("timeline");
    if (!ids) return [];
    const timelines = [...ids].map((id) => this.memories.get(id)).filter((m): m is TimelineMemory => m !== undefined && m !== null && m.type === "timeline");

    let results = timelines;
    if (filter?.category) results = results.filter((m) => m.category === filter.category);
    if (filter?.significance !== undefined) results = results.filter((m) => m.significance >= filter.significance!);

    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  getReflection(filter?: { category?: string; verified?: boolean }): ReadonlyArray<ReflectionMemory> {
    const ids = this.typeIndex.get("reflection");
    if (!ids) return [];
    const reflections = [...ids].map((id) => this.memories.get(id)).filter((m): m is ReflectionMemory => m !== undefined && m !== null && m.type === "reflection");

    if (filter?.category) return reflections.filter((m) => m.category === filter.category);
    if (filter?.verified !== undefined) return reflections.filter((m) => m.verifiedByExperience === filter.verified);

    return reflections;
  }

  // ─── Update ───────────────────────────────────────────────────

  access(id: string): BaseMemory | null {
    return this.get(id); // get() already updates access stats
  }

  strengthen(id: string, amount: number): BaseMemory | null {
    const memory = this.memories.get(id);
    if (!memory) return null;

    const updated = {
      ...memory,
      strength: Math.min(1, memory.strength + amount),
    };
    this.memories.set(id, updated);
    return updated;
  }

  decay(id: string, amount: number): BaseMemory | null {
    const memory = this.memories.get(id);
    if (!memory) return null;

    const updated = {
      ...memory,
      strength: Math.max(0, memory.strength - amount),
    };
    this.memories.set(id, updated);
    return updated;
  }

  update(id: string, changes: Partial<Pick<BaseMemory, "content" | "strength" | "confidence" | "tags">>): BaseMemory | null {
    const memory = this.memories.get(id);
    if (!memory) return null;

    const updated = { ...memory, ...changes };
    this.memories.set(id, updated);
    return updated;
  }

  link(id1: string, id2: string): void {
    const m1 = this.memories.get(id1);
    const m2 = this.memories.get(id2);
    if (!m1 || !m2) return;

    this.memories.set(id1, {
      ...m1,
      relatedIds: [...m1.relatedIds, id2],
    });
    this.memories.set(id2, {
      ...m2,
      relatedIds: [...m2.relatedIds, id1],
    });
  }

  // ─── Consolidation ────────────────────────────────────────────

  consolidate(): ConsolidationResult {
    const start = Date.now();
    let merged = 0;
    let pruned = 0;
    let strengthened = 0;
    let decayed = 0;
    let promoted = 0;

    // 1. Decay all memories slightly
    for (const [id, memory] of this.memories) {
      const age = Date.now() - memory.timestamp;
      const daysSinceAccess = (Date.now() - memory.lastAccessed) / 86400000;

      // Decay based on time since last access
      if (daysSinceAccess > 1) {
        const decayAmount = Math.min(0.01 * daysSinceAccess, 0.1);
        this.memories.set(id, {
          ...memory,
          strength: Math.max(0, memory.strength - decayAmount),
        });
        decayed++;
      }

      // Strengthen frequently accessed memories
      if (memory.accessCount > 5) {
        const boost = Math.min(0.05 * memory.accessCount, 0.2);
        this.memories.set(id, {
          ...memory,
          strength: Math.min(1, memory.strength + boost),
        });
        strengthened++;
      }

      // Promote very strong, old memories
      if (memory.strength > 0.8 && age > 86400000) {
        promoted++;
      }
    }

    // 2. Find and merge similar memories
    const semanticMemories = this.getSemantic();
    const mergedIds = new Set<string>();

    for (let i = 0; i < semanticMemories.length; i++) {
      for (let j = i + 1; j < semanticMemories.length; j++) {
        if (mergedIds.has(semanticMemories[i]!.id) || mergedIds.has(semanticMemories[j]!.id)) continue;

        if (this.shouldMerge(semanticMemories[i]!, semanticMemories[j]!)) {
          this.mergeMemories(semanticMemories[i]!.id, semanticMemories[j]!.id);
          mergedIds.add(semanticMemories[j]!.id);
          merged++;
        }
      }
    }

    // 3. Prune very weak memories
    pruned = this.prune(86400000 * 7, 0.1); // 7 days old, strength < 0.1

    this.consolidationCount++;

    return {
      merged,
      pruned,
      strengthened,
      decayed,
      promoted,
      timestamp: Date.now() - start,
    };
  }

  merge(memories: ReadonlyArray<string>): BaseMemory | null {
    if (memories.length < 2) return null;
    return this.mergeMemories(memories[0]!, memories[1]!);
  }

  prune(maxAge: number, minStrength: number): number {
    const cutoff = Date.now() - maxAge;
    let count = 0;
    for (const [id, memory] of this.memories) {
      if (memory.timestamp < cutoff && memory.strength < minStrength) {
        this.deleteMemory(id);
        count++;
      }
    }
    return count;
  }

  // ─── Stats ────────────────────────────────────────────────────

  getStats(): MemoryStats {
    const all = [...this.memories.values()];
    const byType: Record<MemoryType, number> = {
      semantic: 0,
      episodic: 0,
      procedural: 0,
      relationship: 0,
      project: 0,
      timeline: 0,
      reflection: 0,
    };

    for (const m of all) {
      byType[m.type]++;
    }

    const strengths = all.map((m) => m.strength);
    const confidences = all.map((m) => m.confidence);
    const timestamps = all.map((m) => m.timestamp);
    const accesses = all.map((m) => m.accessCount);

    return {
      totalMemories: all.length,
      byType,
      averageStrength: strengths.length > 0 ? strengths.reduce((a, b) => a + b, 0) / strengths.length : 0,
      averageConfidence: confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0,
      oldestMemory: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestMemory: timestamps.length > 0 ? Math.max(...timestamps) : 0,
      totalAccesses: accesses.reduce((a, b) => a + b, 0),
      consolidationEvents: this.consolidationCount,
    };
  }

  reset(): void {
    this.memories.clear();
    this.typeIndex.clear();
    this.tagIndex.clear();
    this.consolidationCount = 0;
  }

  // ─── Private Helpers ──────────────────────────────────────────

  private addMemory(memory: BaseMemory): void {
    // Enforce capacity
    if (this.memories.size >= this.maxMemories) {
      this.evictWeakest();
    }

    this.memories.set(memory.id, memory);

    // Update type index
    if (!this.typeIndex.has(memory.type)) {
      this.typeIndex.set(memory.type, new Set());
    }
    this.typeIndex.get(memory.type)!.add(memory.id);

    // Update tag index
    for (const tag of memory.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(memory.id);
    }
  }

  private deleteMemory(id: string): void {
    const memory = this.memories.get(id);
    if (!memory) return;

    this.typeIndex.get(memory.type)?.delete(id);
    for (const tag of memory.tags) {
      this.tagIndex.get(tag)?.delete(id);
    }
    this.memories.delete(id);
  }

  private evictWeakest(): void {
    let weakest: string | null = null;
    let weakestStrength = Infinity;

    for (const [id, memory] of this.memories) {
      if (memory.strength < weakestStrength) {
        weakestStrength = memory.strength;
        weakest = id;
      }
    }

    if (weakest) {
      this.deleteMemory(weakest);
    }
  }

  private shouldMerge(a: SemanticMemory, b: SemanticMemory): boolean {
    if (a.domain !== b.domain) return false;
    if (a.subject !== b.subject) return false;
    if (a.predicate !== b.predicate) return false;

    // Same subject + predicate = merge (keep stronger one)
    return true;
  }

  private mergeMemories(id1: string, id2: string): BaseMemory {
    const m1 = this.memories.get(id1)!;
    const m2 = this.memories.get(id2)!;

    const merged: BaseMemory = {
      ...m1,
      content: `${m1.content} | ${m2.content}`,
      strength: Math.max(m1.strength, m2.strength),
      confidence: Math.max(m1.confidence, m2.confidence),
      accessCount: m1.accessCount + m2.accessCount,
      relatedIds: [...new Set([...m1.relatedIds, id2])],
      tags: [...new Set([...m1.tags, ...m2.tags])],
    };

    this.deleteMemory(id2);
    this.memories.set(id1, merged);
    return merged;
  }

  private generateSuggestions(memories: ReadonlyArray<BaseMemory>): ReadonlyArray<string> {
    const suggestions: string[] = [];

    if (memories.length === 0) {
      suggestions.push("No memories match this query");
    }

    // Suggest based on memory types
    const types = new Set(memories.map((m) => m.type));
    if (types.has("semantic") && types.has("episodic")) {
      suggestions.push("Consider combining factual knowledge with recent experiences");
    }

    // Suggest based on strength
    const weak = memories.filter((m) => m.strength < 0.3);
    if (weak.length > 0) {
      suggestions.push(`${weak.length} memories are weak and may need reinforcement`);
    }

    // Suggest based on age
    const old = memories.filter((m) => Date.now() - m.timestamp > 86400000 * 7);
    if (old.length > 0) {
      suggestions.push(`${old.length} memories are older than a week and may be stale`);
    }

    return suggestions;
  }
}
