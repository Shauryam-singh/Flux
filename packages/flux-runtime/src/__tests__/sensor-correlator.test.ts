import { describe, it, expect } from "vitest";
import { SensorCorrelator } from "../impl/sensor-correlator.js";

describe("SensorCorrelator", () => {
  it("should detect docker + IDE correlation", () => {
    const correlator = new SensorCorrelator();
    const correlations = correlator.analyze({
      docker: {
        recentEvents: [{ type: "die", containerName: "api", image: "node:18" }],
        runningCount: 3,
      },
      window: { app: "vscode", title: "api/index.ts", isCoding: true },
    });

    expect(correlations.length).toBeGreaterThan(0);
    const dockerCorr = correlations.find((c) => c.id === "docker_ide_correlation");
    expect(dockerCorr).toBeDefined();
    expect(dockerCorr!.priority).toBe("high");
    expect(dockerCorr!.insight).toContain("api");
  });

  it("should detect CPU + coding correlation", () => {
    const correlator = new SensorCorrelator();
    const correlations = correlator.analyze({
      "system-health": { cpuUsagePercent: 85 },
      window: { isCoding: true },
    });

    const cpuCorr = correlations.find((c) => c.id === "cpu_coding_correlation");
    expect(cpuCorr).toBeDefined();
    expect(cpuCorr!.confidence).toBeGreaterThan(0.5);
  });

  it("should detect git dirty + idle correlation", () => {
    const correlator = new SensorCorrelator();
    const correlations = correlator.analyze({
      git: { isDirty: true, branch: "main" },
      idle: { isIdle: true, idleSeconds: 600 },
    });

    const gitCorr = correlations.find((c) => c.id === "git_idle_correlation");
    expect(gitCorr).toBeDefined();
    expect(gitCorr!.insight).toContain("uncommitted");
  });

  it("should not duplicate correlations within TTL", () => {
    const correlator = new SensorCorrelator();
    const snapshots = {
      git: { isDirty: true, branch: "main" },
      idle: { isIdle: true, idleSeconds: 600 },
    };

    const first = correlator.analyze(snapshots);
    const second = correlator.analyze(snapshots);

    const firstIds = first.map((c) => c.id);
    const secondIds = second.map((c) => c.id);
    const overlap = firstIds.filter((id) => secondIds.includes(id));
    expect(overlap.length).toBe(0);
  });

  it("should return recent correlations", () => {
    const correlator = new SensorCorrelator();
    correlator.analyze({
      docker: { recentEvents: [{ type: "die", containerName: "web", image: "nginx" }] },
      window: { isCoding: true },
    });

    const recent = correlator.getRecent(5);
    expect(recent.length).toBeGreaterThan(0);
  });

  it("should handle empty snapshots gracefully", () => {
    const correlator = new SensorCorrelator();
    const correlations = correlator.analyze({});
    expect(correlations).toEqual([]);
  });

  it("should detect memory + docker correlation", () => {
    const correlator = new SensorCorrelator();
    const correlations = correlator.analyze({
      "system-health": { memoryUsagePercent: 85 },
      docker: { runningCount: 8 },
    });

    const memCorr = correlations.find((c) => c.id === "memory_docker_correlation");
    expect(memCorr).toBeDefined();
    expect(memCorr!.priority).toBe("high");
  });

  it("should detect battery + coding correlation", () => {
    const correlator = new SensorCorrelator();
    const correlations = correlator.analyze({
      battery: { level: 10, isCharging: false },
      window: { isCoding: true },
    });

    const batCorr = correlations.find((c) => c.id === "battery_coding_correlation");
    expect(batCorr).toBeDefined();
    expect(batCorr!.priority).toBe("high");
  });
});
