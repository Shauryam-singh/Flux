import { describe, it, expect, beforeEach } from "vitest";
import { DefaultLongGoalManager } from "../impl/default-long-goals.js";

describe("DefaultLongGoalManager", () => {
  let manager: DefaultLongGoalManager;

  beforeEach(() => {
    manager = new DefaultLongGoalManager();
  });

  it("should create long goals", () => {
    const goal = manager.create("Learn Rust", "Master Rust programming");
    expect(goal.id).toMatch(/^lg_/);
    expect(goal.status).toBe("planning");
  });

  it("should add milestones", () => {
    const goal = manager.create("Learn Rust", "");
    const milestone = manager.addMilestone(goal.id, "Basics", "Learn syntax", []);
    expect(milestone.id).toMatch(/^ms_/);
  });

  it("should complete milestones", () => {
    const goal = manager.create("Learn Rust", "");
    const milestone = manager.addMilestone(goal.id, "Basics", "", []);
    manager.completeMilestone(goal.id, milestone.id);
    const updated = manager.get(goal.id)!;
    expect(updated.milestones[0]!.completed).toBe(true);
    expect(updated.progress).toBe(100);
  });

  it("should checkpoint", () => {
    const goal = manager.create("Learn Rust", "");
    const cp = manager.checkpoint(goal.id, "Made progress", { modules: 3 });
    expect(cp.id).toMatch(/^cp_/);
  });

  it("should pause and resume", () => {
    const goal = manager.create("Learn Rust", "");
    manager.updateStatus(goal.id, "active");
    manager.pause(goal.id);
    expect(manager.get(goal.id)!.status).toBe("paused");
    manager.resume(goal.id);
    expect(manager.get(goal.id)!.status).toBe("active");
  });

  it("should get active goals", () => {
    const g1 = manager.create("Goal 1", "");
    manager.create("Goal 2", "");
    manager.updateStatus(g1.id, "active");
    expect(manager.getActive().length).toBe(1);
  });
});
