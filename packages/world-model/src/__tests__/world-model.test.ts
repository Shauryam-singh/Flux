import { describe, it, expect, vi } from "vitest";
import { DefaultWorldModel } from "../impl/default-world-model.js";
import type { Observation } from "@ai-agent/attention";

function makeObs(source: Observation["source"], context?: Record<string, string>): Observation {
  const obs: Observation = {
    id: `obs_${Date.now()}`,
    source,
    title: "test",
    detail: "test",
    priority: "medium",
    score: 50,
    timestamp: Date.now(),
    mergeable: false,
    consumed: false,
  };
  if (context) {
    return { ...obs, context };
  }
  return obs;
}

describe("DefaultWorldModel", () => {
  it("should create with default state", () => {
    const model = new DefaultWorldModel();
    const state = model.getState();
    expect(state.version).toBe(0);
    expect(state.project).toBeNull();
    expect(state.application.activeApp).toBe("");
    expect(state.system.cpuUsage).toBe(0);
  });

  it("should update application state from screen observation", () => {
    const model = new DefaultWorldModel();
    const delta = model.update(makeObs("screen", { app: "VSCode", window: "editor.ts" }));
    expect(delta.application).toBeDefined();
    expect(model.getApplication().activeApp).toBe("VSCode");
    expect(model.getApplication().activeWindow).toBe("editor.ts");
    expect(model.getState().version).toBe(1);
  });

  it("should update project state from code observation", () => {
    const model = new DefaultWorldModel();
    model.update(makeObs("code", { file: "src/index.ts" }));
    const project = model.getProject();
    expect(project).not.toBeNull();
    expect(project!.focusedFile).toBe("src/index.ts");
    expect(project!.openFiles).toContain("src/index.ts");
  });

  it("should update project state from git observation", () => {
    const model = new DefaultWorldModel();
    model.update(makeObs("git", { branch: "feature/test", dirty: "true" }));
    const project = model.getProject();
    expect(project!.activeBranch).toBe("feature/test");
    expect(project!.isDirty).toBe(true);
  });

  it("should track recent commits", () => {
    const model = new DefaultWorldModel();
    model.update(makeObs("git", { commit: "abc123", message: "feat: test" }));
    const project = model.getProject();
    expect(project!.recentCommits).toHaveLength(1);
    expect(project!.recentCommits[0]!.hash).toBe("abc123");
  });

  it("should update system state", () => {
    const model = new DefaultWorldModel();
    model.update(makeObs("system", { cpu: "75.5", memory: "60.2" }));
    const sys = model.getSystem();
    expect(sys.cpuUsage).toBe(75.5);
    expect(sys.memoryUsage).toBe(60.2);
  });

  it("should track open errors", () => {
    const model = new DefaultWorldModel();
    model.update(makeObs("system", { error: "Build failed" }));
    model.update(makeObs("system", { error: "Type mismatch" }));
    expect(model.getSystem().openErrors).toHaveLength(2);
  });

  it("should track running processes", () => {
    const model = new DefaultWorldModel();
    model.update(makeObs("process", { name: "node" }));
    model.update(makeObs("process", { name: "pnpm" }));
    expect(model.getSystem().runningProcesses).toContain("node");
    expect(model.getSystem().runningProcesses).toContain("pnpm");
  });

  it("should emit onChange", () => {
    const model = new DefaultWorldModel();
    const handler = vi.fn();
    model.onChange(handler);
    model.update(makeObs("screen", { app: "VSCode" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should not emit onChange for no-op observations", () => {
    const model = new DefaultWorldModel();
    const handler = vi.fn();
    model.onChange(handler);
    model.update(makeObs("user"));
    expect(handler).not.toHaveBeenCalled();
  });

  it("should reset state", () => {
    const model = new DefaultWorldModel();
    model.update(makeObs("screen", { app: "VSCode" }));
    model.reset();
    expect(model.getState().version).toBe(0);
    expect(model.getApplication().activeApp).toBe("");
  });

  it("should unsubscribe from onChange", () => {
    const model = new DefaultWorldModel();
    const handler = vi.fn();
    const unsub = model.onChange(handler);
    model.update(makeObs("screen", { app: "VSCode" }));
    expect(handler).toHaveBeenCalledTimes(1);
    unsub();
    model.update(makeObs("screen", { app: "Chrome" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should handle terminal observations", () => {
    const model = new DefaultWorldModel();
    model.update(makeObs("terminal", { command: "pnpm test" }));
    expect(model.getApplication().terminalCommand).toBe("pnpm test");
  });

  it("should handle file observations", () => {
    const model = new DefaultWorldModel();
    model.update(makeObs("file", { path: "README.md" }));
    const project = model.getProject();
    expect(project!.focusedFile).toBe("README.md");
    expect(project!.openFiles).toContain("README.md");
  });
});
