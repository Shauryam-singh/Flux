import { describe, it, expect, beforeEach } from "vitest";
import { DefaultReflectionEngine } from "../impl/default-reflection-engine.js";
import { DefaultTimeline } from "@ai-agent/timeline";
import { DefaultGoalManager } from "@ai-agent/goals";

describe("DefaultReflectionEngine", () => {
  let engine: DefaultReflectionEngine;
  let timeline: DefaultTimeline;
  let goals: DefaultGoalManager;

  beforeEach(() => {
    timeline = new DefaultTimeline();
    goals = new DefaultGoalManager();
    engine = new DefaultReflectionEngine(timeline, goals);
  });

  it("should generate a daily reflection", async () => {
    const now = Date.now();
    const reflection = await engine.generate({
      type: "daily",
      dateRange: { start: now - 86400000, end: now },
    });
    expect(reflection.id).toMatch(/^ref_/);
    expect(reflection.summary).toBeTruthy();
    expect(reflection.mood).toBeTruthy();
    expect(reflection.date).toBeTruthy();
  });

  it("should retrieve reflection by id", async () => {
    const now = Date.now();
    const reflection = await engine.generate({
      type: "daily",
      dateRange: { start: now - 86400000, end: now },
    });
    expect(engine.getById(reflection.id)).not.toBeNull();
    expect(engine.getById("ref_nonexistent")).toBeNull();
  });

  it("should get latest reflection", async () => {
    expect(engine.getLatest()).toBeNull();
    const now = Date.now();
    await engine.generate({ type: "daily", dateRange: { start: now - 86400000, end: now } });
    expect(engine.getLatest()).not.toBeNull();
  });

  it("should filter reflections by date range", async () => {
    const now = Date.now();
    const reflection = await engine.generate({ type: "daily", dateRange: { start: now - 86400000, end: now } });
    const results = engine.getRange(reflection.date, reflection.date);
    expect(results.length).toBe(1);
  });
});
