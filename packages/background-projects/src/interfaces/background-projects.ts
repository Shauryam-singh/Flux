import type { BackgroundProject, ProjectSchedule, ProjectStatus } from "@ai-agent/exec-types";

export interface BackgroundProjectManager {
  create(project: Omit<BackgroundProject, "id" | "status" | "lastRun" | "nextRun" | "runCount" | "successCount" | "failureCount" | "createdAt" | "updatedAt">): BackgroundProject;
  pause(projectId: string): void;
  resume(projectId: string): void;
  cancel(projectId: string): void;
  delete(projectId: string): void;
  get(projectId: string): BackgroundProject | null;
  getAll(): ReadonlyArray<BackgroundProject>;
  getActive(): ReadonlyArray<BackgroundProject>;
  getDue(): ReadonlyArray<BackgroundProject>;
  recordRun(projectId: string, success: boolean): void;
  updateSchedule(projectId: string, schedule: ProjectSchedule): void;
}
