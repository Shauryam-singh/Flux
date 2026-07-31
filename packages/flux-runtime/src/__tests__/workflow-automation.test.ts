import { describe, it, expect } from "vitest";
import { WorkflowAutomationEngine } from "../impl/workflow-automation.js";

describe("WorkflowAutomationEngine", () => {
  it("should detect repetitive commands", () => {
    const engine = new WorkflowAutomationEngine();
    // Run same command 3 times
    engine.recordCommand("pnpm run test", 0);
    engine.recordCommand("pnpm run test", 0);
    engine.recordCommand("pnpm run test", 0);

    const actions = engine.analyze();
    const repetitive = actions.find((a) => a.type === "workflow" && a.title.includes("Repeated"));
    expect(repetitive).toBeDefined();
    expect(repetitive!.confidence).toBeGreaterThan(0.5);
  });

  it("should suggest auto-fix for missing module errors", () => {
    const engine = new WorkflowAutomationEngine();
    engine.recordError("Cannot find module 'lodash'", "import");

    const actions = engine.analyze();
    const fix = actions.find((a) => a.type === "auto_fix" && a.title.includes("Missing module"));
    expect(fix).toBeDefined();
    expect(fix!.command).toContain("pnpm add lodash");
  });

  it("should suggest auto-fix for TypeScript errors", () => {
    const engine = new WorkflowAutomationEngine();
    engine.recordError("TS2339: Property 'foo' does not exist on type 'Bar'", "typescript");

    const actions = engine.analyze();
    const fix = actions.find((a) => a.type === "auto_fix" && a.title.includes("TypeScript"));
    expect(fix).toBeDefined();
  });

  it("should suggest tests when editing without testing", () => {
    const engine = new WorkflowAutomationEngine();
    // Multiple edits, no test runs
    engine.recordCommand("nvim src/foo.ts", 0);
    engine.recordCommand("nvim src/bar.ts", 0);
    engine.recordCommand("nvim src/baz.ts", 0);

    const actions = engine.analyze();
    const testSuggestion = actions.find((a) => a.type === "test_gen");
    expect(testSuggestion).toBeDefined();
    expect(testSuggestion!.command).toBe("pnpm run test");
  });

  it("should suggest push after commit", () => {
    const engine = new WorkflowAutomationEngine();
    engine.recordCommand("git commit -m 'feat: add feature'", 0);

    const actions = engine.analyze();
    const pushSuggestion = actions.find((a) => a.title.includes("Committed but not pushed"));
    expect(pushSuggestion).toBeDefined();
    expect(pushSuggestion!.command).toBe("git push");
  });

  it("should suggest audit after npm install", () => {
    const engine = new WorkflowAutomationEngine();
    engine.recordCommand("pnpm add express", 0);

    const actions = engine.analyze();
    const audit = actions.find((a) => a.type === "dependency");
    expect(audit).toBeDefined();
    expect(audit!.command).toBe("pnpm audit");
  });

  it("should handle empty history gracefully", () => {
    const engine = new WorkflowAutomationEngine();
    const actions = engine.analyze();
    expect(actions).toEqual([]);
  });

  it("should record and return command history", () => {
    const engine = new WorkflowAutomationEngine();
    engine.recordCommand("ls", 0);
    engine.recordCommand("pwd", 0);

    const history = engine.getCommandHistory();
    expect(history.length).toBe(2);
    expect(history[0]!.command).toBe("ls");
    expect(history[1]!.command).toBe("pwd");
  });

  it("should return patterns", () => {
    const engine = new WorkflowAutomationEngine();
    engine.recordCommand("pnpm run build", 0);
    engine.recordCommand("pnpm run build", 0);
    engine.recordCommand("pnpm run build", 0);
    engine.analyze();

    const patterns = engine.getPatterns();
    expect(patterns.length).toBeGreaterThan(0);
  });

  it("should suggest auto-fix for permission errors", () => {
    const engine = new WorkflowAutomationEngine();
    engine.recordError("EACCES: permission denied, open '/etc/config'", "file");

    const actions = engine.analyze();
    const fix = actions.find((a) => a.title.includes("Permission"));
    expect(fix).toBeDefined();
  });

  it("should suggest auto-fix for ENOENT errors", () => {
    const engine = new WorkflowAutomationEngine();
    engine.recordError("ENOENT: no such file or directory, open '/tmp/foo.txt'", "file");

    const actions = engine.analyze();
    const fix = actions.find((a) => a.title.includes("File not found"));
    expect(fix).toBeDefined();
  });
});
