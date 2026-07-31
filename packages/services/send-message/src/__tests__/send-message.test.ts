import { describe, it, expect, vi } from "vitest";
import { createSendMessageService } from "../impl/send-message-service.js";
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

describe("SendMessageService", () => {
  const svc = createSendMessageService();
  const ctx = makeCtx();

  it("has correct name", () => {
    expect(svc.name).toBe("send-message");
  });

  it("can handle messaging input", () => {
    expect(svc.canHandle("send a telegram to John")).toBe(true);
    expect(svc.canHandle("email alice@foo.com")).toBe(true);
    expect(svc.canHandle("whatsapp mom")).toBe(true);
    expect(svc.canHandle("send a discord message")).toBe(true);
    expect(svc.canHandle("text 555-1234")).toBe(true);
    expect(svc.canHandle("message someone on slack")).toBe(true);
    expect(svc.canHandle("signal contact")).toBe(true);
    expect(svc.canHandle("tell John hello")).toBe(true);
  });

  it("rejects unrelated input", () => {
    expect(svc.canHandle("hello world")).toBe(false);
    expect(svc.canHandle("what time is it")).toBe(false);
    expect(svc.canHandle("open youtube.com")).toBe(false);
  });

  it("parses telegram message", async () => {
    const result = await svc.execute("send a telegram to John saying hello there", ctx);
    expect(result.text).toBeDefined();
    // Will fail because no token configured, but should give helpful error
    expect(result.text).toContain("Telegram");
  });

  it("parses email message", async () => {
    const result = await svc.execute("email alice@foo.com about the meeting tomorrow", ctx);
    expect(result.text).toBeDefined();
    // Will fail because no email configured
    expect(result.text).toContain("Email");
  });

  it("parses discord message", async () => {
    const result = await svc.execute("send a discord message to #general: meeting at 3pm", ctx);
    expect(result.text).toBeDefined();
    expect(result.text).toContain("Discord");
  });

  it("parses slack message", async () => {
    const result = await svc.execute("slack #general: server is down", ctx);
    expect(result.text).toBeDefined();
    expect(result.text).toContain("Slack");
  });

  it("parses whatsapp message", async () => {
    const result = await svc.execute("whatsapp mom I'll be late", ctx);
    expect(result.text).toBeDefined();
    // WhatsApp opens browser, may succeed or fail
    expect(typeof result.text).toBe("string");
  });

  it("parses tell command", async () => {
    const result = await svc.execute("tell John that the meeting is at 3pm", ctx);
    expect(result.text).toBeDefined();
  });

  it("parses text/sms command", async () => {
    const result = await svc.execute("text 555-1234 on your way", ctx);
    expect(result.text).toBeDefined();
  });

  it("returns help for unparseable input", async () => {
    const result = await svc.execute("send message", ctx);
    expect(result.text).toContain("couldn't parse");
    expect(result.text).toContain("Telegram");
    expect(result.text).toContain("email");
  });

  it("lists platforms", async () => {
    const result = await svc.execute("list messaging platforms", ctx);
    expect(result.text).toContain("Telegram");
    expect(result.text).toContain("Email");
    expect(result.text).toContain("Discord");
    expect(result.text).toContain("WhatsApp");
  });

  it("handles telegram setup", async () => {
    const result = await svc.execute("setup telegram", ctx);
    expect(result.text).toContain("@BotFather");
    expect(result.text).toContain("bot token");
  });

  it("handles email setup", async () => {
    const result = await svc.execute("setup email", ctx);
    expect(result.text).toContain("Gmail");
    expect(result.text).toContain("App Password");
  });

  it("handles discord setup", async () => {
    const result = await svc.execute("setup discord", ctx);
    expect(result.text).toContain("webhook");
  });
});
