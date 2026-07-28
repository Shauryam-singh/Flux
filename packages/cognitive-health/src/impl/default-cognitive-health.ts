import type { HealthStatus, HealthMetric, HealthMetricStatus, HealthAlert } from "@ai-agent/evo-types";
import type { CognitiveHealthMonitor } from "../interfaces/cognitive-health.js";

let alertCounter = 0;

interface ThresholdConfig {
  warningThreshold: number;
  criticalThreshold: number;
  direction: "higher-is-worse" | "lower-is-worse";
}

const THRESHOLDS: Record<HealthMetric, ThresholdConfig> = {
  memory_size: { warningThreshold: 10000, criticalThreshold: 50000, direction: "higher-is-worse" },
  reasoning_latency: { warningThreshold: 5000, criticalThreshold: 20000, direction: "higher-is-worse" },
  prediction_accuracy: { warningThreshold: 0.7, criticalThreshold: 0.5, direction: "lower-is-worse" },
  goal_success_rate: { warningThreshold: 0.5, criticalThreshold: 0.3, direction: "lower-is-worse" },
  agent_performance: { warningThreshold: 0.5, criticalThreshold: 0.3, direction: "lower-is-worse" },
  resource_usage: { warningThreshold: 80, criticalThreshold: 95, direction: "higher-is-worse" },
  knowledge_freshness: { warningThreshold: 0.5, criticalThreshold: 0.3, direction: "lower-is-worse" },
  calibration_error: { warningThreshold: 0.2, criticalThreshold: 0.5, direction: "higher-is-worse" },
};

function evaluateMetricStatus(metric: HealthMetric, value: number): "normal" | "warning" | "critical" {
  const config = THRESHOLDS[metric];
  if (config.direction === "higher-is-worse") {
    if (value >= config.criticalThreshold) return "critical";
    if (value >= config.warningThreshold) return "warning";
  } else {
    if (value <= config.criticalThreshold) return "critical";
    if (value <= config.warningThreshold) return "warning";
  }
  return "normal";
}

export class DefaultCognitiveHealthMonitor implements CognitiveHealthMonitor {
  private metrics: Map<HealthMetric, Array<{ value: number; timestamp: number }>> = new Map();
  private alerts: HealthAlert[] = [];
  private alertedMetrics: Set<string> = new Set();

  recordMetric(metric: HealthMetric, value: number): void {
    const history = this.metrics.get(metric) ?? [];
    history.push({ value, timestamp: Date.now() });
    this.metrics.set(metric, history);

    const status = evaluateMetricStatus(metric, value);
    if (status !== "normal" && !this.alertedMetrics.has(metric)) {
      this.alertedMetrics.add(metric);
      const config = THRESHOLDS[metric];
      const severity: HealthAlert["severity"] = status === "critical" ? "critical" : "warning";
      this.alerts.push({
        id: `ha_${++alertCounter}`,
        metric,
        severity,
        message: `Metric ${metric} has breached ${severity} threshold`,
        timestamp: Date.now(),
        recommendation: `Review and address ${metric} ${severity} condition`,
      });
    }
  }

  getStatus(): HealthStatus {
    let overall: "healthy" | "warning" | "critical" = "healthy";
    const metricStatuses: HealthMetricStatus[] = [];

    for (const [metric, history] of this.metrics) {
      if (history.length === 0) continue;
      const latest = history[history.length - 1]!;
      const status = evaluateMetricStatus(metric, latest.value);
      metricStatuses.push({
        metric,
        value: latest.value,
        status,
        trend: this.getTrend(metric),
        threshold: THRESHOLDS[metric].warningThreshold,
      });
      if (status === "critical") overall = "critical";
      else if (status === "warning" && overall !== "critical") overall = "warning";
    }

    return {
      overall,
      metrics: metricStatuses,
      alerts: this.alerts,
      recommendations: this.getRecommendations(),
      timestamp: Date.now(),
    };
  }

  getMetricStatus(metric: HealthMetric): HealthMetricStatus | null {
    const history = this.metrics.get(metric);
    if (!history || history.length === 0) return null;
    const latest = history[history.length - 1]!;
    return {
      metric,
      value: latest.value,
      status: evaluateMetricStatus(metric, latest.value),
      trend: this.getTrend(metric),
      threshold: THRESHOLDS[metric].warningThreshold,
    };
  }

  getAlerts(): ReadonlyArray<HealthAlert> {
    return this.alerts;
  }

  getAlertsBySeverity(severity: HealthAlert["severity"]): ReadonlyArray<HealthAlert> {
    return this.alerts.filter((a) => a.severity === severity);
  }

  getRecommendations(): ReadonlyArray<string> {
    const recommendations: string[] = [];
    for (const [metric, history] of this.metrics) {
      if (history.length === 0) continue;
      const latest = history[history.length - 1]!;
      const status = evaluateMetricStatus(metric, latest.value);
      if (status === "warning") {
        recommendations.push(`Investigate elevated ${metric} levels`);
      } else if (status === "critical") {
        recommendations.push(`Urgently address critical ${metric} levels`);
      }
    }
    return recommendations;
  }

  getTrend(metric: HealthMetric): "improving" | "stable" | "declining" {
    const history = this.metrics.get(metric);
    if (!history || history.length < 2) return "stable";

    const mid = Math.floor(history.length / 2);
    const olderHalf = history.slice(0, mid);
    const recentHalf = history.slice(mid);

    if (olderHalf.length === 0 || recentHalf.length === 0) return "stable";

    const olderAvg = olderHalf.reduce((sum, h) => sum + h.value, 0) / olderHalf.length;
    const recentAvg = recentHalf.reduce((sum, h) => sum + h.value, 0) / recentHalf.length;

    if (recentAvg > olderAvg) return "declining";
    if (recentAvg < olderAvg) return "improving";
    return "stable";
  }

  clearAlerts(): void {
    this.alerts = [];
    this.alertedMetrics.clear();
  }

  getHistory(metric: HealthMetric): ReadonlyArray<{ value: number; timestamp: number }> {
    return this.metrics.get(metric) ?? [];
  }
}
