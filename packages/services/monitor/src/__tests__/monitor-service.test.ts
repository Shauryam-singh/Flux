import type { ServiceContext } from "@ai-agent/services-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMonitorService } from "../impl/monitor-service.js";

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

describe("monitor service", () => {
  let service: ReturnType<typeof createMonitorService>;
  let ctx: ServiceContext;

  beforeEach(() => {
    service = createMonitorService();
    ctx = createMockContext();
  });

  it("should have correct name", () => {
    expect(service.name).toBe("monitor");
  });

  it("should add a monitor rule", async () => {
    const result = await service.execute(
      "add monitor CPU above 80 alert High CPU",
      ctx,
    );
    expect(result.text).toContain("Monitor rule created");
    expect(result.text).toContain("CPU");
  });

  it("should list rules", async () => {
    await service.execute("add monitor CPU above 80 alert", ctx);
    const result = await service.execute("show rules", ctx);
    expect(result.text).toContain("Monitor Rules");
  });

  it("should check system health", async () => {
    const result = await service.execute("check", ctx);
    expect(result.text).toContain("System Health");
    expect(result.text).toContain("CPU");
  });

  it("should handle unknown commands gracefully", async () => {
    const result = await service.execute("do something random", ctx);
    expect(result.text).toContain("monitor");
  });
});
