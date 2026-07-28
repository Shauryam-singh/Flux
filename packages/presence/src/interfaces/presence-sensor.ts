import type { PresenceEstimate, PresenceState, InputActivity, AudioActivity } from "@ai-agent/ambient-types";

export interface PresenceSensor {
  estimate(): PresenceEstimate;
  getState(): PresenceState;
  isAvailable(): boolean;
  updateInputActivity(activity: InputActivity): void;
  updateAudioActivity(activity: AudioActivity): void;
  getHistory(): ReadonlyArray<PresenceEstimate>;
}

export interface PresenceConfig {
  readonly enabled: boolean;
  readonly idleThresholdMs: number;
  readonly meetingDetectionEnabled: boolean;
  readonly sleepDetectionEnabled: boolean;
  readonly historySize: number;
}
