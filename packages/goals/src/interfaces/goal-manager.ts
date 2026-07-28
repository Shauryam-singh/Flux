import type { Goal, GoalUpdate, Blocker } from "../types/goal.js";
import type { WorldState } from "@ai-agent/world-model";

export interface GoalManager {
  create(goal: Omit<Goal, "id" | "createdAt" | "updatedAt" | "completedAt" | "subGoalIds">): Goal;
  getActive(): Goal | null;
  getAll(): ReadonlyArray<Goal>;
  getById(id: string): Goal | null;
  update(update: GoalUpdate): Goal;
  complete(goalId: string): Goal;
  addSubGoal(parentId: string, subGoal: Omit<Goal, "id" | "parentGoalId" | "createdAt" | "updatedAt" | "completedAt" | "subGoalIds">): Goal;
  detectBlockers(worldState: WorldState): ReadonlyArray<Blocker>;
  evaluateProgress(worldState: WorldState): number;
  onChange(handler: (goal: Goal, change: "created" | "updated" | "completed" | "blocked") => void): () => void;
}
