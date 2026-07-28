import type { GoalManager } from "../interfaces/goal-manager.js";
import type { Goal, GoalUpdate, Blocker } from "../types/goal.js";
import type { WorldState } from "@ai-agent/world-model";

export class DefaultGoalManager implements GoalManager {
  private goals: Goal[] = [];
  private idCounter = 0;
  private handlers: Array<(goal: Goal, change: "created" | "updated" | "completed" | "blocked") => void> = [];

  create(data: Omit<Goal, "id" | "createdAt" | "updatedAt" | "completedAt" | "subGoalIds">): Goal {
    const now = Date.now();
    const goal: Goal = {
      ...data,
      id: `goal_${++this.idCounter}`,
      subGoalIds: [],
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    this.goals.push(goal);

    if (goal.status === "active" || (goal.status === "created" && !this.getActive())) {
      const activated = this.setStatus(goal.id, "active");
      if (activated) {
        this.emit(activated, "created");
        return activated;
      }
    }

    this.emit(goal, "created");
    return goal;
  }

  getActive(): Goal | null {
    return this.goals.find((g) => g.status === "active" || g.status === "in_progress") ?? null;
  }

  getAll(): ReadonlyArray<Goal> {
    return this.goals;
  }

  getById(id: string): Goal | null {
    return this.goals.find((g) => g.id === id) ?? null;
  }

  update(update: GoalUpdate): Goal {
    const goal = this.goals.find((g) => g.id === update.goalId);
    if (!goal) throw new Error(`Goal not found: ${update.goalId}`);

    const idx = this.goals.indexOf(goal);
    const updated: Goal = {
      ...goal,
      ...update.changes,
      updatedAt: Date.now(),
    };
    this.goals[idx] = updated;

    const change = update.changes.status === "completed"
      ? "completed"
      : update.changes.blockers && update.changes.blockers.length > 0
        ? "blocked"
        : "updated";

    if (update.changes.status === "completed") {
      this.goals[idx] = { ...updated, completedAt: Date.now() };
    }

    this.emit(this.goals[idx]!, change);
    return this.goals[idx]!;
  }

  complete(goalId: string): Goal {
    return this.update({ goalId, changes: { status: "completed", progress: 100 } });
  }

  addSubGoal(parentId: string, subGoal: Omit<Goal, "id" | "parentGoalId" | "createdAt" | "updatedAt" | "completedAt" | "subGoalIds">): Goal {
    const parent = this.goals.find((g) => g.id === parentId);
    if (!parent) throw new Error(`Parent goal not found: ${parentId}`);

    const child = this.create({ ...subGoal, parentGoalId: parentId });
    const parentIdx = this.goals.indexOf(parent);
    this.goals[parentIdx] = {
      ...parent,
      subGoalIds: [...parent.subGoalIds, child.id],
      updatedAt: Date.now(),
    };
    return child;
  }

  detectBlockers(worldState: WorldState): ReadonlyArray<Blocker> {
    const blockers: Blocker[] = [];
    const active = this.getActive();
    if (!active) return blockers;

    for (const err of worldState.system.openErrors) {
      blockers.push({
        id: `blocker_${err.source}_${err.timestamp}`,
        description: err.message,
        severity: "high",
        detectedAt: err.timestamp,
        resolvedAt: null,
      });
    }

    return blockers;
  }

  evaluateProgress(_worldState: WorldState): number {
    const active = this.getActive();
    if (!active) return 0;
    return active.progress;
  }

  onChange(handler: (goal: Goal, change: "created" | "updated" | "completed" | "blocked") => void): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  private setStatus(goalId: string, status: Goal["status"]): Goal | null {
    const idx = this.goals.findIndex((g) => g.id === goalId);
    if (idx === -1) return null;
    this.goals[idx] = { ...this.goals[idx]!, status, updatedAt: Date.now() };
    return this.goals[idx]!;
  }

  private emit(goal: Goal, change: "created" | "updated" | "completed" | "blocked"): void {
    for (const handler of this.handlers) {
      handler(goal, change);
    }
  }
}
