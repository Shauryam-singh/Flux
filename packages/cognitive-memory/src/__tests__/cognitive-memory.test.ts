import { describe, it, expect } from "vitest";
import { DefaultMemoryManager } from "../impl/default-memory-manager.js";

describe("MemoryManager", () => {
  it("should store and retrieve semantic memories", () => {
    const mgr = new DefaultMemoryManager();
    const mem = mgr.storeSemantic({
      type: "semantic",
      category: "preference",
      subject: "User",
      predicate: "prefers",
      object: "TypeScript",
      domain: "programming",
      content: "User prefers TypeScript",
      strength: 0.8,
      confidence: 0.9,
      source: "observation",
      tags: ["typescript", "preference"],
      relatedIds: [],
      contradictions: [],
    });

    expect(mem.id).toBeTruthy();
    expect(mem.type).toBe("semantic");
    expect(mem.subject).toBe("User");
    expect(mem.predicate).toBe("prefers");
    expect(mem.object).toBe("TypeScript");

    const retrieved = mgr.get(mem.id);
    expect(retrieved).toBeTruthy();
    expect(retrieved!.accessCount).toBe(1);
  });

  it("should store and retrieve episodic memories", () => {
    const mgr = new DefaultMemoryManager();
    const mem = mgr.storeEpisodic({
      type: "episodic",
      category: "achievement",
      event: "Fixed the router",
      context: "User reported intermittent connection drops",
      participants: ["user", "assistant"],
      location: null,
      duration: 1800000,
      outcome: "Router firmware was outdated",
      emotionalValence: 0.7,
      content: "Yesterday we fixed the router",
      strength: 0.7,
      confidence: 0.9,
      source: "interaction",
      tags: ["router", "fix"],
      relatedIds: [],
      relatedEpisodeIds: [],
    });

    expect(mem.type).toBe("episodic");
    expect(mem.event).toBe("Fixed the router");
    expect(mem.outcome).toBe("Router firmware was outdated");
  });

  it("should store and retrieve procedural memories", () => {
    const mgr = new DefaultMemoryManager();
    const mem = mgr.storeProcedural({
      type: "procedural",
      category: "workflow",
      name: "Deploy to production",
      steps: [
        { order: 1, action: "Build", command: "pnpm run build", expectedResult: "Build passes", errorHandling: "Fix errors" },
        { order: 2, action: "Test", command: "pnpm test", expectedResult: "Tests pass", errorHandling: "Fix failing tests" },
        { order: 3, action: "Deploy", command: "docker compose up -d", expectedResult: "Containers running", errorHandling: "Check logs" },
      ],
      prerequisites: ["git clean working tree"],
      successRate: 0.95,
      lastUsed: Date.now(),
      useCount: 10,
      variations: ["Can skip tests with --skip-test flag"],
      content: "Deploying requires pnpm build, docker compose up",
      strength: 0.8,
      confidence: 0.95,
      source: "experience",
      tags: ["deploy", "docker"],
      relatedIds: [],
    });

    expect(mem.type).toBe("procedural");
    expect(mem.name).toBe("Deploy to production");
    expect(mem.steps).toHaveLength(3);
    expect(mem.steps[0]!.command).toBe("pnpm run build");
  });

  it("should store and retrieve relationship memories", () => {
    const mgr = new DefaultMemoryManager();
    const mem = mgr.storeRelationship({
      type: "relationship",
      category: "communication",
      attribute: "sarcasm_level",
      value: "medium",
      intensity: 0.6,
      evidence: ["User made sarcastic comment about build errors"],
      lastConfirmed: Date.now(),
      content: "User likes sarcasm at medium level",
      strength: 0.7,
      confidence: 0.8,
      source: "observation",
      tags: ["sarcasm", "communication"],
      relatedIds: [],
      contradictions: [],
    });

    expect(mem.type).toBe("relationship");
    expect(mem.attribute).toBe("sarcasm_level");
    expect(mem.value).toBe("medium");
  });

  it("should store and retrieve project memories", () => {
    const mgr = new DefaultMemoryManager();
    const mem = mgr.storeProject({
      type: "project",
      category: "architecture",
      projectName: "Flux",
      component: "cognition pipeline",
      description: "14-stage thinking engine that generates thoughts with evidence",
      filePath: null,
      version: "1.0.0",
      verified: true,
      content: "Flux uses a 14-stage cognition pipeline",
      strength: 0.9,
      confidence: 0.95,
      source: "development",
      tags: ["flux", "architecture"],
      relatedIds: [],
    });

    expect(mem.type).toBe("project");
    expect(mem.projectName).toBe("Flux");
    expect(mem.component).toBe("cognition pipeline");
  });

  it("should store and retrieve timeline memories", () => {
    const mgr = new DefaultMemoryManager();
    const mem = mgr.storeTimeline({
      type: "timeline",
      category: "milestone",
      event: "Completed Executive Intelligence",
      significance: 0.9,
      impact: "Enabled autonomous agent execution",
      nextEvent: "Implement Self-Evolution",
      content: "Completed Executive Intelligence at 11pm",
      strength: 0.8,
      confidence: 1.0,
      source: "development",
      tags: ["milestone", "executive"],
      relatedIds: [],
    });

    expect(mem.type).toBe("timeline");
    expect(mem.event).toBe("Completed Executive Intelligence");
    expect(mem.significance).toBe(0.9);
  });

  it("should store and retrieve reflection memories", () => {
    const mgr = new DefaultMemoryManager();
    const mem = mgr.storeReflection({
      type: "reflection",
      category: "insight",
      insight: "I should be more proactive about errors",
      trigger: "User asked why I didn't suggest fixing the build earlier",
      confidence: 0.9,
      applicability: 0.8,
      actionItem: "Always suggest fixing errors when detected",
      verifiedByExperience: false,
      revisionCount: 1,
      content: "I should be more proactive about errors",
      strength: 0.8,
      source: "reflection",
      tags: ["proactive", "errors"],
      relatedIds: [],
    });

    expect(mem.type).toBe("reflection");
    expect(mem.insight).toBe("I should be more proactive about errors");
    expect(mem.actionItem).toBe("Always suggest fixing errors when detected");
  });

  it("should query memories by type", () => {
    const mgr = new DefaultMemoryManager();
    mgr.storeSemantic({
      type: "semantic",
      category: "fact",
      subject: "Project",
      predicate: "uses",
      object: "pnpm",
      domain: "tooling",
      content: "Project uses pnpm",
      strength: 0.9,
      confidence: 1.0,
      source: "observation",
      tags: ["pnpm"],
      relatedIds: [],
      contradictions: [],
    });
    mgr.storeEpisodic({
      type: "episodic",
      category: "event",
      event: "Build passed",
      context: "After fixing TypeScript errors",
      participants: [],
      location: null,
      duration: null,
      outcome: null,
      emotionalValence: 0.5,
      content: "Build passed after fix",
      strength: 0.7,
      confidence: 0.9,
      source: "system",
      tags: ["build"],
      relatedIds: [],
      relatedEpisodeIds: [],
    });

    const semantics = mgr.query({ types: ["semantic"] });
    expect(semantics.memories).toHaveLength(1);
    expect(semantics.memories[0]!.type).toBe("semantic");
  });

  it("should query by text search", () => {
    const mgr = new DefaultMemoryManager();
    mgr.storeSemantic({
      type: "semantic",
      category: "preference",
      subject: "User",
      predicate: "prefers",
      object: "dark mode",
      domain: "ui",
      content: "User prefers dark mode",
      strength: 0.8,
      confidence: 0.9,
      source: "observation",
      tags: ["dark-mode"],
      relatedIds: [],
      contradictions: [],
    });

    const results = mgr.query({ text: "dark mode" });
    expect(results.memories).toHaveLength(1);
  });

  it("should strengthen and decay memories", () => {
    const mgr = new DefaultMemoryManager();
    const mem = mgr.storeSemantic({
      type: "semantic",
      category: "fact",
      subject: "Test",
      predicate: "is",
      object: "working",
      domain: "test",
      content: "Test is working",
      strength: 0.5,
      confidence: 0.9,
      source: "test",
      tags: [],
      relatedIds: [],
      contradictions: [],
    });

    mgr.strengthen(mem.id, 0.3);
    const strengthened = mgr.get(mem.id);
    expect(strengthened!.strength).toBe(0.8);

    mgr.decay(mem.id, 0.2);
    const decayed = mgr.get(mem.id);
    expect(decayed!.strength).toBeCloseTo(0.6);
  });

  it("should link memories", () => {
    const mgr = new DefaultMemoryManager();
    const m1 = mgr.storeSemantic({
      type: "semantic",
      category: "fact",
      subject: "A",
      predicate: "relates to",
      object: "B",
      domain: "test",
      content: "A relates to B",
      strength: 0.8,
      confidence: 0.9,
      source: "test",
      tags: [],
      relatedIds: [],
      contradictions: [],
    });
    const m2 = mgr.storeSemantic({
      type: "semantic",
      category: "fact",
      subject: "B",
      predicate: "relates to",
      object: "C",
      domain: "test",
      content: "B relates to C",
      strength: 0.8,
      confidence: 0.9,
      source: "test",
      tags: [],
      relatedIds: [],
      contradictions: [],
    });

    mgr.link(m1.id, m2.id);
    const updated1 = mgr.get(m1.id);
    expect(updated1!.relatedIds).toContain(m2.id);
  });

  it("should consolidate memories", () => {
    const mgr = new DefaultMemoryManager();
    mgr.storeSemantic({
      type: "semantic",
      category: "fact",
      subject: "User",
      predicate: "likes",
      object: "TypeScript",
      domain: "programming",
      content: "User likes TypeScript",
      strength: 0.8,
      confidence: 0.9,
      source: "observation",
      tags: [],
      relatedIds: [],
      contradictions: [],
    });

    const result = mgr.consolidate();
    expect(result.timestamp).toBeGreaterThanOrEqual(0);
    expect(mgr.getStats().consolidationEvents).toBe(1);
  });

  it("should get stats", () => {
    const mgr = new DefaultMemoryManager();
    mgr.storeSemantic({
      type: "semantic",
      category: "fact",
      subject: "Test",
      predicate: "is",
      object: "working",
      domain: "test",
      content: "Test is working",
      strength: 0.8,
      confidence: 0.9,
      source: "test",
      tags: [],
      relatedIds: [],
      contradictions: [],
    });

    const stats = mgr.getStats();
    expect(stats.totalMemories).toBe(1);
    expect(stats.byType.semantic).toBe(1);
    expect(stats.averageStrength).toBeGreaterThan(0);
  });
});
