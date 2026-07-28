import { describe, it, expect, beforeEach } from "vitest";
import type { ConfidenceCalibration } from "../interfaces/confidence-calibration.js";

describe("DefaultConfidenceCalibration", () => {
  let calibration: ConfidenceCalibration;

  beforeEach(async () => {
    const { DefaultConfidenceCalibration } = await import("../impl/default-confidence-calibration.js");
    calibration = new DefaultConfidenceCalibration();
  });

  it("records predictions and tracks count", () => {
    calibration.record("math", 0.8, true);
    calibration.record("math", 0.6, false);
    expect(calibration.count()).toBe(2);
  });

  it("calculates calibration error", () => {
    calibration.record("math", 0.9, true);
    calibration.record("math", 0.1, false);
    expect(calibration.getOverallCalibrationError()).toBeCloseTo(0.1, 5);
  });

  it("returns correct domain records", () => {
    calibration.record("math", 0.8, true);
    calibration.record("science", 0.6, false);
    expect(calibration.getDomainRecords("math")).toHaveLength(1);
    expect(calibration.getDomainRecords("science")).toHaveLength(1);
  });

  it("determines well-calibrated status", () => {
    calibration.record("math", 0.9, true);
    calibration.record("math", 0.95, true);
    expect(calibration.isWellCalibrated("math")).toBe(true);
  });

  it("returns buckets with correct structure", () => {
    calibration.record("math", 0.5, true);
    const buckets = calibration.getBuckets(5);
    expect(buckets).toHaveLength(5);
    expect(buckets[0]).toHaveProperty("lowerBound");
    expect(buckets[0]).toHaveProperty("upperBound");
    expect(buckets[0]).toHaveProperty("predictions");
  });

  it("calculates recommended adjustment", () => {
    calibration.record("math", 0.5, true);
    calibration.record("math", 0.5, true);
    const adj = calibration.getRecommendedAdjustment("math");
    expect(adj).toBeCloseTo(0.5, 5);
  });
});
