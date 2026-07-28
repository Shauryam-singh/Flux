import { describe, it, expect, beforeEach } from "vitest";
import { DefaultEnvTimeline } from "../impl/default-env-timeline.js";

describe("DefaultEnvTimeline", () => {
  let timeline: DefaultEnvTimeline;

  beforeEach(() => {
    timeline = new DefaultEnvTimeline();
  });

  it("should record events", () => {
    const event = timeline.record({
      type: "build_succeeded",
      title: "Build passed",
      detail: "All tests green",
      source: "ci",
      deviceId: "local",
      metadata: {},
      relatedEventId: null,
    });
    expect(event.id).toMatch(/^env_/);
    expect(event.timestamp).toBeGreaterThan(0);
  });

  it("should deduplicate within window", () => {
    timeline.record({ type: "build_succeeded", title: "Build passed", detail: "", source: "ci", deviceId: "local", metadata: {}, relatedEventId: null });
    const duplicate = timeline.record({ type: "build_succeeded", title: "Build passed", detail: "", source: "ci", deviceId: "local", metadata: {}, relatedEventId: null });
    expect(duplicate.id).toMatch(/^env_/);
    expect(timeline.getStats().totalEvents).toBe(1);
  });

  it("should get events by type", () => {
    timeline.record({ type: "build_succeeded", title: "Build 1", detail: "", source: "ci", deviceId: "local", metadata: {}, relatedEventId: null });
    timeline.record({ type: "build_failed", title: "Build 2", detail: "", source: "ci", deviceId: "local", metadata: {}, relatedEventId: null });
    expect(timeline.getByType("build_succeeded").length).toBe(1);
  });

  it("should search events", () => {
    timeline.record({ type: "package_installed", title: "Installed lodash", detail: "", source: "npm", deviceId: "local", metadata: {}, relatedEventId: null });
    const results = timeline.search("lodash");
    expect(results.length).toBe(1);
  });

  it("should provide stats", () => {
    timeline.record({ type: "build_succeeded", title: "Build", detail: "", source: "ci", deviceId: "local", metadata: {}, relatedEventId: null });
    const stats = timeline.getStats();
    expect(stats.totalEvents).toBe(1);
    expect(stats.eventsByType["build_succeeded"]).toBe(1);
  });

  it("should notify on change", () => {
    let called = false;
    timeline.onChange(() => { called = true; });
    timeline.record({ type: "build_succeeded", title: "Build", detail: "", source: "ci", deviceId: "local", metadata: {}, relatedEventId: null });
    expect(called).toBe(true);
  });
});
