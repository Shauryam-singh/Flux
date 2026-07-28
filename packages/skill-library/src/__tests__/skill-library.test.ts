import { describe, it, expect } from "vitest";
import { DefaultSkillLibrary } from "../impl/default-skill-library.js";

describe("DefaultSkillLibrary", () => {
  it("should create a skill with generated id", () => {
    const lib = new DefaultSkillLibrary();
    const skill = lib.create("Git Commit", "Stage and commit changes", "git", ["stage", "commit"]);
    expect(skill.id).toMatch(/^sk_/);
    expect(skill.name).toBe("Git Commit");
    expect(skill.description).toBe("Stage and commit changes");
    expect(skill.category).toBe("git");
    expect(skill.steps).toEqual(["stage", "commit"]);
    expect(skill.source).toBe("discovered");
    expect(skill.confidence).toBe(0.5);
    expect(skill.successCount).toBe(0);
    expect(skill.failureCount).toBe(0);
  });

  it("should create skill with custom source and prerequisites", () => {
    const lib = new DefaultSkillLibrary();
    const skill = lib.create("Deploy", "Deploy app", "devops", ["build", "push"], ["docker"], "manual");
    expect(skill.source).toBe("manual");
    expect(skill.prerequisites).toEqual(["docker"]);
  });

  it("should get skill by id", () => {
    const lib = new DefaultSkillLibrary();
    const skill = lib.create("Test", "desc", "cat", []);
    expect(lib.get(skill.id)).not.toBeNull();
    expect(lib.get(skill.id)!.id).toBe(skill.id);
  });

  it("should return null for nonexistent skill", () => {
    const lib = new DefaultSkillLibrary();
    expect(lib.get("nonexistent")).toBeNull();
  });

  it("should get all skills", () => {
    const lib = new DefaultSkillLibrary();
    lib.create("A", "desc", "cat", []);
    lib.create("B", "desc", "cat", []);
    expect(lib.getAll()).toHaveLength(2);
  });

  it("should get skill by name", () => {
    const lib = new DefaultSkillLibrary();
    const skill = lib.create("UniqueName", "desc", "cat", []);
    expect(lib.getByName("UniqueName")!.id).toBe(skill.id);
    expect(lib.getByName("Nonexistent")).toBeNull();
  });

  it("should get skills by category", () => {
    const lib = new DefaultSkillLibrary();
    lib.create("A", "desc", "git", []);
    lib.create("B", "desc", "git", []);
    lib.create("C", "desc", "deploy", []);
    expect(lib.getByCategory("git")).toHaveLength(2);
    expect(lib.getByCategory("deploy")).toHaveLength(1);
    expect(lib.getByCategory("unknown")).toHaveLength(0);
  });

  it("should record usage and update stats", () => {
    const lib = new DefaultSkillLibrary();
    const skill = lib.create("Test", "desc", "cat", []);

    lib.recordUsage(skill.id, true, 100);
    const updated = lib.get(skill.id)!;
    expect(updated.successCount).toBe(1);
    expect(updated.failureCount).toBe(0);
    expect(updated.averageDuration).toBe(100);
    expect(updated.confidence).toBe(1);

    lib.recordUsage(skill.id, false, 200);
    const updated2 = lib.get(skill.id)!;
    expect(updated2.successCount).toBe(1);
    expect(updated2.failureCount).toBe(1);
    expect(updated2.averageDuration).toBe(150);
    expect(updated2.confidence).toBe(0.5);
  });

  it("should throw when recording usage for nonexistent skill", () => {
    const lib = new DefaultSkillLibrary();
    expect(() => lib.recordUsage("nonexistent", true, 100)).toThrow("Skill not found");
  });

  it("should compose skills from existing ones", () => {
    const lib = new DefaultSkillLibrary();
    const s1 = lib.create("A", "desc", "cat", ["step1", "step2"]);
    const s2 = lib.create("B", "desc", "cat", ["step3"]);

    const composed = lib.compose("Combined", "Combined skill", "cat", [s1.id, s2.id]);
    expect(composed.id).toMatch(/^sk_/);
    expect(composed.steps).toEqual(["step1", "step2", "step3"]);
    expect(composed.source).toBe("composed");
    expect(composed.composedFrom).toEqual([s1.id, s2.id]);
  });

  it("should throw when composing with nonexistent skill", () => {
    const lib = new DefaultSkillLibrary();
    expect(() => lib.compose("C", "desc", "cat", ["nonexistent"])).toThrow("Skill not found");
  });

  it("should get best skills sorted by confidence", () => {
    const lib = new DefaultSkillLibrary();
    const s1 = lib.create("Low", "desc", "cat", []);
    const s2 = lib.create("High", "desc", "cat", []);
    lib.recordUsage(s1.id, false, 100);
    lib.recordUsage(s2.id, true, 100);
    lib.recordUsage(s2.id, true, 100);

    const best = lib.getBestSkills();
    expect(best[0]!.id).toBe(s2.id);
    expect(best[1]!.id).toBe(s1.id);
  });

  it("should get top skills limited by count", () => {
    const lib = new DefaultSkillLibrary();
    lib.create("A", "desc", "cat", []);
    lib.create("B", "desc", "cat", []);
    lib.create("C", "desc", "cat", []);
    expect(lib.getTopSkills(2)).toHaveLength(2);
    expect(lib.getTopSkills(100)).toHaveLength(3);
  });

  it("should delete skill", () => {
    const lib = new DefaultSkillLibrary();
    const skill = lib.create("ToDelete", "desc", "cat", []);
    lib.delete(skill.id);
    expect(lib.get(skill.id)).toBeNull();
    expect(lib.getAll()).toHaveLength(0);
  });
});
