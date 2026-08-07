import { describe, it, expect } from "vitest";
import { createSlackDiscordService } from "../impl/slack-discord-service.js";

describe("SlackDiscordService", () => {
  const svc = createSlackDiscordService();

  it("has correct name", () => {
    expect(svc.name).toBe("slack-discord");
  });

  it("can handle slack commands", () => {
    expect(svc.canHandle("read slack general")).toBe(true);
    expect(svc.canHandle("send slack general hello")).toBe(true);
    expect(svc.canHandle("react slack general thumbsup")).toBe(true);
    expect(svc.canHandle("list slack channels")).toBe(true);
    expect(svc.canHandle("search slack meeting notes")).toBe(true);
    expect(svc.canHandle("thread slack general reply here")).toBe(true);
  });

  it("can handle discord commands", () => {
    expect(svc.canHandle("read discord general")).toBe(true);
    expect(svc.canHandle("send discord general hello")).toBe(true);
    expect(svc.canHandle("react discord 👍")).toBe(true);
    expect(svc.canHandle("list discord channels")).toBe(true);
  });

  it("rejects unrelated input", () => {
    expect(svc.canHandle("hello world")).toBe(false);
    expect(svc.canHandle("play music")).toBe(false);
    expect(svc.canHandle("open firefox")).toBe(false);
  });

  it("returns config error when tokens not set", async () => {
    const ctx = { sessionId: "test", memory: { add: async () => {}, history: async () => [], clear: () => {} } as never, provider: null, reply: () => {}, speak: () => {}, emit: () => {} };
    const result = await svc.execute("read slack general", ctx);
    expect(result.text).toContain("not configured");
  });

  it("returns config error for discord without tokens", async () => {
    const ctx = { sessionId: "test", memory: { add: async () => {}, history: async () => [], clear: () => {} } as never, provider: null, reply: () => {}, speak: () => {}, emit: () => {} };
    const result = await svc.execute("read discord general", ctx);
    expect(result.text).toContain("not configured");
  });
});
