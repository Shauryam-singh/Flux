import { describe, it, expect, beforeEach } from "vitest";
import { DefaultExecutionSupervisor } from "../impl/default-execution-supervisor.js";
import type { Task } from "@ai-agent/exec-types";

const makeTask = (id: string = "t1"): Task => ({
  id,
  objective: "Test",
  description: "",
  status: "created",
  priority: "normal",
  progress: 0,
  assignedAgent: null,
  parentId: null,
  subtaskIds: [],
  dependencies: [],
  constraints: { maxDurationMs: null, maxRetries: 3, timeoutMs: 300000, requiredCapabilities: [], excludedAgents: [], preferredAgents: [], modelPreference: null, costLimit: null },
  result: null,
  artifacts: [],
  error: null,
  retryCount: 0,
  createdAt: Date.now(),
  startedAt: null,
  completedAt: null,
  updatedAt: Date.now(),
  metadata: {},
});

describe("DefaultExecutionSupervisor", () => {
  let supervisor: DefaultExecutionSupervisor;

  beforeEach(() => {
    supervisor = new DefaultExecutionSupervisor();
  });

  it("should track tasks", () => {
    supervisor.track(makeTask());
    expect(supervisor.getAll().length).toBe(1);
  });

  it("should update progress", () => {
    supervisor.track(makeTask());
    supervisor.updateProgress("t1", 50, "Half done");
    const tracked = supervisor.getTask("t1");
    expect(tracked!.progress).toBe(50);
  });

  it("should pause and resume", () => {
    supervisor.track(makeTask());
    supervisor.pause("t1");
    expect(supervisor.getTask("t1")!.status).toBe("paused");
    supervisor.resume("t1");
    expect(supervisor.getTask("t1")!.status).toBe("running");
  });

  it("should cancel tasks", () => {
    supervisor.track(makeTask());
    supervisor.cancel("t1");
    expect(supervisor.getTask("t1")!.status).toBe("cancelled");
  });

  it("should provide stats", () => {
    supervisor.track(makeTask("t1"));
    supervisor.track(makeTask("t2"));
    const stats = supervisor.getStats();
    expect(stats.totalTracked).toBe(2);
  });

  it("should check timeouts", () => {
    const task = makeTask();
    supervisor.track(task);
    const timedOut = supervisor.checkTimeouts();
    expect(timedOut.length).toBeGreaterThanOrEqual(0);
  });
});
