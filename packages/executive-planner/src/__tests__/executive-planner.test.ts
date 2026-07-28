import { describe, it, expect, beforeEach } from "vitest";
import { DefaultExecutivePlanner } from "../impl/default-executive-planner.js";
import { DefaultTaskGraphEngine } from "@ai-agent/task-graph";

describe("DefaultExecutivePlanner", () => {
  let planner: DefaultExecutivePlanner;

  beforeEach(() => {
    planner = new DefaultExecutivePlanner(new DefaultTaskGraphEngine());
  });

  it("should plan a simple objective", async () => {
    const plan = await planner.plan("Fix the bug");
    expect(plan.id).toMatch(/^plan_/);
    expect(plan.tasks.length).toBeGreaterThan(0);
    expect(plan.complexity).toBe("simple");
  });

  it("should plan an implementation objective", async () => {
    const plan = await planner.plan("Implement OAuth");
    expect(plan.tasks.length).toBe(3);
    expect(plan.complexity).toBe("moderate");
  });

  it("should get plan by id", async () => {
    const plan = await planner.plan("Test");
    expect(planner.getPlan(plan.id)).not.toBeNull();
  });

  it("should get active plans", async () => {
    await planner.plan("Plan 1");
    await planner.plan("Plan 2");
    expect(planner.getActivePlans().length).toBe(2);
  });

  it("should replan", async () => {
    const plan = await planner.plan("Original plan");
    const newPlan = await planner.replan(plan.id, "Requirements changed");
    expect(newPlan.id).not.toBe(plan.id);
  });
});
