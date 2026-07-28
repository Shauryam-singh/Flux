import type { LongGoalManager } from "../interfaces/long-goals.js";
import type { LongGoal, Milestone, Checkpoint, LongGoalStatus, TaskPriority } from "@ai-agent/exec-types";

let goalIdCounter = 0;
let milestoneIdCounter = 0;
let checkpointIdCounter = 0;

export class DefaultLongGoalManager implements LongGoalManager {
  private goals = new Map<string, LongGoal>();

  create(title: string, description: string, priority: TaskPriority = "normal", tags: ReadonlyArray<string> = []): LongGoal {
    const goal: LongGoal = {
      id: `lg_${++goalIdCounter}`,
      title,
      description,
      status: "planning",
      priority,
      progress: 0,
      subgoalIds: [],
      taskGraphId: null,
      milestones: [],
      checkpoints: [],
      estimatedDuration: null,
      actualDuration: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      completedAt: null,
      pausedAt: null,
      resumeAt: null,
      metadata: {},
      tags,
    };
    this.goals.set(goal.id, goal);
    return goal;
  }

  updateStatus(goalId: string, status: LongGoalStatus): void {
    const goal = this.goals.get(goalId);
    if (goal) {
      const now = Date.now();
      this.goals.set(goalId, {
        ...goal,
        status,
        completedAt: status === "completed" ? now : goal.completedAt,
        pausedAt: status === "paused" ? now : goal.pausedAt,
        resumeAt: status === "active" ? now : goal.resumeAt,
        updatedAt: now,
      });
    }
  }

  addMilestone(goalId: string, title: string, description: string, requiredTaskIds: ReadonlyArray<string>): Milestone {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`Goal ${goalId} not found`);

    const milestone: Milestone = {
      id: `ms_${++milestoneIdCounter}`,
      title,
      description,
      completed: false,
      completedAt: null,
      requiredTaskIds,
    };

    this.goals.set(goalId, {
      ...goal,
      milestones: [...goal.milestones, milestone],
      updatedAt: Date.now(),
    });

    return milestone;
  }

  completeMilestone(goalId: string, milestoneId: string): void {
    const goal = this.goals.get(goalId);
    if (goal) {
      const milestones = goal.milestones.map((m) =>
        m.id === milestoneId ? { ...m, completed: true, completedAt: Date.now() } : m,
      );
      const completedCount = milestones.filter((m) => m.completed).length;
      const progress = Math.round((completedCount / milestones.length) * 100);
      this.goals.set(goalId, { ...goal, milestones, progress, updatedAt: Date.now() });
    }
  }

  checkpoint(goalId: string, summary: string, state: Record<string, unknown>): Checkpoint {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error(`Goal ${goalId} not found`);

    const checkpoint: Checkpoint = {
      id: `cp_${++checkpointIdCounter}`,
      timestamp: Date.now(),
      state,
      summary,
      goalProgress: goal.progress,
    };

    this.goals.set(goalId, {
      ...goal,
      checkpoints: [...goal.checkpoints, checkpoint],
      updatedAt: Date.now(),
    });

    return checkpoint;
  }

  pause(goalId: string): void {
    this.updateStatus(goalId, "paused");
  }

  resume(goalId: string): void {
    this.updateStatus(goalId, "active");
  }

  cancel(goalId: string): void {
    this.updateStatus(goalId, "cancelled");
  }

  get(goalId: string): LongGoal | null {
    return this.goals.get(goalId) ?? null;
  }

  getAll(): ReadonlyArray<LongGoal> {
    return Array.from(this.goals.values());
  }

  getActive(): ReadonlyArray<LongGoal> {
    return Array.from(this.goals.values()).filter((g) => g.status === "active" || g.status === "in_progress");
  }

  getBlocked(): ReadonlyArray<LongGoal> {
    return Array.from(this.goals.values()).filter((g) => g.status === "blocked");
  }

  updateProgress(goalId: string, progress: number): void {
    const goal = this.goals.get(goalId);
    if (goal) {
      this.goals.set(goalId, { ...goal, progress: Math.min(100, Math.max(0, progress)), updatedAt: Date.now() });
    }
  }
}
