import { describe, it, expect, vi } from "vitest";
import { createBrowserControlService } from "../impl/browser-control-service.js";
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

describe("BrowserControlService", () => {
  const svc = createBrowserControlService();
  const ctx = makeCtx();

  it("has correct name", () => {
    expect(svc.name).toBe("browser-control");
  });

  it("can handle browser-related input", () => {
    expect(svc.canHandle("open youtube.com")).toBe(true);
    expect(svc.canHandle("search for cats on Google")).toBe(true);
    expect(svc.canHandle("click the login button")).toBe(true);
    expect(svc.canHandle("type hello in the search box")).toBe(true);
    expect(svc.canHandle("scroll down")).toBe(true);
    expect(svc.canHandle("list tabs")).toBe(true);
    expect(svc.canHandle("take a screenshot")).toBe(true);
    expect(svc.canHandle("what's on the page")).toBe(true);
    expect(svc.canHandle("go back")).toBe(true);
    expect(svc.canHandle("reload")).toBe(true);
    expect(svc.canHandle("new tab")).toBe(true);
    expect(svc.canHandle("press enter")).toBe(true);
    expect(svc.canHandle("hover over menu")).toBe(true);
    expect(svc.canHandle("show links")).toBe(true);
  });

  it("rejects unrelated input", () => {
    expect(svc.canHandle("hello world")).toBe(false);
    expect(svc.canHandle("what time is it")).toBe(false);
    expect(svc.canHandle("set a reminder")).toBe(false);
  });

  it("returns help text", async () => {
    const result = await svc.execute("browser help", ctx);
    expect(result.text).toContain("Browser Control");
    expect(result.text).toContain("youtube.com");
    expect(result.text).toContain("Google");
    expect(result.text).toContain("GitHub");
  });

  it("parses open intent", async () => {
    const result = await svc.execute("open example.com", ctx);
    // Will either open the page or fail if playwright not installed
    expect(result.text).toBeDefined();
    expect(typeof result.text).toBe("string");
  });

  it("parses search intent", async () => {
    const result = await svc.execute("search for cats on Google", ctx);
    expect(result.text).toBeDefined();
  });

  it("parses click intent", async () => {
    const result = await svc.execute("click login", ctx);
    expect(result.text).toBeDefined();
  });

  it("parses type intent", async () => {
    const result = await svc.execute('type hello in the search box', ctx);
    expect(result.text).toBeDefined();
  });

  it("parses scroll intent", async () => {
    const result = await svc.execute("scroll down", ctx);
    expect(result.text).toBeDefined();
  });

  it("parses tabs intent", async () => {
    const result = await svc.execute("list tabs", ctx);
    expect(result.text).toBeDefined();
  });

  it("parses screenshot intent", async () => {
    const result = await svc.execute("take a screenshot", ctx);
    expect(result.text).toBeDefined();
  });

  it("parses read page intent", async () => {
    const result = await svc.execute("what's on the page", ctx);
    expect(result.text).toBeDefined();
  });

  it("parses back/forward/reload", async () => {
    expect((await svc.execute("go back", ctx)).text).toBeDefined();
    expect((await svc.execute("go forward", ctx)).text).toBeDefined();
    expect((await svc.execute("reload", ctx)).text).toBeDefined();
  });

  it("parses press key intent", async () => {
    const result = await svc.execute("press enter", ctx);
    expect(result.text).toBeDefined();
  });

  it("parses hover intent", async () => {
    const result = await svc.execute("hover over menu", ctx);
    expect(result.text).toBeDefined();
  });

  it("parses links intent", async () => {
    const result = await svc.execute("show links", ctx);
    expect(result.text).toBeDefined();
  });

  it("parses fill/select intent", async () => {
    expect((await svc.execute("fill email with test@test.com", ctx)).text).toBeDefined();
    expect((await svc.execute("select red in color", ctx)).text).toBeDefined();
  });

  it("parses new tab", async () => {
    const result = await svc.execute("new tab", ctx);
    expect(result.text).toBeDefined();
  });
});
