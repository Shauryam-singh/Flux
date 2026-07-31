import { describe, it, expect } from "vitest";
import { DismissalTracker } from "../impl/dismissal-tracker.js";

describe("DismissalTracker", () => {
  it("should not suppress on first dismissal", () => {
    const tracker = new DismissalTracker();
    tracker.recordDismissal("docker_die_abc", "Container died");

    expect(tracker.shouldSuppress("docker_die_abc")).toBe(false);
  });

  it("should suppress after 3 dismissals of same pattern", () => {
    const tracker = new DismissalTracker();
    tracker.recordDismissal("docker_die_abc123", "Container died");
    tracker.recordDismissal("docker_die_def456", "Container died again");
    tracker.recordDismissal("docker_die_ghi789", "Container died third time");

    expect(tracker.shouldSuppress("docker_die_xyz999")).toBe(true);
  });

  it("should not suppress different patterns", () => {
    const tracker = new DismissalTracker();
    tracker.recordDismissal("docker_die_abc123", "Docker died");
    tracker.recordDismissal("docker_die_def456", "Docker died");
    tracker.recordDismissal("docker_die_ghi789", "Docker died");

    expect(tracker.shouldSuppress("battery_low_xyz999")).toBe(false);
  });

  it("should report stats correctly", () => {
    const tracker = new DismissalTracker();
    tracker.recordDismissal("test_abc", "test");
    tracker.recordDismissal("test_def", "test");

    const stats = tracker.getStats();
    expect(stats.totalDismissals).toBe(2);
    expect(typeof stats.activeSuppressions).toBe("number");
  });

  it("should extract patterns correctly", () => {
    const tracker = new DismissalTracker();
    // Dismiss 3 times with same pattern but different random suffixes
    tracker.recordDismissal("docker_die_abc123", "msg1");
    tracker.recordDismissal("docker_die_def456", "msg2");
    tracker.recordDismissal("docker_die_ghi789", "msg3");

    // Should suppress any docker_die variant
    expect(tracker.shouldSuppress("docker_die_xyz999")).toBe(true);
  });

  it("should track dismissal count in stats", () => {
    const tracker = new DismissalTracker();
    for (let i = 0; i < 5; i++) {
      tracker.recordDismissal(`test_${i}`, `msg ${i}`);
    }

    const stats = tracker.getStats();
    expect(stats.totalDismissals).toBe(5);
  });
});
