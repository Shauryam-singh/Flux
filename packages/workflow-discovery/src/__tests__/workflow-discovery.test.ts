import { describe, it, expect } from "vitest";
import { DefaultWorkflowDiscovery } from "../impl/default-workflow-discovery.js";

describe("DefaultWorkflowDiscovery", () => {
  it("should record steps with sequential order", () => {
    const wd = new DefaultWorkflowDiscovery();
    wd.recordStep("commit", "git", { message: "fix bug" });
    wd.recordStep("push", "git", { remote: "origin" });
    const recent = wd.getRecentSteps(10);
    expect(recent).toHaveLength(2);
    expect(recent[0]!.order).toBe(0);
    expect(recent[1]!.order).toBe(1);
    expect(recent[0]!.action).toBe("commit");
    expect(recent[1]!.action).toBe("push");
  });

  it("should get recent steps limited by count", () => {
    const wd = new DefaultWorkflowDiscovery();
    for (let i = 0; i < 5; i++) {
      wd.recordStep(`action${i}`, "tool", {});
    }
    expect(wd.getRecentSteps(3)).toHaveLength(3);
    expect(wd.getRecentSteps(3)[0]!.action).toBe("action2");
  });

  it("should detect patterns with minimum frequency", () => {
    const wd = new DefaultWorkflowDiscovery();
    wd.recordStep("commit", "git", {});
    wd.recordStep("push", "git", {});
    wd.recordStep("commit", "git", {});
    wd.recordStep("push", "git", {});

    const patterns = wd.detectPatterns(2);
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0]!.frequency).toBeGreaterThanOrEqual(2);
    expect(patterns[0]!.id).toMatch(/^wp_/);
  });

  it("should not detect patterns below minFrequency", () => {
    const wd = new DefaultWorkflowDiscovery();
    wd.recordStep("commit", "git", {});
    wd.recordStep("push", "git", {});

    const patterns = wd.detectPatterns(5);
    expect(patterns).toHaveLength(0);
  });

  it("should return null for nonexistent pattern", () => {
    const wd = new DefaultWorkflowDiscovery();
    expect(wd.getPattern("nonexistent")).toBeNull();
  });

  it("should get all patterns", () => {
    const wd = new DefaultWorkflowDiscovery();
    wd.recordStep("a", "t", {});
    wd.recordStep("b", "t", {});
    wd.recordStep("a", "t", {});
    wd.recordStep("b", "t", {});
    wd.detectPatterns(2);
    expect(wd.getAllPatterns().length).toBeGreaterThan(0);
  });

  it("should filter patterns by category", () => {
    const wd = new DefaultWorkflowDiscovery();
    expect(wd.getPatternsByCategory("git")).toHaveLength(0);
  });

  it("should create template from pattern", () => {
    const wd = new DefaultWorkflowDiscovery();
    wd.recordStep("commit", "git", {});
    wd.recordStep("push", "git", {});
    wd.recordStep("commit", "git", {});
    wd.recordStep("push", "git", {});
    const patterns = wd.detectPatterns(2);
    expect(patterns.length).toBeGreaterThan(0);

    const template = wd.createTemplate(patterns[0]!.id, "Deploy Flow", "Auto deploy");
    expect(template.id).toMatch(/^wt_/);
    expect(template.name).toBe("Deploy Flow");
    expect(template.patternId).toBe(patterns[0]!.id);
    expect(template.steps).toEqual(patterns[0]!.steps);
  });

  it("should throw when creating template from nonexistent pattern", () => {
    const wd = new DefaultWorkflowDiscovery();
    expect(() => wd.createTemplate("nonexistent", "name", "desc")).toThrow("Pattern not found");
  });

  it("should get template by id", () => {
    const wd = new DefaultWorkflowDiscovery();
    wd.recordStep("a", "t", {});
    wd.recordStep("b", "t", {});
    wd.recordStep("a", "t", {});
    wd.recordStep("b", "t", {});
    const patterns = wd.detectPatterns(2);
    const template = wd.createTemplate(patterns[0]!.id, "t", "d");
    expect(wd.getTemplate(template.id)).not.toBeNull();
    expect(wd.getTemplate(template.id)!.id).toBe(template.id);
  });

  it("should return null for nonexistent template", () => {
    const wd = new DefaultWorkflowDiscovery();
    expect(wd.getTemplate("nonexistent")).toBeNull();
  });

  it("should get all templates", () => {
    const wd = new DefaultWorkflowDiscovery();
    wd.recordStep("a", "t", {});
    wd.recordStep("b", "t", {});
    wd.recordStep("a", "t", {});
    wd.recordStep("b", "t", {});
    const patterns = wd.detectPatterns(2);
    wd.createTemplate(patterns[0]!.id, "t1", "d1");
    wd.createTemplate(patterns[0]!.id, "t2", "d2");
    expect(wd.getTemplates()).toHaveLength(2);
  });

  it("should delete template", () => {
    const wd = new DefaultWorkflowDiscovery();
    wd.recordStep("a", "t", {});
    wd.recordStep("b", "t", {});
    wd.recordStep("a", "t", {});
    wd.recordStep("b", "t", {});
    const patterns = wd.detectPatterns(2);
    const template = wd.createTemplate(patterns[0]!.id, "t", "d");
    wd.deleteTemplate(template.id);
    expect(wd.getTemplate(template.id)).toBeNull();
    expect(wd.getTemplates()).toHaveLength(0);
  });
});
