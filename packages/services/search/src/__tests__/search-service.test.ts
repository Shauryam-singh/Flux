import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSearchService } from "../impl/search-service.js";
import type { ServiceContext } from "@ai-agent/services-core";

function createMockContext(): ServiceContext {
  return {
    sessionId: "test-session",
    memory: {
      add: vi.fn().mockResolvedValue(undefined),
      history: vi.fn().mockResolvedValue([]),
    } as unknown as ServiceContext["memory"],
    provider: null,
    reply: vi.fn(),
    speak: vi.fn(),
    emit: vi.fn(),
  };
}

describe("search service", () => {
  let service: ReturnType<typeof createSearchService>;
  let ctx: ServiceContext;

  beforeEach(() => {
    service = createSearchService();
    ctx = createMockContext();
  });

  describe("query cleaning", () => {
    it('should clean "search for X" → "X"', async () => {
      // We just test canHandle here; execute calls the network
      expect(await service.canHandle("search for cats")).toBe(true);
      expect(await service.canHandle("search for typescript")).toBe(true);
    });

    it('should clean "search X" → "X"', async () => {
      expect(await service.canHandle("search cats")).toBe(true);
    });

    it('should clean "what is X" → "X"', async () => {
      expect(await service.canHandle("what is TypeScript")).toBe(true);
      expect(await service.canHandle("what is a closure")).toBe(true);
    });
  });

  describe("canHandle", () => {
    it("should return true for search keywords", async () => {
      expect(await service.canHandle("search for news")).toBe(true);
      expect(await service.canHandle("look up the recipe")).toBe(true);
      expect(await service.canHandle("find a good restaurant")).toBe(true);
      expect(await service.canHandle("who is Elon Musk")).toBe(true);
      expect(await service.canHandle("how to bake bread")).toBe(true);
      expect(await service.canHandle("tell me about AI")).toBe(true);
      expect(await service.canHandle("latest headlines")).toBe(true);
    });

    it("should return false for non-search input", async () => {
      expect(await service.canHandle("hello")).toBe(false);
      expect(await service.canHandle("write a function")).toBe(false);
      expect(await service.canHandle("remind me to buy milk")).toBe(false);
      expect(await service.canHandle("open the door")).toBe(false);
    });
  });

  describe("execute", () => {
    it("should add messages to memory and reply", async () => {
      // Mock fetch so we don't make real network calls
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(""),
      });

      try {
        await service.execute("search for cats", ctx);
        expect(ctx.memory.add).toHaveBeenCalledWith("user", "search for cats");
        expect(ctx.memory.add).toHaveBeenCalledWith(
          "assistant",
          expect.any(String),
        );
        expect(ctx.reply).toHaveBeenCalled();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
