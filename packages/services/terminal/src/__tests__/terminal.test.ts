import { describe, it, expect } from "vitest";
import { createTerminalService } from "../impl/terminal-service.js";

describe("TerminalService", () => {
  const svc = createTerminalService();

  it("has correct name", () => {
    expect(svc.name).toBe("terminal");
  });

  it("can handle terminal commands", () => {
    expect(svc.canHandle("run ls -la")).toBe(true);
    expect(svc.canHandle("execute npm test")).toBe(true);
    expect(svc.canHandle("ssh server@example.com")).toBe(true);
    expect(svc.canHandle("tmux new dev")).toBe(true);
    expect(svc.canHandle("tmux attach dev")).toBe(true);
    expect(svc.canHandle("tmux kill dev")).toBe(true);
    expect(svc.canHandle("tmux list")).toBe(true);
    expect(svc.canHandle("tmux split")).toBe(true);
    expect(svc.canHandle("tmux next")).toBe(true);
    expect(svc.canHandle("tmux prev")).toBe(true);
    expect(svc.canHandle("list processes")).toBe(true);
    expect(svc.canHandle("kill process firefox")).toBe(true);
    expect(svc.canHandle("run background sleep 100")).toBe(true);
    expect(svc.canHandle("run in /tmp ls")).toBe(true);
  });

  it("can handle shell variant", () => {
    expect(svc.canHandle("shell echo hello")).toBe(true);
    expect(svc.canHandle("command help")).toBe(true);
  });

  it("rejects unrelated input", () => {
    expect(svc.canHandle("hello world")).toBe(false);
    expect(svc.canHandle("play music")).toBe(false);
    expect(svc.canHandle("what time is it")).toBe(false);
  });

  it("runs a real command", async () => {
    const ctx = { sessionId: "test", memory: { add: async () => {}, history: async () => [], clear: () => {} } as never, provider: null, reply: () => {}, speak: () => {}, emit: () => {} };
    const result = await svc.execute("run echo hello", ctx);
    expect(result.text).toContain("hello");
  });

  it("lists tmux sessions", async () => {
    const ctx = { sessionId: "test", memory: { add: async () => {}, history: async () => [], clear: () => {} } as never, provider: null, reply: () => {}, speak: () => {}, emit: () => {} };
    const result = await svc.execute("tmux list", ctx);
    expect(result.text).toBeDefined();
  });
});
