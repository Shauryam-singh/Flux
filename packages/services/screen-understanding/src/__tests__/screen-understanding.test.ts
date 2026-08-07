import { describe, it, expect, vi } from "vitest";
import { createScreenUnderstandingService, getScreenContext } from "../impl/screen-understanding-service.js";
import type { ServiceContext } from "@ai-agent/services-core";

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

describe("ScreenUnderstandingService", () => {
  const svc = createScreenUnderstandingService();
  const ctx = makeCtx();

  it("has correct name", () => {
    expect(svc.name).toBe("screen-understanding");
  });

  it("can handle screen queries", () => {
    expect(svc.canHandle("what's on my screen")).toBe(true);
    expect(svc.canHandle("screenshot")).toBe(true);
    expect(svc.canHandle("what app am I in")).toBe(true);
    expect(svc.canHandle("read text on screen")).toBe(true);
    expect(svc.canHandle("detect ui elements")).toBe(true);
  });

  it("rejects unrelated input", () => {
    expect(svc.canHandle("hello world")).toBe(false);
    expect(svc.canHandle("open brave")).toBe(false);
    expect(svc.canHandle("what time is it")).toBe(false);
  });

  it("returns description for screen queries", async () => {
    const result = await svc.execute("what's on my screen", ctx);
    expect(result.text).toBeDefined();
    expect(typeof result.text).toBe("text" in result ? "string" : "string");
  });

  it("detects UI elements", async () => {
    const result = await svc.execute("detect ui elements", ctx);
    expect(result.text).toBeDefined();
  });

  it("extracts text", async () => {
    const result = await svc.execute("read text on screen", ctx);
    expect(result.text).toBeDefined();
  });

  it("identifies active app", async () => {
    const result = await svc.execute("what app am I in", ctx);
    expect(result.text).toBeDefined();
  });

  it("handles click commands", async () => {
    const result = await svc.execute("click the submit button", ctx);
    expect(result.text).toBeDefined();
  });
});

describe("getScreenContext", () => {
  it("returns a screen context object", () => {
    const ctx = getScreenContext();
    expect(ctx).toHaveProperty("hasScreen");
    expect(ctx).toHaveProperty("activeApp");
    expect(ctx).toHaveProperty("description");
    expect(ctx).toHaveProperty("timestamp");
    expect(typeof ctx.hasScreen).toBe("boolean");
  });
});
