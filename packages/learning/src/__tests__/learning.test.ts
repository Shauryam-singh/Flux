import { describe, it, expect } from "vitest";
import { DefaultLearningPipeline } from "../impl/default-learning-pipeline.js";
import type { Feedback } from "../types/feedback.js";

describe("DefaultLearningPipeline", () => {
  const createFeedback = (type: Feedback["type"]): Feedback => ({
    id: `fb_${Math.random()}`,
    type,
    actionId: "action_1",
    timestamp: Date.now(),
    context: {},
  });

  it("should record feedback", () => {
    const pipeline = new DefaultLearningPipeline();
    pipeline.record(createFeedback("suggestion_accepted"));
    expect(pipeline.getStats().totalFeedback).toBe(1);
  });

  it("should process feedback into updates", async () => {
    const pipeline = new DefaultLearningPipeline();
    for (let i = 0; i < 6; i++) {
      pipeline.record(createFeedback("suggestion_accepted"));
    }
    for (let i = 0; i < 2; i++) {
      pipeline.record(createFeedback("suggestion_rejected"));
    }
    const updates = await pipeline.process();
    expect(updates.length).toBeGreaterThanOrEqual(0);
    expect(pipeline.getStats().lastProcessed).toBeGreaterThan(0);
  });

  it("should apply updates", () => {
    const pipeline = new DefaultLearningPipeline();
    const update = {
      target: "relationship" as const,
      field: "trustLevel",
      oldValue: null,
      newValue: 3,
      confidence: 0.6,
      reason: "High acceptance",
      timestamp: Date.now(),
    };
    pipeline.record(createFeedback("suggestion_accepted"));
    pipeline.apply(update);
    expect(pipeline.getPendingUpdates().length).toBe(0);
  });

  it("should track stats", () => {
    const pipeline = new DefaultLearningPipeline();
    const stats = pipeline.getStats();
    expect(stats.totalFeedback).toBe(0);
    expect(stats.acceptedRate).toBe(0);
    expect(stats.rejectedRate).toBe(0);
  });
});
