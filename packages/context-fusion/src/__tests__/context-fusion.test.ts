import { describe, it, expect, beforeEach } from "vitest";
import { DefaultContextFusionEngine } from "../impl/default-context-fusion.js";
import type { Observation } from "@ai-agent/attention";

const makeObs = (overrides: Partial<Observation> = {}): Observation => ({
  id: `obs_${Math.random()}`,
  source: "code",
  title: "Test",
  detail: "",
  priority: "medium",
  score: 50,
  timestamp: Date.now(),
  mergeable: false,
  consumed: false,
  ...overrides,
});

describe("DefaultContextFusionEngine", () => {
  let engine: DefaultContextFusionEngine;

  beforeEach(() => {
    engine = new DefaultContextFusionEngine();
  });

  it("should fuse single observation", () => {
    const obs = makeObs({ title: "Build failed" });
    const fusion = engine.fuse([obs]);
    expect(fusion.id).toMatch(/^fus_/);
    expect(fusion.sources.length).toBe(1);
  });

  it("should apply build failure rule", () => {
    const obs = makeObs({ source: "terminal", title: "Build failed" });
    const fusion = engine.fuse([obs]);
    expect(fusion.category).toBe("error");
    expect(fusion.actionable).toBe(true);
  });

  it("should apply error correlation rule", () => {
    const obs1 = makeObs({ source: "terminal", title: "Error A" });
    const obs2 = makeObs({ source: "code", title: "Error B" });
    const fusion = engine.fuse([obs1, obs2]);
    expect(fusion.sources.length).toBe(2);
  });

  it("should fuse batch", () => {
    const obs1 = makeObs({ source: "terminal", title: "Build failed" });
    const obs2 = makeObs({ source: "code", title: "Error" });
    const fusions = engine.fuseBatch([obs1, obs2]);
    expect(fusions.length).toBe(2);
  });

  it("should track stats", () => {
    engine.fuse([makeObs()]);
    engine.fuse([makeObs()]);
    const stats = engine.getStats();
    expect(stats.totalFused).toBe(2);
  });

  it("should get recent fusions", () => {
    engine.fuse([makeObs()]);
    engine.fuse([makeObs()]);
    expect(engine.getRecentFusions(1).length).toBe(1);
  });
});
