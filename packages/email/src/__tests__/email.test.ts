import { describe, it, expect, beforeEach } from "vitest";
import { DefaultEmailSensor } from "../impl/default-email-sensor.js";
import type { EmailMessage } from "@ai-agent/ambient-types";

describe("DefaultEmailSensor", () => {
  let sensor: DefaultEmailSensor;

  beforeEach(() => {
    sensor = new DefaultEmailSensor();
  });

  const makeEmail = (overrides: Partial<EmailMessage> = {}): EmailMessage => ({
    id: `em_${Math.random()}`,
    threadId: "t1",
    from: "alice@example.com",
    fromName: "Alice",
    to: ["me@example.com"],
    subject: "Meeting tomorrow",
    snippet: "Can we meet at 3pm?",
    timestamp: Date.now(),
    isRead: false,
    isStarred: false,
    hasAttachments: false,
    attachmentCount: 0,
    priority: "normal",
    labels: [],
    replyDeadline: null,
    ...overrides,
  });

  it("should return empty state by default", async () => {
    const state = await sensor.getState();
    expect(state.unreadCount).toBe(0);
    expect(state.urgentCount).toBe(0);
  });

  it("should track unread emails", async () => {
    sensor.addEmail(makeEmail({ isRead: false }));
    sensor.addEmail(makeEmail({ isRead: true }));
    const state = await sensor.getState();
    expect(state.unreadCount).toBe(1);
  });

  it("should track urgent emails", async () => {
    sensor.addEmail(makeEmail({ priority: "urgent", isRead: false }));
    const state = await sensor.getState();
    expect(state.urgentCount).toBe(1);
  });

  it("should mark emails as read", async () => {
    const email = makeEmail({ isRead: false });
    sensor.addEmail(email);
    await sensor.markRead(email.id);
    const state = await sensor.getState();
    expect(state.unreadCount).toBe(0);
  });

  it("should track pending replies", async () => {
    sensor.addEmail(makeEmail({ replyDeadline: Date.now() + 3600000, isRead: false }));
    const replies = await sensor.getPendingReplies();
    expect(replies.length).toBe(1);
  });
});
