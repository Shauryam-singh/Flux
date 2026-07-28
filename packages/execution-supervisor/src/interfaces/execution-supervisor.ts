import type { Task, TaskStatus } from "@ai-agent/exec-types";

export interface ExecutionSupervisor {
  track(task: Task): void;
  updateProgress(taskId: string, progress: number, message: string): void;
  pause(taskId: string): void;
  resume(taskId: string): void;
  cancel(taskId: string): void;
  retry(taskId: string): void;
  getTask(taskId: string): TrackedTask | null;
  getActive(): ReadonlyArray<TrackedTask>;
  getAll(): ReadonlyArray<TrackedTask>;
  getStats(): SupervisorStats;
  checkTimeouts(): ReadonlyArray<TrackedTask>;
}

export interface TrackedTask {
  readonly task: Task;
  readonly status: TaskStatus;
  readonly progress: number;
  readonly startedAt: number;
  readonly lastUpdate: number;
  readonly timeoutAt: number;
  readonly retryCount: number;
  readonly errors: ReadonlyArray<string>;
  readonly resourceAllocation: string | null;
}

export interface SupervisorStats {
  readonly totalTracked: number;
  readonly active: number;
  readonly paused: number;
  readonly completed: number;
  readonly failed: number;
  readonly timedOut: number;
}
