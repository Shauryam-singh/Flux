import type { AmbientNotification, NotificationClassification, NotificationState } from "@ai-agent/ambient-types";

export interface NotificationClassifier {
  classify(notification: AmbientNotification): NotificationClassification;
  shouldSuppress(notification: AmbientNotification): boolean;
  getBatchGroup(notification: AmbientNotification): string | null;
}

export interface NotificationIntel {
  process(notification: AmbientNotification): AmbientNotification;
  getState(): NotificationState;
  getRecent(count: number): ReadonlyArray<AmbientNotification>;
  getCritical(): ReadonlyArray<AmbientNotification>;
  getBatched(): ReadonlyArray<ReadonlyArray<AmbientNotification>>;
  getSuppressionCount(): number;
  isAvailable(): boolean;
}

export interface NotificationIntelConfig {
  readonly enabled: boolean;
  readonly maxHistory: number;
  readonly batchWindowMs: number;
  readonly suppressionRules: ReadonlyArray<{
    readonly app: string;
    readonly pattern: RegExp;
    readonly action: "suppress" | "batch" | "downgrade";
  }>;
}
