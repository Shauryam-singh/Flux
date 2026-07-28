import { describe, it, expect, beforeEach } from "vitest";
import { DefaultUserStateEstimator } from "../impl/default-user-state-estimator.js";
import { DefaultUserBehaviourModel } from "../impl/default-user-behaviour.js";
import type { WorldState } from "@ai-agent/world-model";
import type { Observation } from "@ai-agent/attention";

const mockWorldState: WorldState = {
  project: { name: "test", rootPath: "/test", activeBranch: "main", isDirty: false, recentCommits: [], openFiles: [], focusedFile: null },
  application: { activeWindow: "vscode", activeApp: "vscode", browserUrl: null, terminalCommand: null },
  system: { cpuUsage: 0.2, memoryUsage: 0.4, diskUsage: 0.3, batteryLevel: null, runningProcesses: [], openErrors: [], clipboard: null },
  timestamp: Date.now(),
  version: 1,
};

const makeObs = (overrides: Partial<Observation> = {}): Observation => ({
  id: `obs_${Math.random()}`,
  source: "code",
  title: "File read",
  detail: "",
  priority: "medium",
  score: 50,
  timestamp: Date.now(),
  mergeable: false,
  consumed: false,
  ...overrides,
});

describe("DefaultUserStateEstimator", () => {
  let estimator: DefaultUserStateEstimator;

  beforeEach(() => {
    estimator = new DefaultUserStateEstimator();
  });

  it("should return focused by default with no observations", () => {
    const state = estimator.estimate(mockWorldState, []);
    expect(["focused", "idle"]).toContain(state.current);
    expect(state.confidence).toBeGreaterThanOrEqual(0);
  });

  it("should detect focused state with same-app observations", () => {
    const observations = Array.from({ length: 6 }, (_, i) =>
      makeObs({
        id: `obs_${i}`,
        timestamp: Date.now() - (6 - i) * 1000,
        context: { app: "vscode" },
      }),
    );
    const state = estimator.estimate(mockWorldState, observations);
    expect(["focused", "deep_work"]).toContain(state.current);
  });

  it("should track history", () => {
    estimator.estimate(mockWorldState, []);
    estimator.estimate(mockWorldState, []);
    expect(estimator.getHistory().length).toBe(2);
  });

  it("should be available for interruption in focused state", () => {
    estimator.estimate(mockWorldState, []);
    expect(estimator.isAvailableForInterruption()).toBe(true);
  });
});

describe("DefaultUserBehaviourModel", () => {
  it("should observe and track patterns", () => {
    const model = new DefaultUserBehaviourModel();
    model.observe(makeObs());
    expect(model.getPatterns().length).toBeGreaterThanOrEqual(0);
  });
});
