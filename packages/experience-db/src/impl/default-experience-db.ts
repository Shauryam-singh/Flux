import type { Experience, ExperienceOutcome, ExperienceQuery } from "@ai-agent/evo-types";
import type { ExperienceDatabase } from "../interfaces/experience-db.js";

let experienceCounter = 0;

export class DefaultExperienceDatabase implements ExperienceDatabase {
  private readonly experiences: Experience[] = [];

  record(experience: Omit<Experience, "id" | "timestamp">): Experience {
    const recorded: Experience = {
      ...experience,
      id: `exp_${++experienceCounter}`,
      timestamp: Date.now(),
    };
    this.experiences.push(recorded);
    return recorded;
  }

  get(experienceId: string): Experience | null {
    return this.experiences.find((e) => e.id === experienceId) ?? null;
  }

  getAll(): ReadonlyArray<Experience> {
    return [...this.experiences];
  }

  query(query: ExperienceQuery): ReadonlyArray<Experience> {
    let results = [...this.experiences];

    if (query.situation !== undefined && query.situation !== null) {
      const lowerSituation = query.situation.toLowerCase();
      results = results.filter((e) => e.situation.toLowerCase().includes(lowerSituation));
    }

    if (query.outcome !== undefined && query.outcome !== null) {
      results = results.filter((e) => e.outcome === query.outcome);
    }

    if (query.minSuccessScore !== undefined && query.minSuccessScore !== null) {
      results = results.filter((e) => e.successScore >= query.minSuccessScore!);
    }

    if (query.tags !== undefined && query.tags !== null) {
      results = results.filter((e) => query.tags!.every((tag) => e.tags.includes(tag)));
    }

    if (query.since !== undefined && query.since !== null) {
      results = results.filter((e) => e.timestamp >= query.since!);
    }

    if (query.limit !== undefined && query.limit !== null) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  getSuccessful(): ReadonlyArray<Experience> {
    return this.experiences.filter((e) => e.outcome === "success");
  }

  getFailed(): ReadonlyArray<Experience> {
    return this.experiences.filter((e) => e.outcome === "failure");
  }

  getByStrategy(strategyId: string): ReadonlyArray<Experience> {
    return this.experiences.filter((e) => e.strategyUsed === strategyId);
  }

  getRecent(count: number): ReadonlyArray<Experience> {
    return [...this.experiences]
      .sort((a, b) => b.timestamp - a.timestamp || b.id.localeCompare(a.id))
      .slice(0, count);
  }

  getAverageSuccessScore(): number {
    if (this.experiences.length === 0) return 0;
    const total = this.experiences.reduce((sum, e) => sum + e.successScore, 0);
    return total / this.experiences.length;
  }

  count(): number {
    return this.experiences.length;
  }

  delete(experienceId: string): void {
    const index = this.experiences.findIndex((e) => e.id === experienceId);
    if (index !== -1) {
      this.experiences.splice(index, 1);
    }
  }
}
