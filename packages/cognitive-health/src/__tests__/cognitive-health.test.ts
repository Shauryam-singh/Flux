import { describe, it, expect, beforeEach } from "vitest";
import { DefaultCognitiveHealthMonitor } from "../impl/default-cognitive-health.js";
import type { CognitiveHealthMonitor } from "../interfaces/cognitive-health.js";

describe("DefaultCognitiveHealthMonitor", () => {
  let monitor: CognitiveHealthMonitor;

  beforeEach(() => {
    monitor = new DefaultCognitiveHealthMonitor();
  });

  it("should record a metric", () => {
    monitor.recordMetric("memory_size", 5000);
    expect(monitor.getHistory("memory_size")).toHaveLength(1);
    expect(monitor.getHistory("memory_size")[0]!.value).toBe(5000);
  });

  it("should return healthy status when no metrics recorded", () => {
    expect(monitor.getStatus().overall).toBe("healthy");
  });

  it("should return warning status when metric exceeds warning threshold", () => {
    monitor.recordMetric("memory_size", 15000);
    expect(monitor.getStatus().overall).toBe("warning");
  });

  it("should return critical status when metric exceeds critical threshold", () => {
    monitor.recordMetric("memory_size", 60000);
    expect(monitor.getStatus().overall).toBe("critical");
  });

  it("should return metric status", () => {
    monitor.recordMetric("reasoning_latency", 3000);
    expect(monitor.getMetricStatus("reasoning_latency")?.status).toBe("normal");
    monitor.recordMetric("reasoning_latency", 6000);
    expect(monitor.getMetricStatus("reasoning_latency")?.status).toBe("warning");
  });

  it("should return null for metric with no history", () => {
    expect(monitor.getMetricStatus("memory_size")).toBeNull();
  });

  it("should create alerts when thresholds are breached", () => {
    monitor.recordMetric("prediction_accuracy", 0.8);
    expect(monitor.getAlerts()).toHaveLength(0);
    monitor.recordMetric("prediction_accuracy", 0.6);
    expect(monitor.getAlerts()).toHaveLength(1);
    expect(monitor.getAlerts()[0]!.severity).toBe("warning");
  });

  it("should get alerts by severity", () => {
    monitor.recordMetric("goal_success_rate", 0.3);
    expect(monitor.getAlertsBySeverity("critical")).toHaveLength(1);
    expect(monitor.getAlertsBySeverity("warning")).toHaveLength(0);
  });

  it("should clear alerts", () => {
    monitor.recordMetric("memory_size", 60000);
    expect(monitor.getAlerts()).toHaveLength(1);
    monitor.clearAlerts();
    expect(monitor.getAlerts()).toHaveLength(0);
  });

  it("should return stable trend with insufficient data", () => {
    monitor.recordMetric("memory_size", 1000);
    expect(monitor.getTrend("memory_size")).toBe("stable");
  });

  it("should return trend based on recent values", () => {
    for (let i = 0; i < 5; i++) {
      monitor.recordMetric("reasoning_latency", 1000 + i * 100);
    }
    for (let i = 0; i < 5; i++) {
      monitor.recordMetric("reasoning_latency", 2000 + i * 100);
    }
    expect(monitor.getTrend("reasoning_latency")).toBe("declining");
  });

  it("should return recommendations for unhealthy metrics", () => {
    monitor.recordMetric("memory_size", 60000);
    monitor.recordMetric("reasoning_latency", 25000);
    const recommendations = monitor.getRecommendations();
    expect(recommendations.length).toBeGreaterThan(0);
  });

  it("should return empty recommendations when healthy", () => {
    monitor.recordMetric("memory_size", 5000);
    expect(monitor.getRecommendations()).toHaveLength(0);
  });
});
