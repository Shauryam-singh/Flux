import { describe, it, expect, vi } from "vitest";
import { DefaultGoalManager } from "../impl/default-goal-manager.js";
import type { WorldState } from "@ai-agent/world-model";
import { DEFAULT_APPLICATION_STATE, DEFAULT_SYSTEM_STATE } from "@ai-agent/world-model";

function makeWorldState(overrides?: Partial<WorldState>): WorldState {
  return {
    project: null,
    application: DEFAULT_APPLICATION_STATE,
    system: DEFAULT_SYSTEM_STATE,
    timestamp: Date.now(),
    version: 0,
    ...overrides,
  };
}

describe("DefaultGoalManager", () => {
  it("should create goals", () => {
    const gm = new DefaultGoalManager();
    const goal = gm.create({
      title: "Implement feature",
      description: "Build the thing",
      status: "active",
      priority: 80,
      progress: 0,
      source: "user_request",
      parentGoalId: null,
      blockers: [],
      dependencies: [],
      estimatedCompletion: null,
    });
    expect(goal.id).toBeDefined();
    expect(goal.title).toBe("Implement feature");
    expect(goal.status).toBe("active");
  });

  it("should activate first goal", () => {
    const gm = new DefaultGoalManager();
    gm.create({
      title: "Goal 1",
      description: "",
      status: "created",
      priority: 80,
      progress: 0,
      source: "user_request",
      parentGoalId: null,
      blockers: [],
      dependencies: [],
      estimatedCompletion: null,
    });
    expect(gm.getActive()).not.toBeNull();
    expect(gm.getActive()!.title).toBe("Goal 1");
  });

  it("should get all goals", () => {
    const gm = new DefaultGoalManager();
    gm.create({ title: "G1", description: "", status: "active", priority: 80, progress: 0, source: "user_request", parentGoalId: null, blockers: [], dependencies: [], estimatedCompletion: null });
    gm.create({ title: "G2", description: "", status: "active", priority: 80, progress: 0, source: "user_request", parentGoalId: null, blockers: [], dependencies: [], estimatedCompletion: null });
    expect(gm.getAll()).toHaveLength(2);
  });

  it("should get goal by id", () => {
    const gm = new DefaultGoalManager();
    const goal = gm.create({ title: "G1", description: "", status: "active", priority: 80, progress: 0, source: "user_request", parentGoalId: null, blockers: [], dependencies: [], estimatedCompletion: null });
    expect(gm.getById(goal.id)).not.toBeNull();
    expect(gm.getById("nonexistent")).toBeNull();
  });

  it("should update goals", () => {
    const gm = new DefaultGoalManager();
    const goal = gm.create({ title: "G1", description: "", status: "active", priority: 80, progress: 0, source: "user_request", parentGoalId: null, blockers: [], dependencies: [], estimatedCompletion: null });
    const updated = gm.update({ goalId: goal.id, changes: { progress: 50 } });
    expect(updated.progress).toBe(50);
  });

  it("should complete goals", () => {
    const gm = new DefaultGoalManager();
    const goal = gm.create({ title: "G1", description: "", status: "active", priority: 80, progress: 0, source: "user_request", parentGoalId: null, blockers: [], dependencies: [], estimatedCompletion: null });
    const completed = gm.complete(goal.id);
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).not.toBeNull();
  });

  it("should add sub-goals", () => {
    const gm = new DefaultGoalManager();
    const parent = gm.create({ title: "Parent", description: "", status: "active", priority: 80, progress: 0, source: "user_request", parentGoalId: null, blockers: [], dependencies: [], estimatedCompletion: null });
    const child = gm.addSubGoal(parent.id, {
      title: "Child",
      description: "",
      status: "active",
      priority: 80,
      progress: 0,
      source: "user_request",
      blockers: [],
      dependencies: [],
      estimatedCompletion: null,
    });
    expect(child.parentGoalId).toBe(parent.id);
    const updatedParent = gm.getById(parent.id)!;
    expect(updatedParent.subGoalIds).toContain(child.id);
  });

  it("should detect blockers from world state", () => {
    const gm = new DefaultGoalManager();
    gm.create({ title: "G1", description: "", status: "active", priority: 80, progress: 0, source: "user_request", parentGoalId: null, blockers: [], dependencies: [], estimatedCompletion: null });
    const worldState = makeWorldState({
      system: { ...DEFAULT_SYSTEM_STATE, openErrors: [{ source: "build", message: "TS2345", timestamp: Date.now() }] },
    });
    const blockers = gm.detectBlockers(worldState);
    expect(blockers.length).toBeGreaterThan(0);
  });

  it("should emit onChange on create", () => {
    const gm = new DefaultGoalManager();
    const handler = vi.fn();
    gm.onChange(handler);
    gm.create({ title: "G1", description: "", status: "active", priority: 80, progress: 0, source: "user_request", parentGoalId: null, blockers: [], dependencies: [], estimatedCompletion: null });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should emit onChange on update", () => {
    const gm = new DefaultGoalManager();
    const goal = gm.create({ title: "G1", description: "", status: "active", priority: 80, progress: 0, source: "user_request", parentGoalId: null, blockers: [], dependencies: [], estimatedCompletion: null });
    const handler = vi.fn();
    gm.onChange(handler);
    gm.update({ goalId: goal.id, changes: { progress: 50 } });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should throw for nonexistent goal update", () => {
    const gm = new DefaultGoalManager();
    expect(() => gm.update({ goalId: "nonexistent", changes: { progress: 50 } })).toThrow();
  });
});
