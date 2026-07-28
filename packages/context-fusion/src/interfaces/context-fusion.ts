import type { FusedObservation } from "@ai-agent/ambient-types";
import type { Observation } from "@ai-agent/attention";

export interface ContextFusionEngine {
  fuse(observations: ReadonlyArray<Observation>): FusedObservation;
  fuseBatch(observations: ReadonlyArray<Observation>): ReadonlyArray<FusedObservation>;
  getRecentFusions(count: number): ReadonlyArray<FusedObservation>;
  getStats(): {
    totalFused: number;
    averageSourcesPerFusion: number;
    deduplicationRate: number;
  };
}

export interface FusionRule {
  readonly name: string;
  readonly match: (observations: ReadonlyArray<Observation>) => boolean;
  readonly merge: (observations: ReadonlyArray<Observation>) => FusedObservation;
  readonly priority: number;
}

export interface ContextFusionConfig {
  readonly enabled: boolean;
  readonly deduplicationWindowMs: number;
  readonly minSourcesForFusion: number;
  readonly maxFusionAge: number;
}
