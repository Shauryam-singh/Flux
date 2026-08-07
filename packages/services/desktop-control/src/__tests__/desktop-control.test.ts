import { describe, it, expect, vi } from "vitest";
import { createDesktopControlService } from "../impl/desktop-control-service.js";
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

describe("DesktopControlService", () => {
  const svc = createDesktopControlService();
  const ctx = makeCtx();

  it("has correct name", () => {
    expect(svc.name).toBe("desktop-control");
  });

  it("can handle window commands", () => {
    expect(svc.canHandle("list windows")).toBe(true);
    expect(svc.canHandle("focus firefox")).toBe(true);
    expect(svc.canHandle("close window")).toBe(true);
    expect(svc.canHandle("minimize window")).toBe(true);
    expect(svc.canHandle("maximize window")).toBe(true);
    expect(svc.canHandle("fullscreen")).toBe(true);
    expect(svc.canHandle("float window")).toBe(true);
    expect(svc.canHandle("pin window")).toBe(true);
    expect(svc.canHandle("tile left")).toBe(true);
    expect(svc.canHandle("snap right")).toBe(true);
    expect(svc.canHandle("resize wider")).toBe(true);
    expect(svc.canHandle("move window up")).toBe(true);
  });

  it("can handle workspace commands", () => {
    expect(svc.canHandle("list workspaces")).toBe(true);
    expect(svc.canHandle("switch to workspace 3")).toBe(true);
    expect(svc.canHandle("move window to workspace 2")).toBe(true);
    expect(svc.canHandle("create workspace")).toBe(true);
    expect(svc.canHandle("delete workspace 5")).toBe(true);
    expect(svc.canHandle("next workspace")).toBe(true);
    expect(svc.canHandle("prev workspace")).toBe(true);
  });

  it("can handle app commands", () => {
    expect(svc.canHandle("open firefox")).toBe(true);
    expect(svc.canHandle("launch vs code")).toBe(true);
    expect(svc.canHandle("kill firefox")).toBe(true);
    expect(svc.canHandle("switch to firefox")).toBe(true);
  });

  it("can handle system commands", () => {
    expect(svc.canHandle("volume up")).toBe(true);
    expect(svc.canHandle("volume down")).toBe(true);
    expect(svc.canHandle("set volume 50")).toBe(true);
    expect(svc.canHandle("mute")).toBe(true);
    expect(svc.canHandle("brightness up")).toBe(true);
    expect(svc.canHandle("set brightness 80")).toBe(true);
    expect(svc.canHandle("screenshot")).toBe(true);
    expect(svc.canHandle("screenshot selection")).toBe(true);
    expect(svc.canHandle("record screen")).toBe(true);
    expect(svc.canHandle("stop recording")).toBe(true);
    expect(svc.canHandle("do not disturb on")).toBe(true);
  });

  it("can handle clipboard commands", () => {
    expect(svc.canHandle("copy hello to clipboard")).toBe(true);
    expect(svc.canHandle("paste from clipboard")).toBe(true);
    expect(svc.canHandle("clear clipboard")).toBe(true);
  });

  it("can handle desktop commands", () => {
    expect(svc.canHandle("show desktop")).toBe(true);
    expect(svc.canHandle("lock screen")).toBe(true);
    expect(svc.canHandle("app launcher")).toBe(true);
    expect(svc.canHandle("window overview")).toBe(true);
  });

  it("rejects unrelated input", () => {
    expect(svc.canHandle("hello world")).toBe(false);
    expect(svc.canHandle("what time is it")).toBe(false);
    expect(svc.canHandle("send email")).toBe(false);
  });

  it("lists windows (will vary by system)", async () => {
    const result = await svc.execute("list windows", ctx);
    expect(result.text).toBeDefined();
    expect(typeof result.text).toBe("string");
  });

  it("lists workspaces (will vary by system)", async () => {
    const result = await svc.execute("list workspaces", ctx);
    expect(result.text).toBeDefined();
  });

  it("returns help for unknown intent", async () => {
    const result = await svc.execute("desktop help", ctx);
    expect(result.text).toContain("Desktop Control");
  });

  it("handles volume adjust", async () => {
    const result = await svc.execute("volume up", ctx);
    expect(result.text).toContain("Volume");
  });

  it("handles mute toggle", async () => {
    const result = await svc.execute("mute", ctx);
    expect(result.text).toBeDefined();
  });

  it("handles screenshot", async () => {
    const result = await svc.execute("screenshot", ctx);
    expect(result.text).toContain("Screenshot");
  });

  it("handles clipboard copy", async () => {
    const result = await svc.execute("copy hello world to clipboard", ctx);
    expect(result.text).toContain("Copied");
  }, 15000);

  it("handles clipboard paste", async () => {
    const result = await svc.execute("paste from clipboard", ctx);
    expect(result.text).toBeDefined();
  });

  it("handles show desktop", async () => {
    const result = await svc.execute("show desktop", ctx);
    expect(result.text).toBeDefined();
  });

  it("handles lock screen", async () => {
    const result = await svc.execute("lock screen", ctx);
    expect(result.text).toBeDefined();
  });

  it("handles app launcher", async () => {
    const result = await svc.execute("app launcher", ctx);
    expect(result.text).toBeDefined();
  });
});
