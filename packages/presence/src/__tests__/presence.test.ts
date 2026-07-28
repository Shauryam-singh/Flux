import { describe, it, expect, beforeEach } from "vitest";
import { DefaultPresenceSensor } from "../impl/default-presence-sensor.js";

describe("DefaultPresenceSensor", () => {
  let sensor: DefaultPresenceSensor;

  beforeEach(() => {
    sensor = new DefaultPresenceSensor();
  });

  it("should estimate idle by default", () => {
    sensor.updateInputActivity({
      keyboardActive: false,
      mouseActive: false,
      lastInputTime: Date.now() - 60000,
      typingSpeed: 0,
      clickFrequency: 0,
    });
    const estimate = sensor.estimate();
    expect(estimate.state).toBe("idle");
    expect(estimate.confidence).toBeGreaterThan(0);
  });

  it("should detect coding with keyboard activity", () => {
    sensor.updateInputActivity({
      keyboardActive: true,
      mouseActive: false,
      lastInputTime: Date.now(),
      typingSpeed: 80,
      clickFrequency: 0,
    });
    const estimate = sensor.estimate();
    expect(["coding", "working"]).toContain(estimate.state);
  });

  it("should detect away when no input", () => {
    sensor.updateInputActivity({
      keyboardActive: false,
      mouseActive: false,
      lastInputTime: Date.now() - 600000,
      typingSpeed: 0,
      clickFrequency: 0,
    });
    const estimate = sensor.estimate();
    expect(estimate.state).toBe("away");
  });

  it("should detect meeting with voice", () => {
    sensor.updateAudioActivity({
      microphoneActive: true,
      speakerActive: true,
      ambientNoiseLevel: 0.5,
      voiceDetected: true,
    });
    const estimate = sensor.estimate();
    expect(estimate.state).toBe("in_meeting");
  });

  it("should track history", () => {
    sensor.estimate();
    sensor.estimate();
    expect(sensor.getHistory().length).toBe(2);
  });

  it("should report availability", () => {
    expect(sensor.isAvailable()).toBe(true);
  });
});
