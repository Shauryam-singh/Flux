import { describe, it, expect, beforeEach } from "vitest";
import { DefaultPredictionEngine } from "../impl/default-prediction-engine.js";
import type { PredictionContext } from "@ai-agent/ambient-types";

const createMockContext = (overrides: Partial<PredictionContext> = {}): PredictionContext => ({
  recentEvents: [],
  currentPresence: {
    state: "coding",
    confidence: 0.8,
    since: Date.now() - 10000,
    factors: [],
    inputActivity: { keyboardActive: true, mouseActive: false, lastInputTime: Date.now(), typingSpeed: 60, clickFrequency: 0 },
    audioActivity: { microphoneActive: false, speakerActive: false, ambientNoiseLevel: 0, voiceDetected: false },
  },
  calendarState: { events: [], nextEvent: null, timeUntilNextEvent: null, currentEvent: null, focusBlockActive: false, todayEventCount: 0, upcomingDeadlines: [] },
  workspaceState: { timestamp: Date.now(), openApplications: [], browserTabs: [], terminals: [], containers: [], openFiles: [], focusedFile: null, gitBranch: null, clipboardContent: null, clipboardType: null, recentDownloads: [], mountedDrives: [], notifications: [] },
  goalProgress: [],
  recentPredictions: [],
  ...overrides,
});

describe("DefaultPredictionEngine", () => {
  let engine: DefaultPredictionEngine;

  beforeEach(() => {
    engine = new DefaultPredictionEngine();
  });

  it("should return predictions for debugging session", () => {
    const ctx = createMockContext({
      recentEvents: [{ id: "e1", type: "build_failed", title: "Build failed", detail: "", timestamp: Date.now(), source: "ci", deviceId: "local", metadata: {}, relatedEventId: null }],
    });
    const predictions = engine.predict(ctx);
    expect(predictions.length).toBeGreaterThan(0);
    expect(predictions.some((p) => p.type === "debugging_session")).toBe(true);
  });

  it("should predict break after long session", () => {
    const ctx = createMockContext({
      currentPresence: {
        state: "coding",
        confidence: 0.8,
        since: Date.now() - 7200001,
        factors: [],
        inputActivity: { keyboardActive: true, mouseActive: false, lastInputTime: Date.now(), typingSpeed: 60, clickFrequency: 0 },
        audioActivity: { microphoneActive: false, speakerActive: false, ambientNoiseLevel: 0, voiceDetected: false },
      },
    });
    const predictions = engine.predict(ctx);
    expect(predictions.some((p) => p.type === "break_recommended")).toBe(true);
  });

  it("should predict meeting approaching", () => {
    const ctx = createMockContext({
      calendarState: {
        events: [],
        nextEvent: { id: "m1", title: "Standup", description: "", startTime: Date.now() + 600000, endTime: Date.now() + 1200000, type: "meeting", location: "Zoom", attendees: [], isAllDay: false, recurring: true, reminderMinutes: 15, metadata: {} },
        timeUntilNextEvent: 600000,
        currentEvent: null,
        focusBlockActive: false,
        todayEventCount: 1,
        upcomingDeadlines: [],
      },
    });
    const predictions = engine.predict(ctx);
    expect(predictions.some((p) => p.type === "meeting_approaching")).toBe(true);
  });

  it("should track stats", () => {
    engine.predict(createMockContext());
    const stats = engine.getStats();
    expect(stats.totalPredictions).toBeGreaterThanOrEqual(0);
  });
});
