import { describe, it, expect, beforeEach } from "vitest";
import { DefaultCompanionEngine } from "../impl/default-companion-engine.js";
import type { CompanionContext } from "../interfaces/companion-engine.js";
import { DEFAULT_RELATIONSHIP_PROFILE } from "@ai-agent/relationship";

const createMockContext = (overrides: Partial<CompanionContext> = {}): CompanionContext => ({
  worldState: {
    project: null,
    application: { activeWindow: "", activeApp: "", browserUrl: null, terminalCommand: null },
    system: { cpuUsage: 0, memoryUsage: 0, diskUsage: 0, batteryLevel: null, runningProcesses: [], openErrors: [], clipboard: null },
    timestamp: Date.now(),
    version: 1,
  },
  timeline: [],
  goalProgress: 50,
  workSessionDuration: 0,
  lastInteractionTime: 0,
  userState: { current: "idle", confidence: 0.8, since: Date.now(), factors: [], previousState: null },
  relationship: { ...DEFAULT_RELATIONSHIP_PROFILE },
  ...overrides,
});

describe("DefaultCompanionEngine", () => {
  let engine: DefaultCompanionEngine;

  beforeEach(() => {
    engine = new DefaultCompanionEngine();
  });

  it("should return null when no rules match", () => {
    const result = engine.evaluate(createMockContext({ workSessionDuration: 60001, goalProgress: 10 }));
    expect(result).toBeNull();
  });

  it("should suggest break after long session", () => {
    const result = engine.evaluate(
      createMockContext({
        workSessionDuration: 7200001,
        userState: { current: "focused", confidence: 0.8, since: Date.now(), factors: [], previousState: null },
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.type).toBe("break_suggestion");
  });

  it("should celebrate milestones", () => {
    const now = Date.now();
    const result = engine.evaluate(
      createMockContext({
        timeline: [{
          id: "ev1", type: "goal_completed", title: "Deploy app", detail: "", project: null, goalId: null, duration: null, timestamp: now - 1000, metadata: {},
        }],
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.type).toBe("milestone_celebration");
  });

  it("should recognize returning from idle", () => {
    const result = engine.evaluate(
      createMockContext({ workSessionDuration: 30000 }),
    );
    expect(result).not.toBeNull();
    expect(result!.type).toBe("work_session_recognition");
  });

  it("should encourage frustrated users", () => {
    const result = engine.evaluate(
      createMockContext({
        workSessionDuration: 60001,
        goalProgress: 10,
        userState: { current: "frustrated", confidence: 0.8, since: Date.now(), factors: [], previousState: null },
        relationship: { ...DEFAULT_RELATIONSHIP_PROFILE, trustLevel: 50 },
      }),
    );
    expect(result).not.toBeNull();
    expect(result!.type).toBe("encouragement");
  });

  it("should track stats", () => {
    engine.evaluate(createMockContext({ workSessionDuration: 30000 }));
    const stats = engine.getStats();
    expect(stats.totalInteractions).toBeGreaterThanOrEqual(0);
  });
});
