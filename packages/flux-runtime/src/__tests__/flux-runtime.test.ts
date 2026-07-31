import { afterEach, describe, expect, it } from "vitest";
import type { FluxRuntimeConfig } from "../interfaces/flux-runtime.js";

describe("FluxRuntime", () => {
  const testConfig: FluxRuntimeConfig = {
    provider: "ollama",
    model: "qwen2.5-coder:7b",
    providerConfigs: { ollama: { baseUrl: "http://localhost:11434" } },
    maxMemoryCapacity: 10,
    attentionMinBrainScore: 40,
    enableSelfEvolution: true,
  };

  let runtime:
    | InstanceType<
        typeof import("../impl/default-flux-runtime.js").DefaultFluxRuntime
      >
    | undefined;

  afterEach(async () => {
    if (runtime) {
      await runtime.shutdown();
      runtime = undefined;
    }
  });

  it("should export DefaultFluxRuntime", async () => {
    const { DefaultFluxRuntime } = await import(
      "../impl/default-flux-runtime.js"
    );
    expect(DefaultFluxRuntime).toBeDefined();
    runtime = new DefaultFluxRuntime(testConfig);
    expect(runtime).toBeDefined();
    expect(typeof runtime.process).toBe("function");
    expect(typeof runtime.processEvent).toBe("function");
    expect(typeof runtime.getHistory).toBe("function");
    expect(typeof runtime.getState).toBe("function");
    expect(typeof runtime.shutdown).toBe("function");
    expect(typeof runtime.start).toBe("function");
    expect(typeof runtime.stop).toBe("function");
    expect(typeof runtime.isRunning).toBe("function");
  });

  it("should initialize all subsystems", async () => {
    const { DefaultFluxRuntime } = await import(
      "../impl/default-flux-runtime.js"
    );
    runtime = new DefaultFluxRuntime(testConfig);
    expect(runtime.session).toBeDefined();
    expect(runtime.provider).toBeDefined();
    expect(runtime.llmProvider).toBeDefined();
    expect(runtime.orchestrator).toBeDefined();
    expect(runtime.attention).toBeDefined();
    expect(runtime.cognitive).toBeDefined();
    expect(runtime.worldModel).toBeDefined();
    expect(runtime.workingMemory).toBeDefined();
    expect(runtime.goalManager).toBeDefined();
    expect(runtime.experienceDb).toBeDefined();
    expect(runtime.metaCognition).toBeDefined();
    expect(runtime.strategyLibrary).toBeDefined();
    expect(runtime.confidenceCalibration).toBeDefined();
    expect(runtime.knowledge).toBeDefined();
    expect(runtime.habits).toBeDefined();
    expect(runtime.thoughtGraph).toBeDefined();
  });

  it("should return initial state when not running", async () => {
    const { DefaultFluxRuntime } = await import(
      "../impl/default-flux-runtime.js"
    );
    runtime = new DefaultFluxRuntime(testConfig);
    const state = runtime.getState();
    expect(state.memorySize).toBeGreaterThanOrEqual(0);
    expect(state.activeGoals).toBeGreaterThanOrEqual(0);
    expect(state.totalInteractions).toBe(0);
    expect(state.uptime).toBeGreaterThanOrEqual(0);
    expect(state.isRunning).toBe(false);
    expect(state.cognitiveState).toBe("idle");
    expect(state.tickCount).toBe(0);
    expect(state.lastTickAt).toBeNull();
    expect(state.thoughtGraphNodes).toBe(0);
    expect(state.thoughtGraphEdges).toBe(0);
    expect(state.lastPipelineDurationMs).toBeNull();
  });

  it("should start and stop background loop", async () => {
    const { DefaultFluxRuntime } = await import(
      "../impl/default-flux-runtime.js"
    );
    runtime = new DefaultFluxRuntime(testConfig);
    expect(runtime.isRunning()).toBe(false);

    runtime.start();
    expect(runtime.isRunning()).toBe(true);
    expect(runtime.getState().isRunning).toBe(true);
    expect(runtime.getState().cognitiveState).toBe("running");

    runtime.stop();
    expect(runtime.isRunning()).toBe(false);
    expect(runtime.getState().isRunning).toBe(false);
  });

  it("should not double-start", async () => {
    const { DefaultFluxRuntime } = await import(
      "../impl/default-flux-runtime.js"
    );
    runtime = new DefaultFluxRuntime(testConfig);
    runtime.start();
    runtime.start(); // Should be no-op
    expect(runtime.isRunning()).toBe(true);
    runtime.stop();
  });

  it("should process events through attention", async () => {
    const { DefaultFluxRuntime } = await import(
      "../impl/default-flux-runtime.js"
    );
    runtime = new DefaultFluxRuntime(testConfig);
    const result = runtime.processEvent({
      source: "screen",
      title: "Test Event",
      detail: "Something happened",
    });
    expect(result).toBeDefined();
    expect(["ignore", "buffer", "immediate", "summarize"]).toContain(
      result.action,
    );
  });

  it("should start with empty history", async () => {
    const { DefaultFluxRuntime } = await import(
      "../impl/default-flux-runtime.js"
    );
    runtime = new DefaultFluxRuntime(testConfig);
    expect(runtime.getHistory()).toHaveLength(0);
  });

  it("should register and unregister tick handlers", async () => {
    const { DefaultFluxRuntime } = await import(
      "../impl/default-flux-runtime.js"
    );
    runtime = new DefaultFluxRuntime(testConfig);
    let called = false;
    const unsub = runtime.onTick(() => {
      called = true;
    });
    expect(typeof unsub).toBe("function");
    unsub();
    // Handler should not be called after unsubscribe
  });

  it("should manage thought graph", async () => {
    const { DefaultFluxRuntime } = await import(
      "../impl/default-flux-runtime.js"
    );
    runtime = new DefaultFluxRuntime(testConfig);

    // Add thoughts manually
    const thought = runtime.thoughtGraph.addNode({
      type: "observation_interpretation",
      content: "Test thought",
      reasoning: "Testing thought graph",
      confidence: { value: 0.8, reason: "test", timestamp: Date.now() },
      evidence: [],
      counterarguments: [],
      relatedThoughtIds: [],
      observationIds: [],
      goalId: null,
      expiresAt: null,
      metadata: {},
    });

    expect(thought.id).toBeTruthy();
    expect(runtime.thoughtGraph.snapshot().nodeCount).toBe(1);

    // Test explanation
    const explanation = runtime.explainThought(thought.id);
    expect(explanation.mainThought).toBe("Test thought");
    expect(explanation.confidenceReasoning).toBeTruthy();

    // Test retrieval
    const recent = runtime.getRecentThoughts(5);
    expect(recent.length).toBeGreaterThanOrEqual(1);

    const strongest = runtime.getStrongestThoughts(5);
    expect(strongest.length).toBeGreaterThanOrEqual(1);
  });

  it("should shutdown cleanly", async () => {
    const { DefaultFluxRuntime } = await import(
      "../impl/default-flux-runtime.js"
    );
    runtime = new DefaultFluxRuntime(testConfig);
    runtime.start();
    await expect(runtime.shutdown()).resolves.toBeUndefined();
    runtime = undefined; // Prevent double-shutdown in afterEach
  });
});
