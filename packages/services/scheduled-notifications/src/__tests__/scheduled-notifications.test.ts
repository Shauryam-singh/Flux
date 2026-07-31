import { describe, it, expect, vi, beforeEach } from "vitest";
import { createScheduledNotificationsServiceAt } from "../impl/scheduled-notifications-service.js";
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

describe("ScheduledNotificationsService", () => {
  let svc: ReturnType<typeof createScheduledNotificationsServiceAt>;
  let ctx: ServiceContext;

  beforeEach(() => {
    const tmpFile = `/tmp/flux-test-sched-notif-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
    svc = createScheduledNotificationsServiceAt(tmpFile);
    ctx = makeCtx();
  });

  it("has correct name", () => {
    expect(svc.name).toBe("scheduled-notifications");
  });

  it("can handle schedule intent", () => {
    expect(svc.canHandle("notify me in 5 minutes")).toBe(true);
    expect(svc.canHandle("schedule a notification")).toBe(true);
    expect(svc.canHandle("remind me at 3pm")).toBe(true);
  });

  it("can handle list intent", () => {
    expect(svc.canHandle("show my notifications")).toBe(true);
    expect(svc.canHandle("list scheduled reminders")).toBe(true);
  });

  it("can handle cancel intent", () => {
    expect(svc.canHandle("cancel notification")).toBe(true);
    expect(svc.canHandle("clear all reminders")).toBe(true);
  });

  it("can handle test intent", () => {
    expect(svc.canHandle("test notification")).toBe(true);
    expect(svc.canHandle("fire a reminder")).toBe(true);
  });

  it("rejects unrelated input", () => {
    expect(svc.canHandle("hello world")).toBe(false);
    expect(svc.canHandle("what time is it")).toBe(false);
  });

  it("schedules a notification with delay", async () => {
    const result = await svc.execute("notify me in 1 hour to stretch", ctx);
    expect(result.text).toContain("Scheduled");
    expect(result.text).toContain("stretch");
  });

  it("lists pending notifications", async () => {
    await svc.execute("notify me in 1 hour to stretch", ctx);
    await svc.execute("notify me in 2 hours to eat", ctx);
    const result = await svc.execute("show my scheduled notifications", ctx);
    expect(result.text).toContain("stretch");
    expect(result.text).toContain("eat");
  });

  it("returns message when no notifications", async () => {
    const result = await svc.execute("show my scheduled notifications", ctx);
    expect(result.text).toContain("No scheduled notifications");
  });

  it("fires a test notification", async () => {
    const result = await svc.execute("fire a test notification", ctx);
    expect(result.text).toContain("Test notification sent");
  });

  it("returns help when unparseable", async () => {
    const result = await svc.execute("schedule a notification", ctx);
    expect(result.text).toContain("couldn't parse");
  });
});
