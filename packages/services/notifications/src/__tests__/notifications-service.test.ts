import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNotificationService } from "../impl/notifications-service.js";
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

describe("notification service", () => {
  let service: ReturnType<typeof createNotificationService>;
  let ctx: ServiceContext;

  beforeEach(() => {
    service = createNotificationService();
    ctx = createMockContext();
  });

  it("should have correct name", () => {
    expect(service.name).toBe("notifications");
  });

  it("should send a notification", async () => {
    const result = await service.execute("send notification Hello World", ctx);
    expect(result.text).toContain("Hello World");
    expect(ctx.speak).toHaveBeenCalled();
  });

  it("should list notifications", async () => {
    await service.execute("send notification Test alert", ctx);
    const result = await service.execute("show notifications", ctx);
    expect(result.text).toContain("Test alert");
  });

  it("should mark all as read", async () => {
    await service.execute("send notification Test", ctx);
    const result = await service.execute("mark all as read", ctx);
    expect(result.text).toContain("Marked");
  });

  it("should clear all notifications", async () => {
    await service.execute("send notification Test", ctx);
    const result = await service.execute("clear notifications", ctx);
    expect(result.text).toContain("cleared");
  });
});
