import { describe, it, expect, vi } from "vitest";
import { createCommandChainService, parseChainLLM, executeChain } from "../impl/command-chain-service.js";
import type { ServiceContext, ServiceResponse } from "@ai-agent/services-core";
import type { CommandChain, CommandChainStep } from "../impl/command-chain-service.js";

function makeCtx(): ServiceContext {
  return {
    sessionId: "test",
    memory: { add: vi.fn(), history: vi.fn().mockResolvedValue([]), clear: vi.fn() } as never,
    provider: null,
    reply: vi.fn(),
    speak: vi.fn(),
    emit: vi.fn(),
  };
}

const mockRegistry = {
  resolve: async (input: string, _ctx: ServiceContext): Promise<ServiceResponse | null> => {
    return { text: `Executed: ${input}` };
  },
};

describe("CommandChainService", () => {
  const svc = createCommandChainService();

  it("has correct name", () => {
    expect(svc.name).toBe("command-chain");
  });

  it("detects multi-step commands", () => {
    expect(svc.canHandle("open brave and search for weather")).toBe(true);
    expect(svc.canHandle("start docker then run dev server")).toBe(true);
    expect(svc.canHandle("open terminal also open vs code")).toBe(true);
  });

  it("rejects single commands", () => {
    expect(svc.canHandle("hello world")).toBe(false);
    expect(svc.canHandle("what time is it")).toBe(false);
  });

  it("detects multiple action verbs", () => {
    expect(svc.canHandle("open firefox close chrome")).toBe(true);
    expect(svc.canHandle("launch terminal start docker")).toBe(true);
  });
});

describe("parseChainLLM", () => {
  it("returns single step for simple commands without LLM", async () => {
    const steps = await parseChainLLM("open brave", null);
    expect(steps).toHaveLength(1);
    expect(steps[0]!.action).toBe("launch");
    expect(steps[0]!.target).toBe("brave");
  });

  it("parses compound commands via fallback", async () => {
    const steps = await parseChainLLM("open brave and search for weather", null);
    expect(steps.length).toBeGreaterThanOrEqual(2);
    expect(steps.some((s) => s.action === "launch")).toBe(true);
    expect(steps.some((s) => s.action === "search")).toBe(true);
  });

  it("parses start commands with sync=true", async () => {
    const steps = await parseChainLLM("start docker", null);
    expect(steps).toHaveLength(1);
    expect(steps[0]!.sync).toBe(true);
    expect(steps[0]!.action).toBe("start");
  });

  it("parses navigate commands as async", async () => {
    const steps = await parseChainLLM("navigate to google.com", null);
    expect(steps).toHaveLength(1);
    expect(steps[0]!.sync).toBe(false);
    expect(steps[0]!.action).toBe("navigate");
  });

  it("links sequential sync steps", async () => {
    const steps = await parseChainLLM("start docker then run dev server", null);
    expect(steps.length).toBeGreaterThanOrEqual(2);
    const syncSteps = steps.filter((s) => s.sync);
    if (syncSteps.length >= 2) {
      expect(syncSteps[1]!.dependsOn).toContain(syncSteps[0]!.id);
    }
  });

  it("uses LLM when available", async () => {
    const mockProvider = {
      complete: vi.fn().mockResolvedValue({
        text: JSON.stringify([
          { id: "step_1", command: "open terminal", action: "launch", target: "terminal", priority: 1, dependsOn: [], sync: true, category: "app", estimatedMs: 2000 },
          { id: "step_2", command: "start docker", action: "start", target: "docker", priority: 1, dependsOn: ["step_1"], sync: true, category: "system", estimatedMs: 5000 },
          { id: "step_3", command: "open vs code", action: "launch", target: "vs code", priority: 2, dependsOn: [], sync: false, category: "app", estimatedMs: 2000 },
        ]),
      }),
    };

    const steps = await parseChainLLM("open terminal, start docker, and open vs code", mockProvider);
    expect(steps).toHaveLength(3);
    expect(mockProvider.complete).toHaveBeenCalled();
    expect(steps[1]!.dependsOn).toContain("step_1");
    expect(steps[2]!.sync).toBe(false);
  });

  it("falls back to rule-based when LLM returns invalid JSON", async () => {
    const mockProvider = {
      complete: vi.fn().mockResolvedValue({ text: "I don't understand" }),
    };

    const steps = await parseChainLLM("open brave", mockProvider);
    expect(steps).toHaveLength(1);
    expect(steps[0]!.action).toBe("launch");
  });
});

describe("executeChain", () => {
  it("executes a single-step chain", async () => {
    const ctx = makeCtx();
    const chain: CommandChain = {
      id: "test-chain",
      originalInput: "open brave",
      steps: [{
        id: "step_1",
        command: "open brave",
        action: "launch",
        target: "brave",
        priority: 1,
        dependsOn: [],
        sync: true,
        category: "app",
        estimatedMs: 2000,
      }],
      status: "pending",
      results: [],
      startedAt: null,
      completedAt: null,
      totalDurationMs: 0,
    };

    const result = await executeChain(chain, ctx, mockRegistry);
    expect(result.status).toBe("completed");
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.success).toBe(true);
  });

  it("executes parallel async steps concurrently", async () => {
    const ctx = makeCtx();
    const chain: CommandChain = {
      id: "test-parallel",
      originalInput: "open brave and open chrome",
      steps: [
        { id: "s1", command: "open brave", action: "launch", target: "brave", priority: 2, dependsOn: [], sync: false, category: "app", estimatedMs: 2000 },
        { id: "s2", command: "open chrome", action: "launch", target: "chrome", priority: 2, dependsOn: [], sync: false, category: "app", estimatedMs: 2000 },
      ],
      status: "pending",
      results: [],
      startedAt: null,
      completedAt: null,
      totalDurationMs: 0,
    };

    const result = await executeChain(chain, ctx, mockRegistry);
    expect(result.status).toBe("completed");
    expect(result.results).toHaveLength(2);
  });

  it("executes sync steps sequentially with dependencies", async () => {
    const ctx = makeCtx();
    const executionOrder: string[] = [];
    const orderedRegistry = {
      resolve: async (input: string, _ctx: ServiceContext): Promise<ServiceResponse> => {
        executionOrder.push(input);
        return { text: `Done: ${input}` };
      },
    };

    const chain: CommandChain = {
      id: "test-sequential",
      originalInput: "start docker then run dev server",
      steps: [
        { id: "s1", command: "start docker", action: "start", target: "docker", priority: 1, dependsOn: [], sync: true, category: "system", estimatedMs: 5000 },
        { id: "s2", command: "run dev server", action: "execute", target: "dev server", priority: 2, dependsOn: ["s1"], sync: true, category: "coding", estimatedMs: 3000 },
      ],
      status: "pending",
      results: [],
      startedAt: null,
      completedAt: null,
      totalDurationMs: 0,
    };

    const result = await executeChain(chain, ctx, orderedRegistry);
    expect(result.status).toBe("completed");
    expect(executionOrder[0]).toBe("start docker");
    expect(executionOrder[1]).toBe("run dev server");
  });

  it("reports progress via callback", async () => {
    const ctx = makeCtx();
    const progressReports: unknown[] = [];

    const chain: CommandChain = {
      id: "test-progress",
      originalInput: "open brave",
      steps: [
        { id: "s1", command: "open brave", action: "launch", target: "brave", priority: 1, dependsOn: [], sync: true, category: "app", estimatedMs: 2000 },
      ],
      status: "pending",
      results: [],
      startedAt: null,
      completedAt: null,
      totalDurationMs: 0,
    };

    await executeChain(chain, ctx, mockRegistry, (p) => progressReports.push(p));
    expect(progressReports).toHaveLength(1);
  });

  it("marks partial when some steps fail", async () => {
    const ctx = makeCtx();
    const partialRegistry = {
      resolve: async (input: string, _ctx: ServiceContext): Promise<ServiceResponse | null> => {
        if (input.includes("fail")) throw new Error("Step failed");
        return { text: `Done: ${input}` };
      },
    };

    const chain: CommandChain = {
      id: "test-partial",
      originalInput: "open brave and fail task",
      steps: [
        { id: "s1", command: "open brave", action: "launch", target: "brave", priority: 1, dependsOn: [], sync: false, category: "app", estimatedMs: 2000 },
        { id: "s2", command: "fail task", action: "execute", target: "task", priority: 1, dependsOn: [], sync: false, category: "system", estimatedMs: 1000 },
      ],
      status: "pending",
      results: [],
      startedAt: null,
      completedAt: null,
      totalDurationMs: 0,
    };

    const result = await executeChain(chain, ctx, partialRegistry);
    expect(result.status).toBe("partial");
    expect(result.results.some((r) => r.success)).toBe(true);
    expect(result.results.some((r) => !r.success)).toBe(true);
  });

  it("handles empty step list", async () => {
    const ctx = makeCtx();
    const chain: CommandChain = {
      id: "test-empty",
      originalInput: "",
      steps: [],
      status: "pending",
      results: [],
      startedAt: null,
      completedAt: null,
      totalDurationMs: 0,
    };

    const result = await executeChain(chain, ctx, mockRegistry);
    expect(result.status).toBe("completed");
    expect(result.results).toHaveLength(0);
  });
});
