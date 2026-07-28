import type { Skill } from "@ai-agent/evo-types";

export interface SkillLibrary {
  create(name: string, description: string, category: string, steps: ReadonlyArray<string>, prerequisites?: ReadonlyArray<string>, source?: Skill["source"]): Skill;
  get(skillId: string): Skill | null;
  getAll(): ReadonlyArray<Skill>;
  getByName(name: string): Skill | null;
  getByCategory(category: string): ReadonlyArray<Skill>;
  recordUsage(skillId: string, success: boolean, duration: number): void;
  compose(name: string, description: string, category: string, skillIds: ReadonlyArray<string>): Skill;
  getBestSkills(): ReadonlyArray<Skill>;
  delete(skillId: string): void;
  getTopSkills(count: number): ReadonlyArray<Skill>;
}
