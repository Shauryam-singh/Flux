import type { SkillLibrary } from "../interfaces/skill-library.js";
import type { Skill } from "@ai-agent/evo-types";

export class DefaultSkillLibrary implements SkillLibrary {
  private skills: Map<string, Skill> = new Map();
  private counter = 0;

  create(
    name: string,
    description: string,
    category: string,
    steps: ReadonlyArray<string>,
    prerequisites: ReadonlyArray<string> = [],
    source: Skill["source"] = "discovered",
  ): Skill {
    const id = `sk_${++this.counter}`;
    const now = Date.now();
    const skill: Skill = {
      id,
      name,
      description,
      category,
      steps,
      prerequisites,
      successCount: 0,
      failureCount: 0,
      averageDuration: 0,
      confidence: 0.5,
      source,
      composedFrom: [],
      tags: [],
      createdAt: now,
      lastUsed: now,
    };
    this.skills.set(id, skill);
    return skill;
  }

  get(skillId: string): Skill | null {
    return this.skills.get(skillId) ?? null;
  }

  getAll(): ReadonlyArray<Skill> {
    return Array.from(this.skills.values());
  }

  getByName(name: string): Skill | null {
    for (const skill of this.skills.values()) {
      if (skill.name === name) return skill;
    }
    return null;
  }

  getByCategory(category: string): ReadonlyArray<Skill> {
    return Array.from(this.skills.values()).filter((s) => s.category === category);
  }

  recordUsage(skillId: string, success: boolean, duration: number): void {
    const skill = this.skills.get(skillId);
    if (!skill) throw new Error(`Skill not found: ${skillId}`);

    const totalUsage = skill.successCount + skill.failureCount + 1;
    const newSuccessCount = skill.successCount + (success ? 1 : 0);
    const newFailureCount = skill.failureCount + (success ? 0 : 1);
    const newAverageDuration =
      (skill.averageDuration * (skill.successCount + skill.failureCount) + duration) / totalUsage;
    const newConfidence = newSuccessCount / totalUsage;

    this.skills.set(skillId, {
      ...skill,
      successCount: newSuccessCount,
      failureCount: newFailureCount,
      averageDuration: newAverageDuration,
      confidence: newConfidence,
      lastUsed: Date.now(),
    });
  }

  compose(name: string, description: string, category: string, skillIds: ReadonlyArray<string>): Skill {
    const composedSteps: string[] = [];
    for (const skillId of skillIds) {
      const skill = this.skills.get(skillId);
      if (!skill) throw new Error(`Skill not found: ${skillId}`);
      composedSteps.push(...skill.steps);
    }

    const id = `sk_${++this.counter}`;
    const now = Date.now();
    const skill: Skill = {
      id,
      name,
      description,
      category,
      steps: composedSteps,
      prerequisites: [],
      successCount: 0,
      failureCount: 0,
      averageDuration: 0,
      confidence: 0.5,
      source: "composed",
      composedFrom: skillIds,
      tags: [],
      createdAt: now,
      lastUsed: now,
    };
    this.skills.set(id, skill);
    return skill;
  }

  getBestSkills(): ReadonlyArray<Skill> {
    return Array.from(this.skills.values()).sort((a, b) => b.confidence - a.confidence);
  }

  delete(skillId: string): void {
    this.skills.delete(skillId);
  }

  getTopSkills(count: number): ReadonlyArray<Skill> {
    return this.getBestSkills().slice(0, count);
  }
}
