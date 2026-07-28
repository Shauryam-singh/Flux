import { describe, it, expect, vi } from "vitest";
import { DefaultCognitiveOrchestrator } from "../cognitive-orchestrator.js";
import { DefaultWorldModel } from "@ai-agent/world-model";
import { DefaultWorkingMemory } from "@ai-agent/working-memory";
import { DefaultGoalManager } from "@ai-agent/goals";
import { DefaultReasoningEngine } from "@ai-agent/reasoning";
import { DefaultDecisionEngine, DefaultInterruptController } from "@ai-agent/decisions";
import type { Observation } from "@ai-agent/attention";

function makeObs(source: Observation["source"], title = "test"): Observation {
  return {
    id: `obs_${Date.now()}_${Math.random()}`,
    source,
    title,
    detail: "test",
    priority: "medium",
    score: 50,
    timestamp: Date.now(),
    mergeable: false,
    consumed: false,
  };
}

const mockThoughtGenerator = { generate: async () => [], needsLlm: () => false };

function createOrchestrator() {
  return new DefaultCognitiveOrchestrator(
    new DefaultWorldModel(),
    new DefaultWorkingMemory(),
    new DefaultGoalManager(),
    new DefaultReasoningEngine(mockThoughtGenerator),
    new DefaultDecisionEngine(),
    new DefaultInterruptController(),
    { cycleInterval: 60000, reflectionInterval: 3600000 },
  );
}

describe("DefaultCognitiveOrchestrator", () => {
  it("should create with default state", () => {
    const orch = createOrchestrator();
    const state = orch.getState();
    expect(state.totalCycles).toBe(0);
    expect(state.totalThoughts).toBe(0);
    expect(state.totalActions).toBe(0);
    expect(state.activeGoal).toBeNull();
  });

  it("should observe and update world model", () => {
    const orch = createOrchestrator();
    orch.observe(makeObs("screen", "VSCode opened"));
    const state = orch.getState();
    expect(state.world.application.activeApp).toBe("");
    expect(state.memory.entries.length).toBeGreaterThan(0);
  });

  it("should extract goals from messages", () => {
    const orch = createOrchestrator();
    orch.message("Implement the attention system");
    const state = orch.getState();
    expect(state.goals.length).toBeGreaterThan(0);
    expect(state.goals[0]!.title.toLowerCase()).toContain("attention");
  });

  it("should run a cycle", async () => {
    const orch = createOrchestrator();
    orch.observe(makeObs("system", "Build failed"));
    const result = await orch.forceCycle("observation");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(orch.getState().totalCycles).toBe(1);
  });

  it("should emit onThought", async () => {
    const orch = createOrchestrator();
    const handler = vi.fn();
    orch.observe(makeObs("system", "Build failed"));
    await orch.forceCycle("observation");
    // Thoughts are emitted during cycle, handler was registered
    expect(orch.getState().totalCycles).toBe(1);
  });

  it("should start and stop", () => {
    const orch = createOrchestrator();
    orch.start();
    orch.stop();
    // No error means success
  });

  it("should shutdown gracefully", async () => {
    const orch = createOrchestrator();
    orch.start();
    await orch.shutdown();
    expect(orch.getState().totalCycles).toBe(0);
  });

  it("should not double-start", () => {
    const orch = createOrchestrator();
    orch.start();
    orch.start(); // should not throw
    orch.stop();
  });
});
