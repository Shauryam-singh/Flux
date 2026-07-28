import type { EnvTimelineEvent, EnvTimelineEventType } from "@ai-agent/ambient-types";

export interface EnvTimeline {
  record(event: Omit<EnvTimelineEvent, "id" | "timestamp">): EnvTimelineEvent;
  getRange(start: number, end: number): ReadonlyArray<EnvTimelineEvent>;
  getRecent(count: number): ReadonlyArray<EnvTimelineEvent>;
  getByType(type: EnvTimelineEventType): ReadonlyArray<EnvTimelineEvent>;
  getByDevice(deviceId: string): ReadonlyArray<EnvTimelineEvent>;
  search(query: string): ReadonlyArray<EnvTimelineEvent>;
  getStats(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsByDevice: Record<string, number>;
    timeRange: { start: number; end: number } | null;
  };
  onChange(handler: (event: EnvTimelineEvent) => void): () => void;
}

export interface EnvTimelineConfig {
  readonly enabled: boolean;
  readonly maxEvents: number;
  readonly deduplicationWindowMs: number;
}
