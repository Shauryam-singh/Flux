import type { BackgroundProjectManager } from "../interfaces/background-projects.js";
import type { BackgroundProject, ProjectSchedule, ProjectStatus } from "@ai-agent/exec-types";

let projectIdCounter = 0;

export class DefaultBackgroundProjectManager implements BackgroundProjectManager {
  private projects = new Map<string, BackgroundProject>();

  create(data: Omit<BackgroundProject, "id" | "status" | "lastRun" | "nextRun" | "runCount" | "successCount" | "failureCount" | "createdAt" | "updatedAt">): BackgroundProject {
    const project: BackgroundProject = {
      ...data,
      id: `bp_${++projectIdCounter}`,
      status: "active",
      lastRun: null,
      nextRun: Date.now() + (data.schedule.intervalMs ?? 3600000),
      runCount: 0,
      successCount: 0,
      failureCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.projects.set(project.id, project);
    return project;
  }

  pause(projectId: string): void {
    const p = this.projects.get(projectId);
    if (p) this.projects.set(projectId, { ...p, status: "paused", updatedAt: Date.now() });
  }

  resume(projectId: string): void {
    const p = this.projects.get(projectId);
    if (p) this.projects.set(projectId, { ...p, status: "active", updatedAt: Date.now() });
  }

  cancel(projectId: string): void {
    const p = this.projects.get(projectId);
    if (p) this.projects.set(projectId, { ...p, status: "cancelled", updatedAt: Date.now() });
  }

  delete(projectId: string): void {
    this.projects.delete(projectId);
  }

  get(projectId: string): BackgroundProject | null {
    return this.projects.get(projectId) ?? null;
  }

  getAll(): ReadonlyArray<BackgroundProject> {
    return Array.from(this.projects.values());
  }

  getActive(): ReadonlyArray<BackgroundProject> {
    return Array.from(this.projects.values()).filter((p) => p.status === "active");
  }

  getDue(): ReadonlyArray<BackgroundProject> {
    const now = Date.now();
    return Array.from(this.projects.values()).filter(
      (p) => p.status === "active" && p.nextRun !== null && p.nextRun <= now,
    );
  }

  recordRun(projectId: string, success: boolean): void {
    const p = this.projects.get(projectId);
    if (p) {
      const nextRun = p.schedule.type === "interval" && p.schedule.intervalMs
        ? Date.now() + p.schedule.intervalMs
        : null;
      this.projects.set(projectId, {
        ...p,
        lastRun: Date.now(),
        nextRun,
        runCount: p.runCount + 1,
        successCount: p.successCount + (success ? 1 : 0),
        failureCount: p.failureCount + (success ? 0 : 1),
        updatedAt: Date.now(),
      });
    }
  }

  updateSchedule(projectId: string, schedule: ProjectSchedule): void {
    const p = this.projects.get(projectId);
    if (p) {
      this.projects.set(projectId, { ...p, schedule, updatedAt: Date.now() });
    }
  }
}
