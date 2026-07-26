import { describe, it, expect, vi, beforeEach } from "vitest";
import { createAutomationService } from "../impl/automations-service.js";
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
    appendFileSync: vi.fn(),
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

describe("automations service", () => {
  let service: ReturnType<typeof createAutomationService>;
  let ctx: ServiceContext;

  beforeEach(() => {
    service = createAutomationService();
    ctx = createMockContext();
  });

  it("should have correct name", () => {
    expect(service.name).toBe("automations");
  });

  it("should add an automation", async () => {
    const result = await service.execute("add automation every morning speak good morning", ctx);
    expect(result.text).toContain("Automation created");
    expect(result.text).toContain("morning");
  });

  it("should list automations", async () => {
    await service.execute("add automation every day speak hello", ctx);
    const result = await service.execute("show automations", ctx);
    expect(result.text).toContain("Automation Chains");
  });

  it("should add time-based automation", async () => {
    const result = await service.execute("add automation at 9am open chrome", ctx);
    expect(result.text).toContain("Automation created");
    expect(result.text).toContain("9am");
  });

  it("should handle unknown commands gracefully", async () => {
    const result = await service.execute("do something random", ctx);
    expect(result.text).toContain("automate");
  });
});
