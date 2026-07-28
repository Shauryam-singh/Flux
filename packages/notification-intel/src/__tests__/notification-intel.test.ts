import { describe, it, expect, beforeEach } from "vitest";
import { DefaultNotificationClassifier, DefaultNotificationIntel } from "../impl/default-notification-intel.js";
import type { AmbientNotification } from "@ai-agent/ambient-types";

const makeNotification = (overrides: Partial<AmbientNotification> = {}): AmbientNotification => ({
  id: `n_${Math.random()}`,
  app: "slack",
  title: "New message",
  body: "Hey, are you there?",
  timestamp: Date.now(),
  classification: "informational",
  confidence: 0.5,
  actionable: false,
  actionLabel: null,
  groupingKey: null,
  relatedGoalId: null,
  ...overrides,
});

describe("DefaultNotificationClassifier", () => {
  const classifier = new DefaultNotificationClassifier();

  it("should classify system notifications as critical", () => {
    const n = makeNotification({ app: "system" });
    expect(classifier.classify(n)).toBe("critical");
  });

  it("should classify calendar notifications as relevant", () => {
    const n = makeNotification({ app: "calendar" });
    expect(classifier.classify(n)).toBe("relevant");
  });

  it("should classify media notifications as ignore", () => {
    const n = makeNotification({ app: "spotify" });
    expect(classifier.classify(n)).toBe("ignore");
  });

  it("should classify unknown apps as informational", () => {
    const n = makeNotification({ app: "unknown_app" });
    expect(classifier.classify(n)).toBe("informational");
  });

  it("should suppress ignored notifications", () => {
    const n = makeNotification({ app: "spotify" });
    const classified = classifier.classify(n);
    expect(classified).toBe("ignore");
    expect(classifier.shouldSuppress({ ...n, classification: classified })).toBe(true);
  });
});

describe("DefaultNotificationIntel", () => {
  let intel: DefaultNotificationIntel;

  beforeEach(() => {
    intel = new DefaultNotificationIntel();
  });

  it("should process and classify notifications", () => {
    const n = makeNotification({ app: "system" });
    const processed = intel.process(n);
    expect(processed.classification).toBe("critical");
  });

  it("should track state", () => {
    intel.process(makeNotification({ app: "system" }));
    intel.process(makeNotification({ app: "spotify" }));
    const state = intel.getState();
    expect(state.recent.length).toBe(2);
    expect(state.critical.length).toBe(1);
  });

  it("should count suppressions", () => {
    intel.process(makeNotification({ app: "spotify" }));
    intel.process(makeNotification({ app: "spotify" }));
    expect(intel.getSuppressionCount()).toBe(2);
  });

  it("should get recent notifications", () => {
    for (let i = 0; i < 5; i++) {
      intel.process(makeNotification());
    }
    expect(intel.getRecent(3).length).toBe(3);
  });
});
