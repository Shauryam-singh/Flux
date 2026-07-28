import type { LongGoal, Milestone, Checkpoint, LongGoalStatus, TaskPriority } from "@ai-agent/exec-types";

export interface LongGoalManager {
  create(title: string, description: string, priority?: TaskPriority, tags?: ReadonlyArray<string>): LongGoal;
  updateStatus(goalId: string, status: LongGoalStatus): void;
  addMilestone(goalId: string, title: string, description: string, requiredTaskIds: ReadonlyArray<string>): Milestone;
  completeMilestone(goalId: string, milestoneId: string): void;
  checkpoint(goalId: string, summary: string, state: Record<string, unknown>): Checkpoint;
  pause(goalId: string): void;
  resume(goalId: string): void;
  cancel(goalId: string): void;
  get(goalId: string): LongGoal | null;
  getAll(): ReadonlyArray<LongGoal>;
  getActive(): ReadonlyArray<LongGoal>;
  getBlocked(): ReadonlyArray<LongGoal>;
  updateProgress(goalId: string, progress: number): void;
}
