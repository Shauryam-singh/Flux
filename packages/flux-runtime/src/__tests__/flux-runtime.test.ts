import { describe, it, expect } from "vitest";
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

  it("should export DefaultFluxRuntime", async () => {
    const { DefaultFluxRuntime } = await import("../impl/default-flux-runtime.js");
    expect(DefaultFluxRuntime).toBeDefined();
    const runtime = new DefaultFluxRuntime(testConfig);
    expect(runtime).toBeDefined();
    expect(typeof runtime.process).toBe("function");
    expect(typeof runtime.processEvent).toBe("function");
    expect(typeof runtime.getHistory).toBe("function");
    expect(typeof runtime.getState).toBe("function");
    expect(typeof runtime.shutdown).toBe("function");
  });

  it("should initialize all subsystems", async () => {
    const { DefaultFluxRuntime } = await import("../impl/default-flux-runtime.js");
    const runtime = new DefaultFluxRuntime(testConfig);
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
  });

  it("should return initial state", async () => {
    const { DefaultFluxRuntime } = await import("../impl/default-flux-runtime.js");
    const runtime = new DefaultFluxRuntime(testConfig);
    const state = runtime.getState();
    expect(state.memorySize).toBe(0);
    expect(state.activeGoals).toBe(0);
    expect(state.totalInteractions).toBe(0);
    expect(state.uptime).toBeGreaterThanOrEqual(0);
    expect(state.cognitiveState).toBe("active");
  });

  it("should process events through attention", async () => {
    const { DefaultFluxRuntime } = await import("../impl/default-flux-runtime.js");
    const runtime = new DefaultFluxRuntime(testConfig);
    const result = runtime.processEvent({
      source: "screen",
      title: "Test Event",
      detail: "Something happened",
    });
    expect(result).toBeDefined();
    expect(["ignore", "buffer", "immediate", "summarize"]).toContain(result.action);
  });

  it("should start with empty history", async () => {
    const { DefaultFluxRuntime } = await import("../impl/default-flux-runtime.js");
    const runtime = new DefaultFluxRuntime(testConfig);
    expect(runtime.getHistory()).toHaveLength(0);
  });

  it("should shutdown cleanly", async () => {
    const { DefaultFluxRuntime } = await import("../impl/default-flux-runtime.js");
    const runtime = new DefaultFluxRuntime(testConfig);
    await expect(runtime.shutdown()).resolves.toBeUndefined();
  });
});
