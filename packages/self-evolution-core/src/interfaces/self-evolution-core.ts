import type { SelfEvolutionConfig, HealthStatus, EvaluationReport } from "@ai-agent/evo-types";

export interface SelfEvolutionCore {
  configure(config: Partial<SelfEvolutionConfig>): void;
  getConfig(): SelfEvolutionConfig;
  getHealth(): HealthStatus;
  runHealthCheck(): HealthStatus;
  getRecentEvaluations(count?: number): ReadonlyArray<EvaluationReport>;
  getStatus(): {
    readonly totalExperiences: number;
    readonly totalKnowledge: number;
    readonly totalSkills: number;
    readonly totalWorkflows: number;
    readonly totalStrategies: number;
    readonly healthOverall: "healthy" | "degraded" | "critical";
  };
  consolidate(): number;
  tick(): void;
}
