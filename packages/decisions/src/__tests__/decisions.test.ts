import { describe, it, expect, vi } from "vitest";
import { DefaultDecisionEngine } from "../impl/default-decision-engine.js";
import { DefaultInterruptController } from "../impl/default-interrupt-controller.js";
import type { DecisionContext } from "../interfaces/decision-engine.js";
import type { WorldState } from "@ai-agent/world-model";
import { DEFAULT_APPLICATION_STATE, DEFAULT_SYSTEM_STATE } from "@ai-agent/world-model";

function makeContext(overrides?: Partial<DecisionContext>): DecisionContext {
  return {
    worldState: {
      project: null,
      application: DEFAULT_APPLICATION_STATE,
      system: DEFAULT_SYSTEM_STATE,
      timestamp: Date.now(),
      version: 0,
    },
    memory: { entries: [], totalWeight: 0, capacity: 50, utilization: 0, timestamp: Date.now() },
    goals: [],
    thoughts: [],
    recentDecisions: [],
    userActive: false,
    ...overrides,
  };
}

describe("DefaultDecisionEngine", () => {
  it("should return silent when no thoughts", async () => {
    const engine = new DefaultDecisionEngine();
    const decision = await engine.decide(makeContext());
    expect(decision.action.type).toBe("silent");
  });

  it("should select action from thoughts", async () => {
    const engine = new DefaultDecisionEngine();
    const decision = await engine.decide(makeContext({
      thoughts: [{
        id: "t1",
        type: "concern",
        content: "Build failing",
        confidence: 0.9,
        reasoning: "Error detected",
        timestamp: Date.now(),
        relatedGoalId: null,
        relatedObservationIds: [],
        suggestedAction: {
          type: "speak",
          payload: { text: "Build failed" },
          confidence: 0.85,
          reasoning: "Error needs attention",
        },
      }],
    }));
    expect(decision.action.type).toBe("speak");
  });

  it("should generate action for blocked goals", async () => {
    const engine = new DefaultDecisionEngine();
    const decision = await engine.decide(makeContext({
      goals: [{
        id: "g1", title: "Test", description: "", status: "blocked", priority: 80,
        progress: 50, source: "user_request", parentGoalId: null, subGoalIds: [],
        blockers: [{ id: "b1", description: "blocked", severity: "high", detectedAt: Date.now(), resolvedAt: null }],
        dependencies: [], estimatedCompletion: null, createdAt: Date.now(), updatedAt: Date.now(), completedAt: null,
      }],
      thoughts: [{
        id: "t1", type: "goal_evaluation", content: "Goal blocked", confidence: 0.85,
        reasoning: "Blocked", timestamp: Date.now(), relatedGoalId: "g1",
        relatedObservationIds: [], suggestedAction: null,
      }],
    }));
    expect(decision.action.type).toBe("speak");
  });

  it("should track history", async () => {
    const engine = new DefaultDecisionEngine();
    await engine.decide(makeContext());
    await engine.decide(makeContext());
    expect(engine.getHistory()).toHaveLength(2);
  });

  it("should detect duplicates", () => {
    const engine = new DefaultDecisionEngine();
    const action = { type: "speak" as const, payload: { text: "hello" }, confidence: 0.8, reasoning: "test" };
    const recent = [{
      action, interrupts: true, interruptPriority: 80, reasoning: "", timestamp: Date.now(),
    }];
    expect(engine.isDuplicate(action, recent)).toBe(true);
  });
});

describe("DefaultInterruptController", () => {
  it("should interrupt for security issues", () => {
    const controller = new DefaultInterruptController();
    const action = { type: "tool" as const, payload: { command: "rm -rf /" }, confidence: 1, reasoning: "" };
    const worldState: WorldState = {
      project: null, application: DEFAULT_APPLICATION_STATE,
      system: DEFAULT_SYSTEM_STATE, timestamp: Date.now(), version: 0,
    };
    const result = controller.evaluate(action, worldState, controller.getPolicies());
    expect(result.shouldInterrupt).toBe(true);
    expect(result.priority).toBe(100);
  });

  it("should not interrupt for minor observations", () => {
    const controller = new DefaultInterruptController();
    const action = { type: "remember" as const, payload: {}, confidence: 0.5, reasoning: "" };
    const worldState: WorldState = {
      project: null, application: DEFAULT_APPLICATION_STATE,
      system: DEFAULT_SYSTEM_STATE, timestamp: Date.now(), version: 0,
    };
    const result = controller.evaluate(action, worldState, controller.getPolicies());
    expect(result.shouldInterrupt).toBe(false);
  });

  it("should interrupt for repeated build failures", () => {
    const controller = new DefaultInterruptController();
    const action = { type: "speak" as const, payload: { text: "error" }, confidence: 0.8, reasoning: "" };
    const worldState: WorldState = {
      project: null, application: DEFAULT_APPLICATION_STATE,
      system: {
        ...DEFAULT_SYSTEM_STATE,
        openErrors: [
          { source: "build", message: "e1", timestamp: 1 },
          { source: "build", message: "e2", timestamp: 2 },
          { source: "build", message: "e3", timestamp: 3 },
          { source: "build", message: "e4", timestamp: 4 },
        ],
      },
      timestamp: Date.now(), version: 0,
    };
    const result = controller.evaluate(action, worldState, controller.getPolicies());
    expect(result.shouldInterrupt).toBe(true);
  });

  it("should set custom policies", () => {
    const controller = new DefaultInterruptController();
    const custom = [{ name: "custom", priority: 50, matcher: () => true }];
    controller.setPolicies(custom);
    expect(controller.getPolicies()).toHaveLength(1);
    expect(controller.getPolicies()[0]!.name).toBe("custom");
  });
});
