import { describe, it, expect, beforeEach } from "vitest";
import { DefaultMessageBus } from "../impl/default-message-bus.js";
import type { AgentMessage } from "@ai-agent/exec-types";

const makeMsg = (overrides: Partial<AgentMessage> = {}): AgentMessage => ({
  id: "msg_1",
  type: "task_request",
  from: "executive",
  to: "coding",
  taskId: "t1",
  timestamp: Date.now(),
  payload: {},
  correlationId: null,
  ...overrides,
});

describe("DefaultMessageBus", () => {
  let bus: DefaultMessageBus;

  beforeEach(() => {
    bus = new DefaultMessageBus();
  });

  it("should publish and deliver to target", () => {
    let received: AgentMessage | null = null;
    bus.subscribe("coding", (msg) => { received = msg; });
    bus.publish(makeMsg({ to: "coding" }));
    expect(received).not.toBeNull();
    expect(received!.to).toBe("coding");
  });

  it("should subscribe to message type", () => {
    let received: AgentMessage | null = null;
    bus.subscribeToType("task_completed", (msg) => { received = msg; });
    bus.publish(makeMsg({ type: "task_completed" }));
    expect(received).not.toBeNull();
  });

  it("should track stats", () => {
    bus.subscribe("coding", () => {});
    bus.publish(makeMsg({ to: "coding" }));
    const stats = bus.getStats();
    expect(stats.published).toBe(1);
    expect(stats.delivered).toBe(1);
  });

  it("should count dropped messages", () => {
    bus.publish(makeMsg({ to: "nonexistent" }));
    const stats = bus.getStats();
    expect(stats.dropped).toBe(1);
  });

  it("should unsubscribe", () => {
    let count = 0;
    const unsub = bus.subscribe("coding", () => { count++; });
    bus.publish(makeMsg({ to: "coding" }));
    expect(count).toBe(1);
    unsub();
    bus.publish(makeMsg({ to: "coding" }));
    expect(count).toBe(1);
  });
});
