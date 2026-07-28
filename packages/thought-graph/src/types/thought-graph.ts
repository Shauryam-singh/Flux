/**
 * Thought Graph Types
 *
 * A thought graph is a directed acyclic graph where:
 * - Nodes are ThoughtNodes with evidence, confidence, counterarguments
 * - Edges are ThoughtEdges linking related thoughts
 * - Each thought can be traced back to the observations that spawned it
 *
 * This enables Flux to explain: "I suggested X because I noticed Y, Z, W"
 */

// ─── Evidence ──────────────────────────────────────────────────────

export interface Evidence {
  readonly id: string;
  readonly observationId: string;
  readonly source: string;
  readonly content: string;
  readonly strength: number; // 0-1, how strongly this supports the thought
  readonly timestamp: number;
}

// ─── Counterargument ───────────────────────────────────────────────

export interface Counterargument {
  readonly id: string;
  readonly content: string;
  readonly strength: number; // 0-1, how much this weakens the thought
  readonly relatedEvidenceId: string | null;
}

// ─── Confidence Record ─────────────────────────────────────────────

export interface ConfidenceRecord {
  readonly value: number; // 0-1
  readonly reason: string;
  readonly timestamp: number;
}

// ─── Thought Node ──────────────────────────────────────────────────

export type ThoughtNodeType =
  | "observation_interpretation"  // "The build failed 3 times — something is broken"
  | "pattern_recognition"         // "User always switches to browser after errors"
  | "prediction"                  // "User will likely ask me to fix the build"
  | "suggestion"                  // "I should proactively offer to fix the error"
  | "concern"                     // "Memory usage is climbing steadily"
  | "goal_evaluation"             // "The deployment goal is blocked by test failures"
  | "reflection"                  // "I've been too talkative — user prefers quiet"
  | "insight"                     // "The compiler error is in the same file as the last 3"
  | "user_intent"                 // "User wants me to be proactive, not reactive"
  | "opportunity";                // "I notice the user is idle — good time to suggest refactoring"

export interface ThoughtNode {
  readonly id: string;
  readonly type: ThoughtNodeType;
  readonly content: string;
  readonly reasoning: string;
  readonly confidence: ConfidenceRecord;
  readonly evidence: ReadonlyArray<Evidence>;
  readonly counterarguments: ReadonlyArray<Counterargument>;
  readonly relatedThoughtIds: ReadonlyArray<string>;
  readonly observationIds: ReadonlyArray<string>;
  readonly goalId: string | null;
  readonly timestamp: number;
  readonly expiresAt: number | null; // null = never expires
  readonly metadata: Record<string, unknown>;
}

// ─── Thought Edge ──────────────────────────────────────────────────

export type EdgeType =
  | "supports"      // Thought A provides evidence for Thought B
  | "contradicts"   // Thought A weakens Thought B
  | "extends"       // Thought B is a deeper analysis of Thought A
  | "refines"       // Thought B is a more specific version of Thought A
  | "follows"       // Thought B naturally follows from Thought A
  | "alternative";  // Thought B is an alternative to Thought A

export interface ThoughtEdge {
  readonly id: string;
  readonly fromId: string;
  readonly toId: string;
  readonly type: EdgeType;
  readonly strength: number; // 0-1, how strong the relationship is
  readonly timestamp: number;
}

// ─── Thought Graph ─────────────────────────────────────────────────

export interface ThoughtGraphSnapshot {
  readonly nodes: ReadonlyArray<ThoughtNode>;
  readonly edges: ReadonlyArray<ThoughtEdge>;
  readonly nodeCount: number;
  readonly edgeCount: number;
}

// ─── Explanation ───────────────────────────────────────────────────

export interface ThoughtExplanation {
  readonly thoughtId: string;
  readonly mainThought: string;
  readonly evidenceChain: ReadonlyArray<{
    readonly observation: string;
    readonly interpretation: string;
    readonly strength: number;
  }>;
  readonly counterarguments: ReadonlyArray<string>;
  readonly confidenceReasoning: string;
  readonly relatedThoughts: ReadonlyArray<string>;
  readonly timestamp: number;
}

// ─── Pipeline Stage Types ──────────────────────────────────────────

export interface MergedObservations {
  readonly observations: ReadonlyArray<{
    readonly id: string;
    readonly source: string;
    readonly title: string;
    readonly detail: string;
    readonly score: number;
    readonly timestamp: number;
  }>;
  readonly patterns: ReadonlyArray<{
    readonly type: string;
    readonly description: string;
    readonly count: number;
  }>;
  readonly summary: string;
}

export interface GoalEvaluation {
  readonly activeGoals: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly progress: number;
    readonly blockers: ReadonlyArray<string>;
    readonly nextStep: string | null;
  }>;
  readonly stalledGoals: ReadonlyArray<string>;
  readonly completedGoals: ReadonlyArray<string>;
}

export interface UserIntentPrediction {
  readonly primaryIntent: string;
  readonly confidence: number;
  readonly reasoning: string;
  readonly relatedGoals: ReadonlyArray<string>;
  readonly urgency: "none" | "low" | "medium" | "high";
}

export interface Opportunity {
  readonly id: string;
  readonly type: "refactoring" | "learning" | "optimization" | "prevention" | "automation";
  readonly description: string;
  readonly reasoning: string;
  readonly confidence: number;
  readonly relatedThoughtIds: ReadonlyArray<string>;
}

export interface CognitionResult {
  readonly tickNumber: number;
  readonly timestamp: number;
  readonly durationMs: number;
  readonly stages: ReadonlyArray<{
    readonly name: string;
    readonly durationMs: number;
    readonly result: unknown;
  }>;
  readonly thoughts: ReadonlyArray<ThoughtNode>;
  readonly edges: ReadonlyArray<ThoughtEdge>;
  readonly opportunities: ReadonlyArray<Opportunity>;
  readonly userIntent: UserIntentPrediction;
  readonly selectedAction: {
    readonly type: string;
    readonly reasoning: string;
    readonly confidence: number;
  } | null;
  readonly explanation: ThoughtExplanation | null;
  readonly graphSize: {
    readonly nodes: number;
    readonly edges: number;
  };
}
