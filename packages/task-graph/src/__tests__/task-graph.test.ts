import { describe, it, expect, beforeEach } from "vitest";
import { DefaultTaskGraphEngine } from "../impl/default-task-graph-engine.js";
import type { Task } from "@ai-agent/exec-types";

const makeTask = (id: string, deps: string[] = []): Task => ({
  id,
  objective: `Task ${id}`,
  description: "",
  status: "created",
  priority: "normal",
  progress: 0,
  assignedAgent: null,
  parentId: null,
  subtaskIds: [],
  dependencies: deps,
  constraints: { maxDurationMs: null, maxRetries: 3, timeoutMs: 300000, requiredCapabilities: [], excludedAgents: [], preferredAgents: [], modelPreference: null, costLimit: null },
  result: null,
  artifacts: [],
  error: null,
  retryCount: 0,
  createdAt: Date.now(),
  startedAt: null,
  completedAt: null,
  updatedAt: Date.now(),
  metadata: {},
});

describe("DefaultTaskGraphEngine", () => {
  let engine: DefaultTaskGraphEngine;

  beforeEach(() => {
    engine = new DefaultTaskGraphEngine();
  });

  it("should create a graph from tasks", () => {
    const tasks = [makeTask("t1"), makeTask("t2", ["t1"])];
    const graph = engine.createGraph("Test", "Test graph", tasks);
    expect(graph.id).toMatch(/^tg_/);
    expect(graph.nodes.length).toBe(2);
    expect(graph.edges.length).toBe(1);
  });

  it("should validate a valid graph", () => {
    const tasks = [makeTask("t1"), makeTask("t2")];
    const graph = engine.createGraph("Test", "Test", tasks);
    const validation = engine.validateGraph(graph.id);
    expect(validation.valid).toBe(true);
  });

  it("should detect cycles", () => {
    const graph = engine.createGraph("Test", "Test", [makeTask("t1"), makeTask("t2")]);
    const [n1, n2] = graph.nodes;
    engine.addEdge(graph.id, { from: n1!.id, to: n2!.id, condition: null, isFallback: false, metadata: {} });
    engine.addEdge(graph.id, { from: n2!.id, to: n1!.id, condition: null, isFallback: false, metadata: {} });
    const validation = engine.validateGraph(graph.id);
    expect(validation.cycleDetected).toBe(true);
  });

  it("should track all graphs", () => {
    engine.createGraph("G1", "Desc", [makeTask("t1")]);
    engine.createGraph("G2", "Desc", [makeTask("t2")]);
    expect(engine.getAll().length).toBe(2);
  });
});
