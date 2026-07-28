import { describe, it, expect, vi, beforeEach } from "vitest";
import { AttentionPolicy } from "../policy.js";
import { PriorityScorer } from "../scorer.js";
import { ObservationBuffer } from "../buffer.js";
import { ObservationSummarizer } from "../summarizer.js";
import { AttentionManager } from "../manager.js";
import type { Observation } from "../types.js";

describe("AttentionPolicy", () => {
  let policy: AttentionPolicy;

  beforeEach(() => {
    policy = new AttentionPolicy();
  });

  it("should ignore mouse events", () => {
    const result = policy.evaluate({
      source: "screen",
      title: "Mouse moved",
      detail: "Cursor moved to (100, 200)",
      timestamp: Date.now(),
      mergeable: false,
    });
    expect(result.priority).toBe("ignore");
  });

  it("should ignore keyboard events", () => {
    const result = policy.evaluate({
      source: "screen",
      title: "Keystroke detected",
      detail: "User typed 'a'",
      timestamp: Date.now(),
      mergeable: false,
    });
    expect(result.priority).toBe("ignore");
  });

  it("should background window switches", () => {
    const result = policy.evaluate({
      source: "screen",
      title: "Window switched to VSCode",
      detail: "User switched to VSCode",
      timestamp: Date.now(),
      mergeable: true,
    });
    expect(result.priority).toBe("background");
  });

  it("should mark build failures as high priority", () => {
    const result = policy.evaluate({
      source: "terminal",
      title: "Build failed with 3 errors",
      detail: "npm run build failed",
      timestamp: Date.now(),
      mergeable: false,
    });
    expect(result.priority).toBe("high");
    expect(result.score).toBeGreaterThan(60);
  });

  it("should mark test failures as high priority", () => {
    const result = policy.evaluate({
      source: "terminal",
      title: "Tests failed",
      detail: "2 tests failed in auth.test.ts",
      timestamp: Date.now(),
      mergeable: false,
    });
    expect(result.priority).toBe("high");
  });

  it("should mark git conflicts as high priority", () => {
    const result = policy.evaluate({
      source: "git",
      title: "Merge conflict in main.ts",
      detail: "Cannot auto-merge",
      timestamp: Date.now(),
      mergeable: false,
    });
    expect(result.priority).toBe("high");
  });

  it("should mark process crashes as high priority", () => {
    const result = policy.evaluate({
      source: "process",
      title: "Process crashed",
      detail: "node server.js segfault",
      timestamp: Date.now(),
      mergeable: false,
    });
    expect(result.priority).toBe("high");
  });

  it("should mark disk full as critical", () => {
    const result = policy.evaluate({
      source: "system",
      title: "Disk almost full",
      detail: "95% disk usage",
      timestamp: Date.now(),
      mergeable: false,
    });
    expect(result.priority).toBe("critical");
  });

  it("should suppress rapid duplicate events", () => {
    const now = Date.now();
    policy.evaluate({
      source: "screen",
      title: "Window switched to Chrome",
      detail: "User switched to Chrome",
      timestamp: now,
      mergeable: true,
    });

    const result = policy.evaluate({
      source: "screen",
      title: "Window switched to Chrome",
      detail: "User switched to Chrome",
      timestamp: now + 1000, // Within 5s window
      mergeable: true,
    });

    expect(result.suppressed).toBe(true);
    expect(result.priority).toBe("ignore");
  });
});

describe("PriorityScorer", () => {
  let scorer: PriorityScorer;

  beforeEach(() => {
    scorer = new PriorityScorer();
  });

  it("should score user input higher than screen", () => {
    const userScore = scorer.score({
      source: "user",
      title: "User asked question",
      detail: "What is TypeScript?",
      timestamp: Date.now(),
      mergeable: false,
    });
    const screenScore = scorer.score({
      source: "screen",
      title: "Mouse moved",
      detail: "Cursor at (100, 200)",
      timestamp: Date.now(),
      mergeable: false,
    });
    expect(userScore).toBeGreaterThan(screenScore);
  });

  it("should score crashes highly", () => {
    const score = scorer.score({
      source: "process",
      title: "Process crashed with segfault",
      detail: "node server.js",
      timestamp: Date.now(),
      mergeable: false,
    });
    expect(score).toBeGreaterThan(60);
  });

  it("should score mouse events low", () => {
    const score = scorer.score({
      source: "screen",
      title: "Mouse moved",
      detail: "Cursor at (100, 200)",
      timestamp: Date.now(),
      mergeable: false,
    });
    expect(score).toBeLessThan(30);
  });

  it("should score timer events low", () => {
    const score = scorer.score({
      source: "timer",
      title: "Periodic check",
      detail: "System health check",
      timestamp: Date.now(),
      mergeable: true,
    });
    expect(score).toBeLessThan(30);
  });

  it("should track distribution", () => {
    scorer.score({ source: "user", title: "test", detail: "", timestamp: Date.now(), mergeable: false });
    scorer.score({ source: "screen", title: "mouse", detail: "", timestamp: Date.now(), mergeable: false });

    const dist = scorer.getDistribution();
    expect(dist.count).toBe(2);
    expect(dist.avg).toBeGreaterThan(0);
  });
});

describe("ObservationBuffer", () => {
  let buffer: ObservationBuffer;

  beforeEach(() => {
    buffer = new ObservationBuffer({ maxBuffer: 5, flushInterval: 100 });
  });

  const makeObs = (title: string, priority: Observation["priority"] = "medium"): Observation => ({
    id: `obs_${Math.random()}`,
    source: "screen",
    title,
    detail: "",
    priority,
    score: 50,
    timestamp: Date.now(),
    mergeable: true,
    consumed: false,
  });

  it("should add observations", () => {
    buffer.add(makeObs("test"));
    expect(buffer.size).toBe(1);
  });

  it("should drain observations", () => {
    buffer.add(makeObs("test1"));
    buffer.add(makeObs("test2"));

    const drained = buffer.drain(true);
    expect(drained.length).toBe(2);
    expect(buffer.size).toBe(0);
  });

  it("should evict when full", () => {
    for (let i = 0; i < 6; i++) {
      buffer.add(makeObs(`test${i}`, "low"));
    }
    expect(buffer.size).toBe(5);
  });

  it("should get urgent observations", () => {
    buffer.add(makeObs("urgent", "high"));
    buffer.add(makeObs("critical", "critical"));
    buffer.add(makeObs("normal", "medium"));

    expect(buffer.getUrgent().length).toBe(2);
  });

  it("should get mergeable observations", () => {
    buffer.add(makeObs("mergeable", "medium"));
    buffer.add({
      id: "test-id-2",
      source: "terminal",
      title: "not-mergeable",
      detail: "test",
      priority: "medium",
      timestamp: Date.now(),
      mergeable: false,
      score: 0,
      consumed: false,
    });

    const mergeable = buffer.getMergeable();
    expect(mergeable.length).toBe(1);
    expect(mergeable[0]!.title).toBe("mergeable");
  });

  it("should mark as consumed", () => {
    const obs = makeObs("test");
    obs.id = "test-1";
    buffer.add(obs);

    buffer.consume(["test-1"]);
    expect(buffer.getMergeable().length).toBe(0);
  });

  it("should gc consumed observations", () => {
    const obs = makeObs("test");
    obs.id = "test-1";
    buffer.add(obs);

    buffer.consume(["test-1"]);
    const removed = buffer.gc();
    expect(removed).toBe(1);
    expect(buffer.size).toBe(0);
  });
});

describe("ObservationSummarizer", () => {
  let summarizer: ObservationSummarizer;

  beforeEach(() => {
    summarizer = new ObservationSummarizer();
  });

  const makeObs = (title: string, source: Observation["source"] = "screen"): Observation => ({
    id: `obs_${Math.random()}`,
    source,
    title,
    detail: `Detail for ${title}`,
    priority: "medium",
    score: 50,
    timestamp: Date.now(),
    mergeable: true,
    consumed: false,
  });

  it("should summarize single observation", () => {
    const summary = summarizer.summarize([makeObs("test")]);
    expect(summary.totalCount).toBe(1);
    expect(summary.summary).toContain("test");
  });

  it("should summarize multiple observations", () => {
    const obs = [
      makeObs("File saved: main.ts"),
      makeObs("File saved: index.ts"),
      makeObs("File saved: utils.ts"),
    ];

    const summary = summarizer.summarize(obs);
    expect(summary.totalCount).toBe(3);
  });

  it("should find mergeable groups", () => {
    const obs = [
      makeObs("File saved: main.ts"),
      makeObs("File saved: index.ts"),
      makeObs("Window switched", "screen"),
    ];

    const groups = summarizer.findGroups(obs);
    expect(groups.length).toBeGreaterThanOrEqual(1);
  });
});

describe("AttentionManager", () => {
  let manager: AttentionManager;
  let observations: Observation[];

  beforeEach(() => {
    observations = [];
    manager = new AttentionManager({
      minBrainScore: 40,
      onObservation: (obs) => observations.push(obs),
    });
  });

  it("should ignore mouse events", () => {
    const result = manager.process({
      source: "screen",
      title: "Mouse moved",
      detail: "Cursor at (100, 200)",
    });
    expect(result.action).toBe("ignore");
  });

  it("should buffer background events", () => {
    const result = manager.process({
      source: "screen",
      title: "Window switched to VSCode",
      detail: "User switched",
    });
    expect(result.action).toBe("buffer");
  });

  it("should send urgent events immediately", () => {
    const result = manager.process({
      source: "terminal",
      title: "Build failed",
      detail: "npm run build failed",
    });
    expect(result.action).toBe("immediate");
    expect(observations.length).toBe(1);
  });

  it("should send critical events immediately", () => {
    const result = manager.process({
      source: "system",
      title: "Disk almost full",
      detail: "95% usage",
    });
    expect(result.action).toBe("immediate");
  });

  it("should provide stats", () => {
    manager.process({ source: "screen", title: "Mouse moved", detail: "" });
    manager.process({ source: "terminal", title: "Build failed", detail: "" });

    const stats = manager.getStats();
    expect(stats.totalEvents).toBe(2);
    expect(stats.ignored).toBe(1);
  });

  it("should handle user input", () => {
    const result = manager.process({
      source: "user",
      title: "User asked question",
      detail: "What is TypeScript?",
    });
    // User input should pass through
    expect(result.action).not.toBe("ignore");
  });

  it("should suppress rapid duplicates", () => {
    const now = Date.now();
    manager.process({
      source: "screen",
      title: "Window switched to VSCode",
      detail: "User switched",
    });

    const result = manager.process({
      source: "screen",
      title: "Window switched to VSCode",
      detail: "User switched",
    });

    expect(result.action).toBe("ignore");
  });

  it("should check urgent observations", () => {
    manager.process({
      source: "terminal",
      title: "Build failed",
      detail: "",
    });

    const urgent = manager.checkUrgent();
    expect(urgent.length).toBe(1);
  });
});
