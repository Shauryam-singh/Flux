import { describe, it, expect, beforeEach } from "vitest";
import { DefaultTimeline } from "../impl/default-timeline.js";
import type { TimelineEvent } from "../types/event.js";

describe("DefaultTimeline", () => {
  let timeline: DefaultTimeline;

  beforeEach(() => {
    timeline = new DefaultTimeline();
  });

  it("should record and retrieve events", () => {
    timeline.record({ type: "commit", title: "Test commit", detail: "", project: null, goalId: null, duration: null, metadata: {} });
    expect(timeline.getRange(0, Date.now() + 1000).length).toBe(1);
  });

  it("should filter by time range", () => {
    const now = Date.now();
    timeline.record({ type: "commit", title: "A", detail: "", project: null, goalId: null, duration: null, metadata: {} });
    // The second record will have a timestamp slightly after the first
    timeline.record({ type: "build_success", title: "B", detail: "", project: null, goalId: null, duration: null, metadata: {} });
    const events = timeline.getRange(0, Date.now() + 1000);
    expect(events.length).toBe(2);
  });

  it("should get recent events by count", () => {
    timeline.record({ type: "commit", title: "1", detail: "", project: null, goalId: null, duration: null, metadata: {} });
    timeline.record({ type: "commit", title: "2", detail: "", project: null, goalId: null, duration: null, metadata: {} });
    timeline.record({ type: "commit", title: "3", detail: "", project: null, goalId: null, duration: null, metadata: {} });
    expect(timeline.getRecent(2).length).toBe(2);
  });

  it("should filter by type", () => {
    timeline.record({ type: "commit", title: "C1", detail: "", project: null, goalId: null, duration: null, metadata: {} });
    timeline.record({ type: "build_success", title: "B1", detail: "", project: null, goalId: null, duration: null, metadata: {} });
    expect(timeline.getByType("commit").length).toBe(1);
  });

  it("should search events by title", () => {
    timeline.record({ type: "commit", title: "feat: auth module", detail: "", project: null, goalId: null, duration: null, metadata: {} });
    timeline.record({ type: "commit", title: "fix: login bug", detail: "", project: null, goalId: null, duration: null, metadata: {} });
    const results = timeline.search("auth");
    expect(results.length).toBe(1);
  });

  it("should get daily summary", () => {
    const today = new Date().toISOString().split("T")[0]!;
    timeline.record({ type: "commit", title: "feat: add", detail: "", project: null, goalId: null, duration: null, metadata: {} });
    const summary = timeline.getDailySummary(today);
    expect(summary).not.toBeNull();
    expect(summary!.totalEvents).toBe(1);
  });
});
