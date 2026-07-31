import { beforeEach, describe, expect, it, vi } from "vitest";
import { Orchestrator } from "../impl/orchestrator.js";
import type { Service } from "../interfaces/service.js";
import type { ServiceContext } from "../interfaces/service-context.js";
import type { ServiceRegistry } from "../interfaces/service-registry.js";

function createMockService(name: string): Service {
  return {
    name,
    description: `Mock ${name} service`,
    canHandle: vi.fn().mockResolvedValue(true),
    execute: vi.fn().mockResolvedValue({ text: `${name} response` }),
  };
}

function createMockRegistry(services: Service[]): ServiceRegistry {
  const map = new Map(services.map((s) => [s.name, s]));
  return {
    register: vi.fn(),
    unregister: vi.fn(),
    get: vi.fn((name: string) => map.get(name)),
    getAll: vi.fn(() => [...map.values()]),
    findBest: vi.fn().mockResolvedValue(null),
  };
}

function createMockContext(): ServiceContext {
  return {
    sessionId: "test-session",
    memory: {
      add: vi.fn().mockResolvedValue(undefined),
      history: vi.fn().mockResolvedValue([]),
    } as unknown as ServiceContext["memory"],
    provider: {
      complete: vi.fn().mockResolvedValue({ text: "response" }),
    },
    reply: vi.fn(),
    speak: vi.fn(),
    emit: vi.fn(),
  };
}

describe("Orchestrator", () => {
  let searchService: Service;
  let codingService: Service;
  let chatService: Service;
  let registry: ServiceRegistry;
  let orchestrator: Orchestrator;
  let ctx: ServiceContext;

  beforeEach(() => {
    searchService = createMockService("search");
    codingService = createMockService("coding");
    chatService = createMockService("chat");
    registry = createMockRegistry([searchService, codingService, chatService]);
    orchestrator = new Orchestrator(registry);
    ctx = createMockContext();
  });

  it("should route 'search for X' to the search service", async () => {
    await orchestrator.process("search for cats", ctx);
    expect(searchService.execute).toHaveBeenCalled();
  });

  it("should route 'what is X' to the search service", async () => {
    await orchestrator.process("what is TypeScript", ctx);
    expect(searchService.execute).toHaveBeenCalled();
  });

  it("should route code-related input to the coding service", async () => {
    await orchestrator.process("write a function to sort an array", ctx);
    expect(codingService.execute).toHaveBeenCalled();
  });

  it("should fall back to chat service for unknown input", async () => {
    // No intent match and findBest returns null → uses fallback "chat"
    await orchestrator.process("hello there", ctx);
    expect(chatService.execute).toHaveBeenCalled();
  });

  it("should pass provider through context to services", async () => {
    await orchestrator.process("search for cats", ctx);
    const calledCtx = (searchService.execute as ReturnType<typeof vi.fn>).mock
      .calls[0]![1] as ServiceContext;
    expect(calledCtx.provider).toBe(ctx.provider);
    expect(calledCtx.sessionId).toBe("test-session");
    expect(calledCtx.reply).toBe(ctx.reply);
    expect(calledCtx.speak).toBe(ctx.speak);
    expect(calledCtx.emit).toBe(ctx.emit);
  });

  it("should use multi-agent orchestration for complex tasks", async () => {
    const mockOrchestrate = vi.fn().mockResolvedValue("Orchestrated result: API built with auth and docs");
    const ctxWithMultiAgent = {
      ...ctx,
      multiAgent: {
        orchestrate: mockOrchestrate,
        getAgents: vi.fn().mockReturnValue([]),
      },
    };

    // Multiple domain-diverse verbs: build + deploy + document → 3 matches
    await orchestrator.process(
      "build a frontend UI with react, deploy to docker, and document the API",
      ctxWithMultiAgent,
    );

    expect(mockOrchestrate).toHaveBeenCalled();
    // Should NOT fall through to service routing
    expect(searchService.execute).not.toHaveBeenCalled();
    expect(codingService.execute).not.toHaveBeenCalled();
  });

  it("should fall back to service routing when orchestration fails", async () => {
    const mockOrchestrate = vi.fn().mockRejectedValue(new Error("LLM down"));
    const ctxWithMultiAgent = {
      ...ctx,
      multiAgent: {
        orchestrate: mockOrchestrate,
        getAgents: vi.fn().mockReturnValue([]),
      },
    };

    await orchestrator.process(
      "build a frontend UI with react, deploy to docker, and document the API",
      ctxWithMultiAgent,
    );

    // Should fall through to normal routing (chat as fallback)
    expect(chatService.execute).toHaveBeenCalled();
  });

  it("should not use multi-agent for simple tasks", async () => {
    const mockOrchestrate = vi.fn();
    const ctxWithMultiAgent = {
      ...ctx,
      multiAgent: {
        orchestrate: mockOrchestrate,
        getAgents: vi.fn().mockReturnValue([]),
      },
    };

    await orchestrator.process("hello", ctxWithMultiAgent);
    expect(mockOrchestrate).not.toHaveBeenCalled();
  });
});
