import type {
  ThoughtNode,
  ThoughtEdge,
  ThoughtGraphSnapshot,
  ThoughtExplanation,
  ThoughtNodeType,
  EdgeType,
  Evidence,
  Counterargument,
} from "../types/thought-graph.js";

export interface ThoughtGraph {
  // ─── Node Operations ──────────────────────────────────────────
  addNode(node: Omit<ThoughtNode, "id" | "timestamp">): ThoughtNode;
  getNode(id: string): ThoughtNode | null;
  updateNode(id: string, changes: Partial<Pick<ThoughtNode, "confidence" | "content" | "reasoning" | "expiresAt">>): ThoughtNode | null;
  deleteNode(id: string): boolean;
  queryNodes(filter: ThoughtNodeFilter): ReadonlyArray<ThoughtNode>;

  // ─── Edge Operations ──────────────────────────────────────────
  addEdge(edge: Omit<ThoughtEdge, "id" | "timestamp">): ThoughtEdge;
  getEdge(id: string): ThoughtEdge | null;
  deleteEdge(id: string): boolean;
  getOutgoingEdges(nodeId: string): ReadonlyArray<ThoughtEdge>;
  getIncomingEdges(nodeId: string): ReadonlyArray<ThoughtEdge>;

  // ─── Graph Analysis ───────────────────────────────────────────
  getSupportingThoughts(thoughtId: string): ReadonlyArray<ThoughtNode>;
  getContradictingThoughts(thoughtId: string): ReadonlyArray<ThoughtNode>;
  getThoughtChain(thoughtId: string): ReadonlyArray<ThoughtNode>;
  getStrongestThoughts(limit: number): ReadonlyArray<ThoughtNode>;
  getRecentThoughts(limit: number): ReadonlyArray<ThoughtNode>;
  getThoughtsByType(type: ThoughtNodeType): ReadonlyArray<ThoughtNode>;

  // ─── Explanation ──────────────────────────────────────────────
  explain(thoughtId: string): ThoughtExplanation;
  explainDecision(decisionType: string, evidence: ReadonlyArray<string>): ThoughtExplanation;

  // ─── Pruning ──────────────────────────────────────────────────
  pruneExpired(): number;
  pruneWeak(minConfidence: number): number;
  prune(maxAge: number): number;

  // ─── Snapshot ─────────────────────────────────────────────────
  snapshot(): ThoughtGraphSnapshot;
  reset(): void;
}

export interface ThoughtNodeFilter {
  type?: ThoughtNodeType;
  minConfidence?: number;
  maxAge?: number;
  goalId?: string;
  observationId?: string;
  limit?: number;
}
