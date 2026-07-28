import { describe, it, expect, beforeEach } from "vitest";
import { DefaultVisionSensor, RuleBasedAnalyzer } from "../impl/default-vision-sensor.js";

describe("DefaultVisionSensor", () => {
  let sensor: DefaultVisionSensor;

  beforeEach(() => {
    sensor = new DefaultVisionSensor();
  });

  it("should capture and return analysis", async () => {
    const analysis = await sensor.capture();
    expect(analysis).not.toBeNull();
    expect(analysis!.id).toMatch(/^va_/);
    expect(analysis!.semanticSummary).toBeTruthy();
  });

  it("should track history", async () => {
    await sensor.capture();
    await sensor.capture();
    expect(sensor.getHistory().length).toBe(2);
  });

  it("should get last analysis", async () => {
    expect(sensor.getLastAnalysis()).toBeNull();
    await sensor.capture();
    expect(sensor.getLastAnalysis()).not.toBeNull();
  });

  it("should report availability", () => {
    expect(sensor.isAvailable()).toBe(true);
  });

  it("should change analysis mode", () => {
    sensor.setAnalysisMode("multimodal");
    expect(sensor.isAvailable()).toBe(true);
  });
});

describe("RuleBasedAnalyzer", () => {
  const analyzer = new RuleBasedAnalyzer();

  it("should detect errors in text", () => {
    const result = analyzer.analyze("Error: Cannot find module\nBuild failed", "terminal");
    expect(result.hasErrors).toBe(true);
    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.semanticSummary).toContain("error");
  });

  it("should detect normal state", () => {
    const result = analyzer.analyze("All tests passed", "jest");
    expect(result.hasErrors).toBe(false);
    expect(result.uiState).toBe("normal");
  });

  it("should detect code language", () => {
    const result = analyzer.analyze("function hello() {\n  const x = 1;\n}", "vscode");
    expect(result.codeLanguage).toBe("typescript");
  });

  it("should handle multiple error lines", () => {
    const result = analyzer.analyze("Error A\nError B\nError C", "terminal");
    expect(result.errorCount).toBe(3);
  });
});
