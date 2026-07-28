import { describe, it, expect, vi, beforeEach } from "vitest";
import { createProactiveService } from "../impl/proactive-service.js";
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

describe("proactive service", () => {
  let service: ReturnType<typeof createProactiveService>;
  let ctx: ServiceContext;

  beforeEach(() => {
    service = createProactiveService();
    ctx = createMockContext();
  });

  it("should have correct name", () => {
    expect(service.name).toBe("proactive");
  });

  it("should show rules", async () => {
    const result = await service.execute("show rules", ctx);
    expect(result.text).toContain("Proactive Rules");
  });

  it("should check system", async () => {
    const result = await service.execute("check", ctx);
    expect(result.text).toBeDefined();
  });

  it("should add a rule", async () => {
    const result = await service.execute("add proactive MyRule when coding say Need help?", ctx);
    expect(result.text).toContain("Proactive rule created");
  });

  it("should start proactive mode", async () => {
    const result = await service.execute("start proactive", ctx);
    expect(result.text).toContain("Proactive mode activated");
  });
});
