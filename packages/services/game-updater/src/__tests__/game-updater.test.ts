import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGameUpdaterService } from "../impl/game-updater-service.js";
import type { ServiceContext } from "@ai-agent/services-core";

function makeCtx(): ServiceContext {
  return {
    sessionId: "test",
    memory: {
      add: vi.fn(),
      history: vi.fn().mockResolvedValue([]),
      clear: vi.fn(),
    } as never,
    provider: null,
    reply: vi.fn(),
    speak: vi.fn(),
    emit: vi.fn(),
  };
}

describe("GameUpdaterService", () => {
  let svc: ReturnType<typeof createGameUpdaterService>;
  let ctx: ServiceContext;

  beforeEach(() => {
    svc = createGameUpdaterService();
    ctx = makeCtx();
  });

  it("has correct name", () => {
    expect(svc.name).toBe("game-updater");
  });

  it("can handle game-related input", () => {
    expect(svc.canHandle("check for game updates")).toBe(true);
    expect(svc.canHandle("list my steam games")).toBe(true);
    expect(svc.canHandle("update epic games")).toBe(true);
    expect(svc.canHandle("validate game files")).toBe(true);
    expect(svc.canHandle("my steam games status")).toBe(true);
  });

  it("rejects unrelated input", () => {
    expect(svc.canHandle("hello world")).toBe(false);
    expect(svc.canHandle("what time is it")).toBe(false);
  });

  it("lists games (may be empty if no games installed)", async () => {
    const result = await svc.execute("list my games", ctx);
    // Should either list games or say none found
    expect(result.text).toBeDefined();
    expect(typeof result.text).toBe("string");
  });

  it("checks for updates", async () => {
    const result = await svc.execute("check for steam updates", ctx);
    expect(result.text).toBeDefined();
  });

  it("validates game files", async () => {
    const result = await svc.execute("validate steam game files", ctx);
    expect(result.text).toBeDefined();
  });

  it("shows game status", async () => {
    const result = await svc.execute("status of steam games", ctx);
    expect(result.text).toBeDefined();
  });
});
