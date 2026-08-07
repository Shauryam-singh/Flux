import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createWakeWordService, WakeWordDetector, type WakeWordEvent } from "../impl/wake-word-service.js";

describe("WakeWordDetector", () => {
  let detector: WakeWordDetector;

  beforeEach(() => {
    detector = new WakeWordDetector({ wakeWord: "flux", chunkDurationMs: 50 });
  });

  afterEach(() => {
    detector.stop();
  });

  it("should create with default options", () => {
    expect(detector).toBeDefined();
    expect(detector.getWakeWord()).toBe("flux");
    expect(detector.isRunning()).toBe(false);
  });

  it("should create with custom wake word", () => {
    const custom = new WakeWordDetector({ wakeWord: "hey computer" });
    expect(custom.getWakeWord()).toBe("hey computer");
  });

  it("should register and unregister listeners", () => {
    const listener = vi.fn();
    const unsub = detector.onWakeWord(listener);

    expect(detector["listeners"]).toHaveLength(1);
    unsub();
    expect(detector["listeners"]).toHaveLength(0);
  });

  it("should emit wake word events", () => {
    const events: WakeWordEvent[] = [];
    detector.onWakeWord((e) => events.push(e));

    detector["emit"]({
      type: "detected",
      wakeWord: "flux",
      transcript: "hey flux what time is it",
      confidence: 0.8,
      timestamp: Date.now(),
    });

    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("detected");
    expect(events[0]!.wakeWord).toBe("flux");
  });

  it("should emit listening event", () => {
    const events: WakeWordEvent[] = [];
    detector.onWakeWord((e) => events.push(e));

    detector["emit"]({
      type: "listening",
      wakeWord: "flux",
      transcript: "",
      confidence: 0,
      timestamp: Date.now(),
    });

    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("listening");
  });

  it("should not start if already running", () => {
    detector["running"] = true;
    detector.start();
    expect(detector.isRunning()).toBe(true);
  });

  it("should not stop if already stopped", () => {
    detector.stop();
    expect(detector.isRunning()).toBe(false);
  });

  it("should calculate confidence based on wake word position", () => {
    const c1 = detector["calculateConfidence"]("flux what time is it", "flux what time is it");
    const c2 = detector["calculateConfidence"]("what time is it flux", "what time is it flux");

    expect(c1).toBeGreaterThan(0);
    expect(c2).toBeGreaterThan(0);
    expect(c1).toBeGreaterThanOrEqual(c2);
  });

  it("should return 0 confidence if wake word not found", () => {
    const confidence = detector["calculateConfidence"]("hello world", "hello world");
    expect(confidence).toBe(0);
  });
});

describe("createWakeWordService", () => {
  it("should create a service with canHandle and execute", () => {
    const service = createWakeWordService({ wakeWord: "flux" });
    expect(service.canHandle).toBeDefined();
    expect(service.execute).toBeDefined();
    expect(service.startListening).toBeDefined();
    expect(service.stopListening).toBeDefined();
    expect(service.isListening).toBeDefined();
  });

  it("should handle status command when inactive", async () => {
    const service = createWakeWordService({ wakeWord: "flux" });
    const result = await service.execute("is wake word listening on");
    expect(result.text).toContain("inactive");
  });

  it("should handle stop command", async () => {
    const service = createWakeWordService({ wakeWord: "flux" });
    const result = await service.execute("stop wake word");
    expect(result.text).toContain("stopped");
  });

  it("should canHandle start commands", () => {
    const service = createWakeWordService();
    expect(service.canHandle("start wake word listening")).toBe(true);
    expect(service.canHandle("enable wake word")).toBe(true);
    expect(service.canHandle("start always-on listening mode")).toBe(true);
  });

  it("should canHandle stop commands", () => {
    const service = createWakeWordService();
    expect(service.canHandle("stop wake word")).toBe(true);
    expect(service.canHandle("disable wake word listening")).toBe(true);
  });

  it("should canHandle status commands", () => {
    const service = createWakeWordService();
    expect(service.canHandle("is wake word on")).toBe(true);
    expect(service.canHandle("is always-on listening active")).toBe(true);
  });

  it("should not canHandle unrelated commands", () => {
    const service = createWakeWordService();
    expect(service.canHandle("what time is it")).toBe(false);
    expect(service.canHandle("open youtube")).toBe(false);
  });

  it("should return help for unknown commands", async () => {
    const service = createWakeWordService();
    const result = await service.execute("unknown command");
    expect(result.text).toContain("Usage");
  });
});
