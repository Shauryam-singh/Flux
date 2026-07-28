import type { ContextFusionEngine, FusionRule, ContextFusionConfig } from "../interfaces/context-fusion.js";
import type { FusedObservation } from "@ai-agent/ambient-types";
import type { Observation } from "@ai-agent/attention";

const DEFAULT_CONFIG: ContextFusionConfig = {
  enabled: true,
  deduplicationWindowMs: 10000,
  minSourcesForFusion: 2,
  maxFusionAge: 60000,
};

const BUILD_FAILURE_RULE: FusionRule = {
  name: "build_failure",
  match: (obs) => obs.some((o) => o.title.toLowerCase().includes("build") && o.title.toLowerCase().includes("fail")),
  merge: (obs) => ({
    id: `fus_${Date.now()}`,
    timestamp: Date.now(),
    sources: obs.map((o) => o.source),
    semanticSummary: `Build failed: ${obs[0]?.title ?? "unknown"}`,
    confidence: 0.9,
    priority: "high" as const,
    category: "error" as const,
    actionable: true,
    context: { type: "build_failure", observations: obs.map((o) => o.id) },
    relatedGoalIds: [],
    deduplicationKey: "build_failure",
  }),
  priority: 10,
};

const ERROR_CORRELATION_RULE: FusionRule = {
  name: "error_correlation",
  match: (obs) => obs.filter((o) => o.source === "terminal" || o.source === "code").length >= 2,
  merge: (obs) => ({
    id: `fus_${Date.now()}`,
    timestamp: Date.now(),
    sources: obs.map((o) => o.source),
    semanticSummary: `Multiple errors detected across ${obs.length} sources`,
    confidence: 0.8,
    priority: "high" as const,
    category: "error" as const,
    actionable: true,
    context: { type: "error_correlation", observationCount: obs.length },
    relatedGoalIds: [],
    deduplicationKey: "error_correlation",
  }),
  priority: 20,
};

const CONTEXT_CHANGE_RULE: FusionRule = {
  name: "context_change",
  match: (obs) => obs.some((o) => o.source === "screen") && obs.some((o) => o.source === "code"),
  merge: (obs) => ({
    id: `fus_${Date.now()}`,
    timestamp: Date.now(),
    sources: obs.map((o) => o.source),
    semanticSummary: "Context switched between screen and code",
    confidence: 0.7,
    priority: "medium" as const,
    category: "context_change" as const,
    actionable: false,
    context: { type: "context_change" },
    relatedGoalIds: [],
    deduplicationKey: "context_change",
  }),
  priority: 30,
};

const DEFAULT_RULES: FusionRule[] = [BUILD_FAILURE_RULE, ERROR_CORRELATION_RULE, CONTEXT_CHANGE_RULE];

export class DefaultContextFusionEngine implements ContextFusionEngine {
  private config: ContextFusionConfig;
  private rules: FusionRule[];
  private recentFusions: FusedObservation[] = [];
  private idCounter = 0;
  private totalFused = 0;
  private totalDeduplicated = 0;

  constructor(config?: Partial<ContextFusionConfig>, rules?: FusionRule[]) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rules = rules ?? DEFAULT_RULES;
  }

  fuse(observations: ReadonlyArray<Observation>): FusedObservation {
    const sorted = [...this.rules].sort((a, b) => a.priority - b.priority);

    for (const rule of sorted) {
      if (rule.match(observations)) {
        const fusion = rule.merge(observations);
        this.recentFusions.push(fusion);
        this.totalFused++;
        if (this.recentFusions.length > this.config.maxFusionAge) {
          this.recentFusions = this.recentFusions.slice(-100);
        }
        return fusion;
      }
    }

    const fallback: FusedObservation = {
      id: `fus_${++this.idCounter}`,
      timestamp: Date.now(),
      sources: observations.map((o) => o.source),
      semanticSummary: observations.map((o) => o.title).join("; "),
      confidence: observations.reduce((sum, o) => sum + (o.score / 100), 0) / observations.length,
      priority: this.mapPriority(observations),
      category: "context_change",
      actionable: observations.some((o) => o.score > 70),
      context: { observationCount: observations.length },
      relatedGoalIds: [],
      deduplicationKey: `fallback_${observations.map((o) => o.source).sort().join("_")}`,
    };

    this.recentFusions.push(fallback);
    this.totalFused++;
    return fallback;
  }

  fuseBatch(observations: ReadonlyArray<Observation>): ReadonlyArray<FusedObservation> {
    const groups = this.groupObservations(observations);
    return groups.map((group) => this.fuse(group));
  }

  getRecentFusions(count: number): ReadonlyArray<FusedObservation> {
    return this.recentFusions.slice(-count);
  }

  getStats() {
    return {
      totalFused: this.totalFused,
      averageSourcesPerFusion: this.recentFusions.length > 0
        ? this.recentFusions.reduce((sum, f) => sum + f.sources.length, 0) / this.recentFusions.length
        : 0,
      deduplicationRate: this.totalFused > 0 ? this.totalDeduplicated / this.totalFused : 0,
    };
  }

  private groupObservations(observations: ReadonlyArray<Observation>): ReadonlyArray<ReadonlyArray<Observation>> {
    const groups = new Map<string, Observation[]>();
    for (const obs of observations) {
      const key = obs.source;
      const existing = groups.get(key) ?? [];
      existing.push(obs);
      groups.set(key, existing);
    }
    return Array.from(groups.values());
  }

  private mapPriority(observations: ReadonlyArray<Observation>): FusedObservation["priority"] {
    const maxScore = Math.max(...observations.map((o) => o.score));
    if (maxScore >= 80) return "high";
    if (maxScore >= 60) return "medium";
    if (maxScore >= 40) return "low";
    return "background";
  }
}
