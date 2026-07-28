import { describe, it, expect } from "vitest";
import { DefaultThoughtGraph } from "../impl/default-thought-graph.js";

describe("ThoughtGraph", () => {
  it("should add and retrieve nodes", () => {
    const graph = new DefaultThoughtGraph();
    const node = graph.addNode({
      type: "observation_interpretation",
      content: "Build failed 3 times",
      reasoning: "Error count is high",
      confidence: { value: 0.9, reason: "Direct observation", timestamp: Date.now() },
      evidence: [],
      counterarguments: [],
      relatedThoughtIds: [],
      observationIds: ["obs_1"],
      goalId: null,
      expiresAt: null,
      metadata: {},
    });

    expect(node.id).toBeTruthy();
    expect(node.content).toBe("Build failed 3 times");
    expect(node.confidence.value).toBe(0.9);
    expect(graph.getNode(node.id)).toBeTruthy();
  });

  it("should query nodes by type", () => {
    const graph = new DefaultThoughtGraph();
    graph.addNode({
      type: "observation_interpretation",
      content: "Error 1",
      reasoning: "test",
      confidence: { value: 0.8, reason: "test", timestamp: Date.now() },
      evidence: [],
      counterarguments: [],
      relatedThoughtIds: [],
      observationIds: [],
      goalId: null,
      expiresAt: null,
      metadata: {},
    });
    graph.addNode({
      type: "pattern_recognition",
      content: "Pattern 1",
      reasoning: "test",
      confidence: { value: 0.7, reason: "test", timestamp: Date.now() },
      evidence: [],
      counterarguments: [],
      relatedThoughtIds: [],
      observationIds: [],
      goalId: null,
      expiresAt: null,
      metadata: {},
    });

    const observations = graph.queryNodes({ type: "observation_interpretation" });
    expect(observations).toHaveLength(1);
    expect(observations[0]!.content).toBe("Error 1");
  });

  it("should query nodes by confidence threshold", () => {
    const graph = new DefaultThoughtGraph();
    graph.addNode({
      type: "concern",
      content: "Low confidence",
      reasoning: "test",
      confidence: { value: 0.3, reason: "test", timestamp: Date.now() },
      evidence: [],
      counterarguments: [],
      relatedThoughtIds: [],
      observationIds: [],
      goalId: null,
      expiresAt: null,
      metadata: {},
    });
    graph.addNode({
      type: "concern",
      content: "High confidence",
      reasoning: "test",
      confidence: { value: 0.9, reason: "test", timestamp: Date.now() },
      evidence: [],
      counterarguments: [],
      relatedThoughtIds: [],
      observationIds: [],
      goalId: null,
      expiresAt: null,
      metadata: {},
    });

    const highConf = graph.queryNodes({ type: "concern", minConfidence: 0.5 });
    expect(highConf).toHaveLength(1);
    expect(highConf[0]!.content).toBe("High confidence");
  });

  it("should add and traverse edges", () => {
    const graph = new DefaultThoughtGraph();
    const node1 = graph.addNode({
      type: "observation_interpretation",
      content: "Error detected",
      reasoning: "test",
      confidence: { value: 0.9, reason: "test", timestamp: Date.now() },
      evidence: [],
      counterarguments: [],
      relatedThoughtIds: [],
      observationIds: [],
      goalId: null,
      expiresAt: null,
      metadata: {},
    });
    const node2 = graph.addNode({
      type: "suggestion",
      content: "Fix the error",
      reasoning: "test",
      confidence: { value: 0.8, reason: "test", timestamp: Date.now() },
      evidence: [],
      counterarguments: [],
      relatedThoughtIds: [],
      observationIds: [],
      goalId: null,
      expiresAt: null,
      metadata: {},
    });

    graph.addEdge({
      fromId: node1.id,
      toId: node2.id,
      type: "supports",
      strength: 0.9,
    });

    const supporting = graph.getSupportingThoughts(node2.id);
    expect(supporting).toHaveLength(1);
    expect(supporting[0]!.id).toBe(node1.id);
  });

  it("should generate explanations", () => {
    const graph = new DefaultThoughtGraph();
    const obs = graph.addNode({
      type: "observation_interpretation",
      content: "Build failed 3 times",
      reasoning: "High error count",
      confidence: { value: 0.9, reason: "Direct observation", timestamp: Date.now() },
      evidence: [],
      counterarguments: [],
      relatedThoughtIds: [],
      observationIds: ["obs_1"],
      goalId: null,
      expiresAt: null,
      metadata: {},
    });

    const suggestion = graph.addNode({
      type: "suggestion",
      content: "Offer to fix the build",
      reasoning: "Build is failing and user likely wants it fixed",
      confidence: { value: 0.85, reason: "Pattern of user behavior", timestamp: Date.now() },
      evidence: [{
        id: "ev_1",
        observationId: "obs_1",
        source: "screen",
        content: "Build failed 3 times in a row",
        strength: 0.9,
        timestamp: Date.now(),
      }],
      counterarguments: [],
      relatedThoughtIds: [],
      observationIds: ["obs_1"],
      goalId: null,
      expiresAt: null,
      metadata: {},
    });

    graph.addEdge({
      fromId: obs.id,
      toId: suggestion.id,
      type: "supports",
      strength: 0.9,
    });

    const explanation = graph.explain(suggestion.id);
    expect(explanation.mainThought).toBe("Offer to fix the build");
    expect(explanation.evidenceChain.length).toBeGreaterThan(0);
    expect(explanation.confidenceReasoning).toBeTruthy();
  });

  it("should prune weak nodes", () => {
    const graph = new DefaultThoughtGraph();
    graph.addNode({
      type: "concern",
      content: "Weak thought",
      reasoning: "test",
      confidence: { value: 0.2, reason: "test", timestamp: Date.now() },
      evidence: [],
      counterarguments: [],
      relatedThoughtIds: [],
      observationIds: [],
      goalId: null,
      expiresAt: null,
      metadata: {},
    });
    graph.addNode({
      type: "concern",
      content: "Strong thought",
      reasoning: "test",
      confidence: { value: 0.9, reason: "test", timestamp: Date.now() },
      evidence: [],
      counterarguments: [],
      relatedThoughtIds: [],
      observationIds: [],
      goalId: null,
      expiresAt: null,
      metadata: {},
    });

    const pruned = graph.pruneWeak(0.5);
    expect(pruned).toBe(1);
    expect(graph.snapshot().nodeCount).toBe(1);
  });

  it("should get strongest thoughts", () => {
    const graph = new DefaultThoughtGraph();
    graph.addNode({
      type: "concern",
      content: "Low",
      reasoning: "test",
      confidence: { value: 0.3, reason: "test", timestamp: Date.now() },
      evidence: [],
      counterarguments: [],
      relatedThoughtIds: [],
      observationIds: [],
      goalId: null,
      expiresAt: null,
      metadata: {},
    });
    graph.addNode({
      type: "concern",
      content: "High",
      reasoning: "test",
      confidence: { value: 0.95, reason: "test", timestamp: Date.now() },
      evidence: [],
      counterarguments: [],
      relatedThoughtIds: [],
      observationIds: [],
      goalId: null,
      expiresAt: null,
      metadata: {},
    });

    const top = graph.getStrongestThoughts(1);
    expect(top).toHaveLength(1);
    expect(top[0]!.content).toBe("High");
  });

  it("should track thought chains", () => {
    const graph = new DefaultThoughtGraph();
    const obs = graph.addNode({
      type: "observation_interpretation",
      content: "Error",
      reasoning: "test",
      confidence: { value: 0.9, reason: "test", timestamp: Date.now() },
      evidence: [],
      counterarguments: [],
      relatedThoughtIds: [],
      observationIds: [],
      goalId: null,
      expiresAt: null,
      metadata: {},
    });
    const pattern = graph.addNode({
      type: "pattern_recognition",
      content: "Same error 3 times",
      reasoning: "test",
      confidence: { value: 0.85, reason: "test", timestamp: Date.now() },
      evidence: [],
      counterarguments: [],
      relatedThoughtIds: [],
      observationIds: [],
      goalId: null,
      expiresAt: null,
      metadata: {},
    });
    const suggestion = graph.addNode({
      type: "suggestion",
      content: "Fix it",
      reasoning: "test",
      confidence: { value: 0.8, reason: "test", timestamp: Date.now() },
      evidence: [],
      counterarguments: [],
      relatedThoughtIds: [],
      observationIds: [],
      goalId: null,
      expiresAt: null,
      metadata: {},
    });

    graph.addEdge({ fromId: obs.id, toId: pattern.id, type: "supports", strength: 0.9 });
    graph.addEdge({ fromId: pattern.id, toId: suggestion.id, type: "supports", strength: 0.85 });

    const chain = graph.getThoughtChain(suggestion.id);
    expect(chain.length).toBeGreaterThanOrEqual(2);
  });
});
