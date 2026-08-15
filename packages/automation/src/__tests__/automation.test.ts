import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AutomationEngine, LearningStore, ActivityClassifier, BehaviorLearner, ContextProfileManager, ProactiveEngine, WorkSessionDetector, SmartWake } from "../index.js";

const testDir = join(tmpdir(), `flux-auto-test-${Date.now()}`);

describe("LearningStore", () => {
  let store: LearningStore;

  beforeEach(() => {
    if (!existsSync(testDir)) mkdirSync(testDir, { recursive: true });
    store = new LearningStore(testDir);
  });

  afterEach(() => {
    store.destroy();
    try { unlinkSync(join(testDir, "learning.json")); } catch { /* ok */ }
  });

  it("records and retrieves actions", () => {
    store.recordAction({ type: "app_open", detail: "code.exe", context: "coding" });
    store.recordAction({ type: "command", detail: "git status", context: "coding" });
    const actions = store.getActions();
    expect(actions).toHaveLength(2);
    expect(actions[0]!.type).toBe("app_open");
    expect(actions[1]!.detail).toBe("git status");
  });

  it("filters actions by type", () => {
    store.recordAction({ type: "app_open", detail: "code.exe", context: "coding" });
    store.recordAction({ type: "command", detail: "ls", context: "coding" });
    const filtered = store.getActions({ type: "app_open" });
    expect(filtered).toHaveLength(1);
  });

  it("filters actions by mode", () => {
    store.recordAction({ type: "app_open", detail: "code.exe", context: "coding" });
    store.recordAction({ type: "app_open", detail: "roblox.exe", context: "gaming" });
    const filtered = store.getActions({ mode: "coding" });
    expect(filtered).toHaveLength(1);
  });

  it("records and retrieves snapshots", () => {
    store.recordSnapshot({
      activeApp: "code.exe",
      activeWindowTitle: "test.ts",
      mode: "coding",
      idleSeconds: 0,
      audioPlaying: false,
      gitDirty: true,
      dockerRunning: false,
      dayOfWeek: 3,
      hourOfDay: 14,
    });
    const snapshots = store.getSnapshots();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]!.mode).toBe("coding");
  });

  it("saves and retrieves patterns", () => {
    store.savePattern({
      type: "daily_routine",
      description: "You code at 10am",
      confidence: 0.8,
      occurrences: 5,
      lastSeen: Date.now(),
      conditions: [{ field: "hourOfDay", operator: "eq", value: 10 }],
      actions: [{ type: "app_open", detail: "code.exe", priority: 1 }],
    });
    const patterns = store.getPatterns();
    expect(patterns).toHaveLength(1);
    expect(patterns[0]!.type).toBe("daily_routine");
  });

  it("updates existing patterns", () => {
    store.savePattern({ type: "daily_routine", description: "test", confidence: 0.5, occurrences: 1, lastSeen: Date.now(), conditions: [], actions: [] });
    store.savePattern({ type: "daily_routine", description: "test", confidence: 0.5, occurrences: 1, lastSeen: Date.now(), conditions: [], actions: [] });
    const patterns = store.getPatterns();
    expect(patterns).toHaveLength(1);
    expect(patterns[0]!.occurrences).toBe(2);
  });

  it("returns stats", () => {
    store.recordAction({ type: "app_open", detail: "code.exe", context: "coding" });
    store.recordSnapshot({ activeApp: "code.exe", activeWindowTitle: "", mode: "coding", idleSeconds: 0, audioPlaying: false, gitDirty: false, dockerRunning: false, dayOfWeek: 1, hourOfDay: 9 });
    const stats = store.getStats();
    expect(stats.actions).toBe(1);
    expect(stats.snapshots).toBe(1);
  });
});

describe("ActivityClassifier", () => {
  const classifier = new ActivityClassifier();

  it("classifies coding apps", () => {
    const mode = classifier.classify({ activeApp: "code.exe", activeWindowTitle: "test.ts", idleSeconds: 0, audioPlaying: false, gitDirty: false, dockerRunning: false, dayOfWeek: 1, hourOfDay: 9 });
    expect(mode).toBe("coding");
  });

  it("classifies gaming apps", () => {
    const mode = classifier.classify({ activeApp: "roblox.exe", activeWindowTitle: "", idleSeconds: 0, audioPlaying: false, gitDirty: false, dockerRunning: false, dayOfWeek: 1, hourOfDay: 9 });
    expect(mode).toBe("gaming");
  });

  it("classifies watching by title", () => {
    const mode = classifier.classify({ activeApp: "chrome.exe", activeWindowTitle: "YouTube - Video", idleSeconds: 0, audioPlaying: true, gitDirty: false, dockerRunning: false, dayOfWeek: 1, hourOfDay: 9 });
    expect(mode).toBe("watching");
  });

  it("classifies idle when idle > 5min", () => {
    const mode = classifier.classify({ activeApp: "code.exe", activeWindowTitle: "", idleSeconds: 400, audioPlaying: false, gitDirty: false, dockerRunning: false, dayOfWeek: 1, hourOfDay: 9 });
    expect(mode).toBe("idle");
  });

  it("classifies browsing for unknown browser", () => {
    const mode = classifier.classify({ activeApp: "chrome.exe", activeWindowTitle: "random page", idleSeconds: 0, audioPlaying: false, gitDirty: false, dockerRunning: false, dayOfWeek: 1, hourOfDay: 9 });
    expect(mode).toBe("browsing");
  });

  it("returns confidence scores", () => {
    const result = classifier.classifyWithConfidence({ activeApp: "code.exe", activeWindowTitle: "", idleSeconds: 0, audioPlaying: false, gitDirty: false, dockerRunning: false, dayOfWeek: 1, hourOfDay: 9 });
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});

describe("WorkSessionDetector", () => {
  it("detects session start after stable mode", () => {
    const detector = new WorkSessionDetector();
    // Need MODE_STABILITY_THRESHOLD (3) mode changes
    const r1 = detector.onActivityChange("code.exe", "coding", Date.now());
    expect(r1.sessionStarted).toBe(false);
    const r2 = detector.onActivityChange("code.exe", "coding", Date.now() + 1000);
    expect(r2.sessionStarted).toBe(false);
    const r3 = detector.onActivityChange("code.exe", "coding", Date.now() + 2000);
    expect(r3.sessionStarted).toBe(true);
  });

  it("ends session on long gap", () => {
    const detector = new WorkSessionDetector();
    detector.onActivityChange("code.exe", "coding", Date.now());
    detector.onActivityChange("code.exe", "coding", Date.now() + 1000);
    detector.onActivityChange("code.exe", "coding", Date.now() + 2000);

    const gap = 15 * 60 * 1000; // 15 minutes
    const result = detector.onActivityChange("chrome.exe", "browsing", Date.now() + gap);
    expect(result.sessionEnded).toBe(true);
  });

  it("ends session manually", () => {
    const detector = new WorkSessionDetector();
    detector.onActivityChange("code.exe", "coding", Date.now());
    detector.onActivityChange("code.exe", "coding", Date.now() + 1000);
    detector.onActivityChange("code.exe", "coding", Date.now() + 2000);
    const session = detector.endSession();
    expect(session).not.toBeNull();
    expect(session!.endedAt).toBeDefined();
  });
});

describe("ContextProfileManager", () => {
  it("has default profiles", () => {
    const mgr = new ContextProfileManager();
    const profiles = mgr.getAll();
    expect(profiles.length).toBeGreaterThanOrEqual(4);
  });

  it("matches coding app", () => {
    const mgr = new ContextProfileManager();
    const profile = mgr.match("code.exe", "test.ts");
    expect(profile).not.toBeNull();
    expect(profile!.mode).toBe("coding");
  });

  it("matches gaming app", () => {
    const mgr = new ContextProfileManager();
    const profile = mgr.match("roblox.exe", "");
    expect(profile).not.toBeNull();
    expect(profile!.mode).toBe("gaming");
  });

  it("creates custom profile", () => {
    const mgr = new ContextProfileManager();
    const created = mgr.create({ name: "Custom", mode: "unknown", apps: ["custom.exe"], dndEnabled: false, autoActions: [] });
    expect(created.id).toBeTruthy();
    expect(mgr.getAll().length).toBeGreaterThanOrEqual(5);
  });
});

describe("ProactiveEngine", () => {
  it("creates suggestions from profile match", () => {
    const engine = new ProactiveEngine();
    const profile = {
      id: "test", name: "Test", mode: "coding" as const, apps: [], dndEnabled: true,
      autoActions: [{ id: "dnd", type: "dnd" as const, detail: "Enable DND", enabled: true }],
      createdAt: Date.now(), updatedAt: Date.now(), matchCount: 0,
    };
    const suggestions = engine.evaluate("coding", profile, [], "");
    expect(suggestions.length).toBeGreaterThanOrEqual(1);
    expect(suggestions[0]!.title).toContain("Test");
  });

  it("rejects low-confidence patterns", () => {
    const engine = new ProactiveEngine({ minConfidence: 0.8 });
    const patterns = [{ id: "p1", type: "trigger_action" as const, description: "test", confidence: 0.3, occurrences: 1, lastSeen: Date.now(), conditions: [{ field: "lastApp", operator: "eq" as const, value: "code.exe" }], actions: [] }];
    const suggestions = engine.evaluate("coding", null, patterns, "code.exe");
    expect(suggestions).toHaveLength(0);
  });

  it("accepts and rejects suggestions", () => {
    const engine = new ProactiveEngine();
    const profile = {
      id: "test", name: "Test", mode: "coding" as const, apps: [], dndEnabled: true,
      autoActions: [{ id: "dnd", type: "dnd" as const, detail: "Enable DND", enabled: true }],
      createdAt: Date.now(), updatedAt: Date.now(), matchCount: 0,
    };
    const suggestions = engine.evaluate("coding", profile, [], "");
    const id = suggestions[0]!.id;
    expect(engine.accept(id)).toBe(true);
    expect(engine.getPending()[0]!.status).toBe("accepted");
    expect(engine.reject(id)).toBe(true);
  });
});

describe("SmartWake", () => {
  const wakeFile = join(testDir, "smart-wake.json");

  beforeEach(() => {
    try { unlinkSync(wakeFile); } catch { /* ok */ }
  });

  it("records and suggests apps", () => {
    const wake = new SmartWake(wakeFile);
    wake.recordSession(["code.exe", "slack.exe"], "coding");
    const apps = wake.getSuggestedApps();
    expect(apps).toContain("code.exe");
  });

  it("suggests mode from last session", () => {
    const wake = new SmartWake(wakeFile);
    wake.recordSession(["roblox.exe"], "gaming");
    const mode = wake.getSuggestedMode();
    expect(mode).toBe("gaming");
  });

  it("falls back to unknown for fresh state", () => {
    const wake = new SmartWake(wakeFile);
    const mode = wake.getSuggestedMode();
    expect(mode).toBe("unknown");
  });
});

describe("AutomationEngine (integration)", () => {
  let engine: AutomationEngine;

  beforeEach(() => {
    engine = new AutomationEngine({ learningStoreDir: testDir });
  });

  afterEach(() => {
    engine.destroy();
  });

  it("classifies activity on observe", () => {
    const mode = engine.observe("code.exe", "test.ts");
    expect(mode).toBe("coding");
    expect(engine.getState().currentMode).toBe("coding");
  });

  it("records commands", () => {
    engine.recordCommand("git status");
    expect(engine.getState().totalActions).toBe(1);
  });

  it("records tool use", () => {
    engine.recordToolUse("file_read", "test.ts");
    expect(engine.getState().totalActions).toBe(1);
  });

  it("tracks observations", () => {
    engine.observe("code.exe", "test.ts");
    engine.observe("chrome.exe", "YouTube");
    expect(engine.getState().totalObservations).toBe(2);
  });

  it("discovers patterns from stored data", () => {
    // Record enough data to trigger pattern discovery
    for (let i = 0; i < 15; i++) {
      engine.store.recordSnapshot({
        activeApp: "code.exe",
        activeWindowTitle: "test.ts",
        mode: "coding",
        idleSeconds: 0,
        audioPlaying: false,
        gitDirty: false,
        dockerRunning: false,
        dayOfWeek: new Date().getDay(),
        hourOfDay: new Date().getHours(),
      });
    }
    const patterns = engine.discoverPatterns();
    expect(Array.isArray(patterns)).toBe(true);
  });

  it("returns profiles", () => {
    const profiles = engine.getProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(4);
  });

  it("cleans up on destroy", () => {
    engine.destroy();
    // Should not throw
  });
});
