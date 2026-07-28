import { describe, it, expect, beforeEach } from "vitest";
import { DefaultVerificationLayer } from "../impl/default-verification-layer.js";

describe("DefaultVerificationLayer", () => {
  let layer: DefaultVerificationLayer;

  beforeEach(() => {
    layer = new DefaultVerificationLayer();
  });

  it("should verify unit tests", async () => {
    const result = await layer.verify("t1", "unit_test", { testsPassed: 10, testsTotal: 10 });
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it("should fail when score below minimum", async () => {
    const result = await layer.verify("t1", "unit_test", { testsPassed: 2, testsTotal: 10 });
    expect(result.passed).toBe(false);
    expect(result.score).toBe(20);
  });

  it("should verify all types", async () => {
    const results = await layer.verifyAll("t1", { testsPassed: 10, testsTotal: 10, errors: 0 });
    expect(results.length).toBeGreaterThan(0);
  });

  it("should track results by task", async () => {
    await layer.verify("t1", "unit_test", { testsPassed: 10, testsTotal: 10 });
    await layer.verify("t1", "static_analysis", { errors: 0 });
    expect(layer.getResults("t1").length).toBe(2);
  });

  it("should add custom rules", () => {
    layer.addRule({ type: "performance_test", required: false, minScore: 80, timeout: 30000 });
    expect(layer.getRules().length).toBe(6);
  });
});
