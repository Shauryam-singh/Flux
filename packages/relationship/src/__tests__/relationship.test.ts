import { describe, it, expect } from "vitest";
import { DefaultRelationshipModel } from "../impl/default-relationship-model.js";

describe("DefaultRelationshipModel", () => {
  it("should start with default profile", () => {
    const model = new DefaultRelationshipModel();
    const profile = model.getProfile();
    expect(profile.trustLevel).toBe(30);
    expect(profile.autonomyLevel).toBe(20);
    expect(profile.interactionCount).toBe(0);
  });

  it("should update trust", () => {
    const model = new DefaultRelationshipModel();
    model.updateTrust(10);
    expect(model.getProfile().trustLevel).toBe(40);
    model.updateTrust(-5);
    expect(model.getProfile().trustLevel).toBe(35);
  });

  it("should clamp trust to 0-100", () => {
    const model = new DefaultRelationshipModel();
    model.updateTrust(200);
    expect(model.getProfile().trustLevel).toBe(100);
    model.updateTrust(-500);
    expect(model.getProfile().trustLevel).toBe(0);
  });

  it("should update communication preferences", () => {
    const model = new DefaultRelationshipModel();
    model.updateCommunication({ verbosity: "detailed" });
    expect(model.getProfile().communication.verbosity).toBe("detailed");
  });

  it("should record milestones", () => {
    const model = new DefaultRelationshipModel();
    model.recordMilestone("first_commit", "First commit made");
    expect(model.getProfile().milestones.length).toBe(1);
    expect(model.getProfile().milestones[0]!.description).toBe("First commit made");
  });

  it("should check autonomous actions", () => {
    const model = new DefaultRelationshipModel();
    expect(model.canAutonomously("read-file")).toBe(true);
    expect(model.canAutonomously("push")).toBe(false);
  });

  it("should load and export profile", () => {
    const model = new DefaultRelationshipModel();
    model.updateTrust(20);
    const exported = model.export();
    const model2 = new DefaultRelationshipModel();
    model2.load(exported);
    expect(model2.getProfile().trustLevel).toBe(50);
  });
});
