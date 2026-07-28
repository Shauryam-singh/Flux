import { describe, it, expect, vi, beforeEach } from "vitest";
import { createContextService } from "../impl/context-service.js";
import type { ServiceContext } from "@ai-agent/services-core";

vi.mock("node:fs", () => {
  const store = new Map<string, string>();
  return {
    readFileSync: vi.fn((p: string) => store.get(p) ?? ""),
    writeFileSync: vi.fn((p: string, data: string | Buffer) => {
      store.set(p, typeof data === "string" ? data : data.toString());
    }),
    existsSync: vi.fn((p: string) => store.has(p)),
    mkdirSync: vi.fn(),
  };
});

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

describe("context service", () => {
  let service: ReturnType<typeof createContextService>;
  let ctx: ServiceContext;

  beforeEach(() => {
    service = createContextService();
    ctx = createMockContext();
  });

  it("should have correct name", () => {
    expect(service.name).toBe("context");
  });

  it("should show context", async () => {
    const result = await service.execute("show my context", ctx);
    expect(result.text.toLowerCase()).toContain("context");
  });

  it("should set name", async () => {
    const result = await service.execute("set my name to Shaurya", ctx);
    expect(result.text).toContain("Shaurya");
    expect(ctx.reply).toHaveBeenCalled();
  });

  it("should track task", async () => {
    const result = await service.execute("track this building the new feature", ctx);
    expect(result.text).toContain("Tracking");
    expect(result.text).toContain("new feature");
  });

  it("should clear context", async () => {
    const result = await service.execute("clear my context", ctx);
    expect(result.text).toContain("Fresh start");
  });
});
