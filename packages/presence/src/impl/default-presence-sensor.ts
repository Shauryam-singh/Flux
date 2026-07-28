import type { PresenceSensor, PresenceConfig } from "../interfaces/presence-sensor.js";
import type { PresenceEstimate, PresenceState, InputActivity, AudioActivity } from "@ai-agent/ambient-types";

const DEFAULT_CONFIG: PresenceConfig = {
  enabled: true,
  idleThresholdMs: 300000,
  meetingDetectionEnabled: true,
  sleepDetectionEnabled: true,
  historySize: 50,
};

const DEFAULT_INPUT: InputActivity = {
  keyboardActive: false,
  mouseActive: false,
  lastInputTime: 0,
  typingSpeed: 0,
  clickFrequency: 0,
};

const DEFAULT_AUDIO: AudioActivity = {
  microphoneActive: false,
  speakerActive: false,
  ambientNoiseLevel: 0,
  voiceDetected: false,
};

export class DefaultPresenceSensor implements PresenceSensor {
  private config: PresenceConfig;
  private input: InputActivity = { ...DEFAULT_INPUT };
  private audio: AudioActivity = { ...DEFAULT_AUDIO };
  private history: PresenceEstimate[] = [];
  private currentState: PresenceState = "idle";
  private stateSince = Date.now();

  constructor(config?: Partial<PresenceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  estimate(): PresenceEstimate {
    const factors: string[] = [];
    let state: PresenceState = "idle";
    let confidence = 0.5;

    const now = Date.now();
    const timeSinceInput = now - this.input.lastInputTime;

    if (this.config.sleepDetectionEnabled && timeSinceInput > 3600000 && !this.audio.voiceDetected) {
      state = "sleeping";
      confidence = 0.7;
      factors.push("no input for 1+ hour");
    } else if (this.config.meetingDetectionEnabled && this.audio.microphoneActive && this.audio.voiceDetected) {
      state = "in_meeting";
      confidence = 0.8;
      factors.push("microphone active with voice");
    } else if (this.audio.speakerActive && !this.input.keyboardActive) {
      state = "watching_media";
      confidence = 0.6;
      factors.push("audio playing, no typing");
    } else if (this.input.keyboardActive && this.input.typingSpeed > 60) {
      state = "coding";
      confidence = 0.7;
      factors.push("high typing speed");
    } else if (this.input.keyboardActive || this.input.mouseActive) {
      state = "working";
      confidence = 0.6;
      factors.push("input activity detected");
    } else if (timeSinceInput > this.config.idleThresholdMs) {
      state = "away";
      confidence = 0.8;
      factors.push("no input for extended period");
    } else {
      state = "idle";
      confidence = 0.5;
      factors.push("low activity");
    }

    if (state !== this.currentState) {
      this.currentState = state;
      this.stateSince = now;
    }

    const estimate: PresenceEstimate = {
      state,
      confidence,
      since: this.stateSince,
      factors,
      inputActivity: { ...this.input },
      audioActivity: { ...this.audio },
    };

    this.history.push(estimate);
    if (this.history.length > this.config.historySize) {
      this.history = this.history.slice(-this.config.historySize);
    }

    return estimate;
  }

  getState(): PresenceState {
    return this.currentState;
  }

  isAvailable(): boolean {
    return this.config.enabled;
  }

  updateInputActivity(activity: InputActivity): void {
    this.input = activity;
  }

  updateAudioActivity(activity: AudioActivity): void {
    this.audio = activity;
  }

  getHistory(): ReadonlyArray<PresenceEstimate> {
    return this.history;
  }
}
