import type { ExecutionSupervisor, TrackedTask, SupervisorStats } from "../interfaces/execution-supervisor.js";
import type { Task, TaskStatus } from "@ai-agent/exec-types";

export class DefaultExecutionSupervisor implements ExecutionSupervisor {
  private tracked = new Map<string, TrackedTask>();

  track(task: Task): void {
    const tracked: TrackedTask = {
      task,
      status: task.status,
      progress: 0,
      startedAt: Date.now(),
      lastUpdate: Date.now(),
      timeoutAt: Date.now() + (task.constraints.timeoutMs || 300000),
      retryCount: 0,
      errors: [],
      resourceAllocation: null,
    };
    this.tracked.set(task.id, tracked);
  }

  updateProgress(taskId: string, progress: number, _message: string): void {
    const tracked = this.tracked.get(taskId);
    if (tracked) {
      this.tracked.set(taskId, { ...tracked, progress, lastUpdate: Date.now() });
    }
  }

  pause(taskId: string): void {
    const tracked = this.tracked.get(taskId);
    if (tracked) {
      this.tracked.set(taskId, { ...tracked, status: "paused" });
    }
  }

  resume(taskId: string): void {
    const tracked = this.tracked.get(taskId);
    if (tracked) {
      this.tracked.set(taskId, { ...tracked, status: "running" });
    }
  }

  cancel(taskId: string): void {
    const tracked = this.tracked.get(taskId);
    if (tracked) {
      this.tracked.set(taskId, { ...tracked, status: "cancelled" });
    }
  }

  retry(taskId: string): void {
    const tracked = this.tracked.get(taskId);
    if (tracked) {
      this.tracked.set(taskId, {
        ...tracked,
        status: "retrying",
        retryCount: tracked.retryCount + 1,
        timeoutAt: Date.now() + (tracked.task.constraints.timeoutMs || 300000),
      });
    }
  }

  getTask(taskId: string): TrackedTask | null {
    return this.tracked.get(taskId) ?? null;
  }

  getActive(): ReadonlyArray<TrackedTask> {
    return Array.from(this.tracked.values()).filter(
      (t) => t.status === "running" || t.status === "assigned",
    );
  }

  getAll(): ReadonlyArray<TrackedTask> {
    return Array.from(this.tracked.values());
  }

  getStats(): SupervisorStats {
    const all = Array.from(this.tracked.values());
    return {
      totalTracked: all.length,
      active: all.filter((t) => t.status === "running" || t.status === "assigned").length,
      paused: all.filter((t) => t.status === "paused").length,
      completed: all.filter((t) => t.status === "completed").length,
      failed: all.filter((t) => t.status === "failed").length,
      timedOut: all.filter((t) => t.status === "failed" && t.errors.some((e) => e.includes("timeout"))).length,
    };
  }

  checkTimeouts(): ReadonlyArray<TrackedTask> {
    const now = Date.now();
    const timedOut: TrackedTask[] = [];
    for (const tracked of this.tracked.values()) {
      if (tracked.status === "running" && now > tracked.timeoutAt) {
        this.tracked.set(tracked.task.id, {
          ...tracked,
          status: "failed",
          errors: [...tracked.errors, "Task timed out"],
        });
        timedOut.push(tracked);
      }
    }
    return timedOut;
  }
}
