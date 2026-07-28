import type { HealthStatus, HealthMetric, HealthMetricStatus, HealthAlert } from "@ai-agent/evo-types";

export interface CognitiveHealthMonitor {
  recordMetric(metric: HealthMetric, value: number): void;
  getStatus(): HealthStatus;
  getMetricStatus(metric: HealthMetric): HealthMetricStatus | null;
  getAlerts(): ReadonlyArray<HealthAlert>;
  getAlertsBySeverity(severity: HealthAlert["severity"]): ReadonlyArray<HealthAlert>;
  getRecommendations(): ReadonlyArray<string>;
  getTrend(metric: HealthMetric): "improving" | "stable" | "declining";
  clearAlerts(): void;
  getHistory(metric: HealthMetric): ReadonlyArray<{ value: number; timestamp: number }>;
}
