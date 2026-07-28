import { describe, it, expect, beforeEach } from "vitest";
import { DefaultPersonalityEngine } from "../impl/default-personality.js";

describe("DefaultPersonalityEngine", () => {
  let engine: DefaultPersonalityEngine;

  beforeEach(() => {
    engine = new DefaultPersonalityEngine();
  });

  it("should have jarvis as default active personality", () => {
    expect(engine.getActive().id).toBe("jarvis");
  });

  it("should list all preset personalities", () => {
    const all = engine.getAll();
    expect(all.length).toBeGreaterThanOrEqual(6);
    expect(all.map((p) => p.id)).toContain("jarvis");
    expect(all.map((p) => p.id)).toContain("friday");
    expect(all.map((p) => p.id)).toContain("professional");
  });

  it("should get personality by id", () => {
    const jarvis = engine.getById("jarvis");
    expect(jarvis).not.toBeNull();
    expect(jarvis!.name).toBe("JARVIS");
  });

  it("should return null for unknown id", () => {
    expect(engine.getById("unknown")).toBeNull();
  });

  it("should switch active personality", () => {
    engine.setActive("friday");
    expect(engine.getActive().id).toBe("friday");
  });

  it("should get expression guidelines", () => {
    const guidelines = engine.getExpressionGuidelines("greeting");
    expect(guidelines).toHaveProperty("tone");
    expect(guidelines).toHaveProperty("formalityLevel");
    expect(guidelines).toHaveProperty("warmthLevel");
  });

  it("should register custom personality", () => {
    engine.register({
      id: "custom",
      name: "Custom",
      description: "Test",
      traits: { humour: 0, sarcasm: 0, curiosity: 0.5, verbosity: 0.5, confidence: 0.5, warmth: 0.5, proactiveness: 0.5, formality: 0.5 },
      greeting: "Hello",
      styleNotes: "Custom",
    });
    expect(engine.getById("custom")).not.toBeNull();
    expect(engine.getAll().length).toBeGreaterThanOrEqual(7);
  });
});
