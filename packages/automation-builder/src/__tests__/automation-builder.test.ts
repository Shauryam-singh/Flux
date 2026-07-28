import { describe, it, expect, beforeEach } from "vitest";
import { DefaultAutomationBuilder } from "../impl/default-automation-builder.js";
import type { AutomationBuilder } from "../interfaces/automation-builder.js";

describe("DefaultAutomationBuilder", () => {
  let builder: AutomationBuilder;

  beforeEach(() => {
    builder = new DefaultAutomationBuilder();
  });

  it("should propose a new automation", () => {
    const result = builder.propose(
      "wp_1",
      "Test Automation",
      "A test automation",
      "manual",
      [{ action: "build", tool: "npm", parameters: {}, order: 0, optional: false }],
      30,
      0.8,
    );

    expect(result.id).toMatch(/^ab_/);
    expect(result.name).toBe("Test Automation");
    expect(result.status).toBe("proposed");
    expect(result.confidence).toBe(0.8);
  });

  it("should get proposal by id", () => {
    const proposal = builder.propose("wp_1", "Test", "desc", "trigger", [], 10, 0.5);
    const retrieved = builder.get(proposal.id);
    expect(retrieved).toEqual(proposal);
  });

  it("should return null for non-existent id", () => {
    expect(builder.get("non-existent")).toBeNull();
  });

  it("should get all proposals", () => {
    builder.propose("wp_1", "A", "desc", "t", [], 10, 0.5);
    builder.propose("wp_2", "B", "desc", "t", [], 20, 0.6);
    expect(builder.getAll()).toHaveLength(2);
  });

  it("should get proposed proposals", () => {
    const p1 = builder.propose("wp_1", "A", "desc", "t", [], 10, 0.5);
    const p2 = builder.propose("wp_2", "B", "desc", "t", [], 20, 0.6);
    builder.approve(p1.id);
    expect(builder.getProposed()).toHaveLength(1);
    expect(builder.getProposed()[0]!.id).toBe(p2.id);
  });

  it("should get active proposals", () => {
    const p1 = builder.propose("wp_1", "A", "desc", "t", [], 10, 0.5);
    builder.approve(p1.id);
    expect(builder.getActive()).toHaveLength(1);
  });

  it("should approve a proposal", () => {
    const proposal = builder.propose("wp_1", "Test", "desc", "t", [], 10, 0.5);
    builder.approve(proposal.id);
    expect(builder.get(proposal.id)?.status).toBe("active");
  });

  it("should reject a proposal", () => {
    const proposal = builder.propose("wp_1", "Test", "desc", "t", [], 10, 0.5);
    builder.reject(proposal.id);
    expect(builder.get(proposal.id)?.status).toBe("rejected");
  });

  it("should disable a proposal", () => {
    const proposal = builder.propose("wp_1", "Test", "desc", "t", [], 10, 0.5);
    builder.disable(proposal.id);
    expect(builder.get(proposal.id)?.status).toBe("disabled");
  });

  it("should delete a proposal", () => {
    const proposal = builder.propose("wp_1", "Test", "desc", "t", [], 10, 0.5);
    builder.delete(proposal.id);
    expect(builder.get(proposal.id)).toBeNull();
    expect(builder.getAll()).toHaveLength(0);
  });

  it("should not error when operating on non-existent proposal", () => {
    expect(() => builder.approve("non-existent")).not.toThrow();
    expect(() => builder.reject("non-existent")).not.toThrow();
    expect(() => builder.disable("non-existent")).not.toThrow();
    expect(() => builder.delete("non-existent")).not.toThrow();
  });
});
