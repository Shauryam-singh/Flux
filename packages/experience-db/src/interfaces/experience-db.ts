import type { Experience, ExperienceOutcome, ExperienceQuery } from "@ai-agent/evo-types";

export interface ExperienceDatabase {
  record(experience: Omit<Experience, "id" | "timestamp">): Experience;
  get(experienceId: string): Experience | null;
  getAll(): ReadonlyArray<Experience>;
  query(query: ExperienceQuery): ReadonlyArray<Experience>;
  getSuccessful(): ReadonlyArray<Experience>;
  getFailed(): ReadonlyArray<Experience>;
  getByStrategy(strategyId: string): ReadonlyArray<Experience>;
  getRecent(count: number): ReadonlyArray<Experience>;
  getAverageSuccessScore(): number;
  count(): number;
  delete(experienceId: string): void;
}
