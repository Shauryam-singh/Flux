import { describe, it, expect, beforeEach } from "vitest";
import { DefaultBackgroundProjectManager } from "../impl/default-background-projects.js";

describe("DefaultBackgroundProjectManager", () => {
  let manager: DefaultBackgroundProjectManager;

  beforeEach(() => {
    manager = new DefaultBackgroundProjectManager();
  });

  it("should create projects", () => {
    const project = manager.create({ name: "Monitor repo", description: "Watch for changes", schedule: { type: "interval", intervalMs: 60000, cronExpression: null, eventTrigger: null, enabled: true }, tasks: [] });
    expect(project.id).toMatch(/^bp_/);
    expect(project.status).toBe("active");
  });

  it("should pause and resume", () => {
    const project = manager.create({ name: "Test", description: "", schedule: { type: "interval", intervalMs: 60000, cronExpression: null, eventTrigger: null, enabled: true }, tasks: [] });
    manager.pause(project.id);
    expect(manager.get(project.id)!.status).toBe("paused");
    manager.resume(project.id);
    expect(manager.get(project.id)!.status).toBe("active");
  });

  it("should record runs", () => {
    const project = manager.create({ name: "Test", description: "", schedule: { type: "interval", intervalMs: 60000, cronExpression: null, eventTrigger: null, enabled: true }, tasks: [] });
    manager.recordRun(project.id, true);
    expect(manager.get(project.id)!.runCount).toBe(1);
    expect(manager.get(project.id)!.successCount).toBe(1);
  });

  it("should get due projects", () => {
    const project = manager.create({ name: "Test", description: "", schedule: { type: "interval", intervalMs: 0, cronExpression: null, eventTrigger: null, enabled: true }, tasks: [] });
    const due = manager.getDue();
    expect(due.length).toBe(1);
  });
});
