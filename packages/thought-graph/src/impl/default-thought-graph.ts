import type {
  ThoughtNode,
  ThoughtEdge,
  ThoughtGraphSnapshot,
  ThoughtExplanation,
  ThoughtNodeType,
  Evidence,
  Counterargument,
} from "../types/thought-graph.js";
import type { ThoughtGraph, ThoughtNodeFilter } from "../interfaces/thought-graph.js";

let nodeCounter = 0;
let edgeCounter = 0;

export class DefaultThoughtGraph implements ThoughtGraph {
  private nodes: Map<string, ThoughtNode> = new Map();
  private edges: Map<string, ThoughtEdge> = new Map();
  private nodeIndex: Map<ThoughtNodeType, Set<string>> = new Map();
  private goalIndex: Map<string, Set<string>> = new Map();

  // ─── Node Operations ──────────────────────────────────────────

  addNode(node: Omit<ThoughtNode, "id" | "timestamp">): ThoughtNode {
    const id = `tn_${Date.now()}_${++nodeCounter}`;
    const full: ThoughtNode = { ...node, id, timestamp: Date.now() };

    this.nodes.set(id, full);

    // Index by type
    if (!this.nodeIndex.has(full.type)) {
      this.nodeIndex.set(full.type, new Set());
    }
    this.nodeIndex.get(full.type)!.add(id);

    // Index by goal
    if (full.goalId) {
      if (!this.goalIndex.has(full.goalId)) {
        this.goalIndex.set(full.goalId, new Set());
      }
      this.goalIndex.get(full.goalId)!.add(id);
    }

    return full;
  }

  getNode(id: string): ThoughtNode | null {
    return this.nodes.get(id) ?? null;
  }

  updateNode(id: string, changes: Partial<Pick<ThoughtNode, "confidence" | "content" | "reasoning" | "expiresAt">>): ThoughtNode | null {
    const node = this.nodes.get(id);
    if (!node) return null;

    const updated: ThoughtNode = { ...node, ...changes };
    this.nodes.set(id, updated);
    return updated;
  }

  deleteNode(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node) return false;

    // Remove from indexes
    this.nodeIndex.get(node.type)?.delete(id);
    if (node.goalId) {
      this.goalIndex.get(node.goalId)?.delete(id);
    }

    // Remove connected edges
    for (const edgeId of this.edges.keys()) {
      const edge = this.edges.get(edgeId)!;
      if (edge.fromId === id || edge.toId === id) {
        this.edges.delete(edgeId);
      }
    }

    return this.nodes.delete(id);
  }

  queryNodes(filter: ThoughtNodeFilter): ReadonlyArray<ThoughtNode> {
    let results: ThoughtNode[] = [];

    if (filter.type) {
      const ids = this.nodeIndex.get(filter.type);
      if (ids) {
        results = [...ids].map((id) => this.nodes.get(id)!).filter(Boolean);
      }
    } else {
      results = [...this.nodes.values()];
    }

    if (filter.minConfidence !== undefined) {
      results = results.filter((n) => n.confidence.value >= filter.minConfidence!);
    }

    if (filter.maxAge !== undefined) {
      const cutoff = Date.now() - filter.maxAge!;
      results = results.filter((n) => n.timestamp >= cutoff);
    }

    if (filter.goalId) {
      results = results.filter((n) => n.goalId === filter.goalId);
    }

    if (filter.observationId) {
      results = results.filter((n) => n.observationIds.includes(filter.observationId!));
    }

    // Sort by confidence descending, then by timestamp descending
    results.sort((a, b) => {
      const confDiff = b.confidence.value - a.confidence.value;
      if (confDiff !== 0) return confDiff;
      return b.timestamp - a.timestamp;
    });

    if (filter.limit !== undefined) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  // ─── Edge Operations ──────────────────────────────────────────

  addEdge(edge: Omit<ThoughtEdge, "id" | "timestamp">): ThoughtEdge {
    const id = `te_${Date.now()}_${++edgeCounter}`;
    const full: ThoughtEdge = { ...edge, id, timestamp: Date.now() };
    this.edges.set(id, full);
    return full;
  }

  getEdge(id: string): ThoughtEdge | null {
    return this.edges.get(id) ?? null;
  }

  deleteEdge(id: string): boolean {
    return this.edges.delete(id);
  }

  getOutgoingEdges(nodeId: string): ReadonlyArray<ThoughtEdge> {
    return [...this.edges.values()].filter((e) => e.fromId === nodeId);
  }

  getIncomingEdges(nodeId: string): ReadonlyArray<ThoughtEdge> {
    return [...this.edges.values()].filter((e) => e.toId === nodeId);
  }

  // ─── Graph Analysis ───────────────────────────────────────────

  getSupportingThoughts(thoughtId: string): ReadonlyArray<ThoughtNode> {
    const edgeIds = [...this.edges.values()]
      .filter((e) => e.toId === thoughtId && e.type === "supports")
      .map((e) => e.fromId);
    return edgeIds.map((id) => this.nodes.get(id)!).filter(Boolean);
  }

  getContradictingThoughts(thoughtId: string): ReadonlyArray<ThoughtNode> {
    const edgeIds = [...this.edges.values()]
      .filter((e) => e.toId === thoughtId && e.type === "contradicts")
      .map((e) => e.fromId);
    return edgeIds.map((id) => this.nodes.get(id)!).filter(Boolean);
  }

  getThoughtChain(thoughtId: string): ReadonlyArray<ThoughtNode> {
    const chain: ThoughtNode[] = [];
    const visited = new Set<string>();
    const queue = [thoughtId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const node = this.nodes.get(current);
      if (node) {
        chain.push(node);

        // Follow "supports" and "follows" edges backwards
        const incoming = [...this.edges.values()]
          .filter((e) => e.toId === current && (e.type === "supports" || e.type === "follows"))
          .map((e) => e.fromId);

        queue.push(...incoming);
      }
    }

    return chain;
  }

  getStrongestThoughts(limit: number): ReadonlyArray<ThoughtNode> {
    return [...this.nodes.values()]
      .sort((a, b) => b.confidence.value - a.confidence.value)
      .slice(0, limit);
  }

  getRecentThoughts(limit: number): ReadonlyArray<ThoughtNode> {
    return [...this.nodes.values()]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  getThoughtsByType(type: ThoughtNodeType): ReadonlyArray<ThoughtNode> {
    const ids = this.nodeIndex.get(type);
    if (!ids) return [];
    return [...ids].map((id) => this.nodes.get(id)!).filter(Boolean);
  }

  // ─── Explanation ──────────────────────────────────────────────

  explain(thoughtId: string): ThoughtExplanation {
    const node = this.nodes.get(thoughtId);
    if (!node) {
      return {
        thoughtId,
        mainThought: "Thought not found",
        evidenceChain: [],
        counterarguments: [],
        confidenceReasoning: "No thought found",
        relatedThoughts: [],
        timestamp: Date.now(),
      };
    }

    // Build evidence chain from supporting thoughts
    const supporting = this.getSupportingThoughts(thoughtId);
    const evidenceChain = supporting.map((s) => ({
      observation: s.content,
      interpretation: s.reasoning,
      strength: s.confidence.value,
    }));

    // Also include direct evidence
    for (const evidence of node.evidence) {
      evidenceChain.push({
        observation: evidence.content,
        interpretation: `Directly observed from ${evidence.source}`,
        strength: evidence.strength,
      });
    }

    // Get counterarguments
    const counterarguments = node.counterarguments.map((c) => c.content);

    // Also get contradicting thoughts
    const contradicting = this.getContradictingThoughts(thoughtId);
    for (const c of contradicting) {
      counterarguments.push(c.content);
    }

    // Get related thoughts
    const related = [...node.relatedThoughtIds];
    for (const edge of this.edges.values()) {
      if (edge.fromId === thoughtId) related.push(edge.toId);
      if (edge.toId === thoughtId) related.push(edge.fromId);
    }

    return {
      thoughtId,
      mainThought: node.content,
      evidenceChain,
      counterarguments,
      confidenceReasoning: node.confidence.reason,
      relatedThoughts: [...new Set(related)],
      timestamp: node.timestamp,
    };
  }

  explainDecision(decisionType: string, evidence: ReadonlyArray<string>): ThoughtExplanation {
    const relatedNodes = evidence
      .map((id) => this.nodes.get(id))
      .filter((n): n is ThoughtNode => n !== null && n !== undefined);

    const evidenceChain = relatedNodes.map((n) => ({
      observation: n.content,
      interpretation: n.reasoning,
      strength: n.confidence.value,
    }));

    const avgConfidence = relatedNodes.length > 0
      ? relatedNodes.reduce((sum, n) => sum + n.confidence.value, 0) / relatedNodes.length
      : 0;

    return {
      thoughtId: `decision_${Date.now()}`,
      mainThought: `Decision: ${decisionType}`,
      evidenceChain,
      counterarguments: [],
      confidenceReasoning: `Based on ${relatedNodes.length} supporting thoughts with average confidence ${avgConfidence.toFixed(2)}`,
      relatedThoughts: relatedNodes.map((n) => n.id),
      timestamp: Date.now(),
    };
  }

  // ─── Pruning ──────────────────────────────────────────────────

  pruneExpired(): number {
    const now = Date.now();
    let count = 0;
    for (const [id, node] of this.nodes) {
      if (node.expiresAt !== null && node.expiresAt < now) {
        this.deleteNode(id);
        count++;
      }
    }
    return count;
  }

  pruneWeak(minConfidence: number): number {
    let count = 0;
    for (const [id, node] of this.nodes) {
      if (node.confidence.value < minConfidence) {
        this.deleteNode(id);
        count++;
      }
    }
    return count;
  }

  prune(maxAge: number): number {
    const cutoff = Date.now() - maxAge;
    let count = 0;
    for (const [id, node] of this.nodes) {
      if (node.timestamp < cutoff) {
        this.deleteNode(id);
        count++;
      }
    }
    return count;
  }

  // ─── Snapshot ─────────────────────────────────────────────────

  snapshot(): ThoughtGraphSnapshot {
    const nodes = [...this.nodes.values()];
    const edges = [...this.edges.values()];
    return {
      nodes,
      edges,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    };
  }

  reset(): void {
    this.nodes.clear();
    this.edges.clear();
    this.nodeIndex.clear();
    this.goalIndex.clear();
  }
}
