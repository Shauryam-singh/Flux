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

  it("should route 'who is X' to the LLM (null intent = fallback)", async () => {
    await orchestrator.process("who is the president", ctx);
    expect(chatService.execute).toHaveBeenCalled();
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
    const mockOrchestrate = vi
      .fn()
      .mockResolvedValue("Orchestrated result: API built with auth and docs");
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

    // Should fall through to normal routing (coding via regex)
    expect(codingService.execute).toHaveBeenCalled();
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

  // ── LLM-based intent routing (model decides, no regex) ──

  function mockLlmReply(json: string) {
    return { complete: vi.fn().mockResolvedValue({ text: json }) };
  }

  it("routes via model intent for a single action command", async () => {
    const llmCtx = {
      ...ctx,
      provider: mockLlmReply('[{"service":"system","command":"open notepad"}]'),
    };
    const systemService = createMockService("system");
    registry = createMockRegistry([
      searchService,
      codingService,
      chatService,
      systemService,
    ]);
    orchestrator = new Orchestrator(registry);

    await orchestrator.process("open notepad for me", llmCtx);

    expect(systemService.execute).toHaveBeenCalledWith(
      "open notepad",
      expect.anything(),
    );
  });

  it("executes every step of a multi-command input in order", async () => {
    const llmCtx = {
      ...ctx,
      provider: mockLlmReply(
        '[{"service":"system","command":"open notepad"},{"service":"vs-code","command":"open vs code"},{"service":"browser-control","command":"search javascript one shot video on yt"}]',
      ),
    };
    const systemService = createMockService("system");
    const vsCodeService = createMockService("vs-code");
    const browserService = createMockService("browser-control");
    registry = createMockRegistry([
      searchService,
      codingService,
      chatService,
      systemService,
      vsCodeService,
      browserService,
    ]);
    orchestrator = new Orchestrator(registry);

    const result = await orchestrator.process(
      "open notepad, vs code then search javascript one shot video on yt",
      llmCtx,
    );

    expect(systemService.execute).toHaveBeenCalled();
    expect(vsCodeService.execute).toHaveBeenCalled();
    expect(browserService.execute).toHaveBeenCalled();
    expect(chatService.execute).not.toHaveBeenCalled();
    // Each service gets only its own slice of the input
    expect(vsCodeService.execute).toHaveBeenCalledWith(
      "open vs code",
      expect.anything(),
    );
    expect(browserService.execute).toHaveBeenCalledWith(
      "search javascript one shot video on yt",
      expect.anything(),
    );
    // Combined responses
    expect(result.text).toContain("system response");
    expect(result.text).toContain("vs-code response");
    expect(result.text).toContain("browser-control response");
  });

  it("routes empty model intent ([] = just chatting) to the chat fallback", async () => {
    const llmCtx = { ...ctx, provider: mockLlmReply("[]") };

    await orchestrator.process("who is the president", llmCtx);

    expect(chatService.execute).toHaveBeenCalled();
  });

  it("falls back to regex classification when the model output is garbage", async () => {
    const llmCtx = { ...ctx, provider: mockLlmReply("I cannot do that") };

    await orchestrator.process("search for cats", llmCtx);

    expect(searchService.execute).toHaveBeenCalled();
  });

  it("streams multi-command results progressively", async () => {
    const llmCtx = {
      ...ctx,
      provider: mockLlmReply(
        '[{"service":"system","command":"open notepad"},{"service":"coding","command":"write a function to sort an array"}]',
      ),
    };
    const systemService = createMockService("system");
    registry = createMockRegistry([
      chatService,
      codingService,
      searchService,
      systemService,
    ]);
    orchestrator = new Orchestrator(registry);

    const tokens: string[] = [];
    let doneText = "";
    await orchestrator.processStream(
      "open notepad then write a function to sort an array",
      llmCtx,
      {
        onToken: (t) => tokens.push(t),
        onDone: (t) => {
          doneText = t;
        },
      },
    );

    expect(systemService.execute).toHaveBeenCalled();
    expect(codingService.execute).toHaveBeenCalled();
    expect(tokens).toHaveLength(2); // progressive — one per completed action
    expect(doneText).toBe("system response\n\ncoding response");
  });
});
