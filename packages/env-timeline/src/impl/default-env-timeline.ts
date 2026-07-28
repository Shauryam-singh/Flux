import type { EnvTimeline, EnvTimelineConfig } from "../interfaces/env-timeline.js";
import type { EnvTimelineEvent, EnvTimelineEventType } from "@ai-agent/ambient-types";

const DEFAULT_CONFIG: EnvTimelineConfig = {
  enabled: true,
  maxEvents: 5000,
  deduplicationWindowMs: 5000,
};

export class DefaultEnvTimeline implements EnvTimeline {
  private events: EnvTimelineEvent[] = [];
  private handlers: Array<(event: EnvTimelineEvent) => void> = [];
  private idCounter = 0;
  private config: EnvTimelineConfig;

  constructor(config?: Partial<EnvTimelineConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  record(data: Omit<EnvTimelineEvent, "id" | "timestamp">): EnvTimelineEvent {
    const now = Date.now();
    const recentDuplicate = this.events.find(
      (e) =>
        e.type === data.type &&
        e.source === data.source &&
        e.title === data.title &&
        now - e.timestamp < this.config.deduplicationWindowMs,
    );

    if (recentDuplicate) return recentDuplicate;

    const event: EnvTimelineEvent = {
      ...data,
      id: `env_${++this.idCounter}`,
      timestamp: now,
    };

    this.events.push(event);
    if (this.events.length > this.config.maxEvents) {
      this.events = this.events.slice(-this.config.maxEvents);
    }

    for (const handler of this.handlers) {
      handler(event);
    }

    return event;
  }

  getRange(start: number, end: number): ReadonlyArray<EnvTimelineEvent> {
    return this.events.filter((e) => e.timestamp >= start && e.timestamp <= end);
  }

  getRecent(count: number): ReadonlyArray<EnvTimelineEvent> {
    return this.events.slice(-count);
  }

  getByType(type: EnvTimelineEventType): ReadonlyArray<EnvTimelineEvent> {
    return this.events.filter((e) => e.type === type);
  }

  getByDevice(deviceId: string): ReadonlyArray<EnvTimelineEvent> {
    return this.events.filter((e) => e.deviceId === deviceId);
  }

  search(query: string): ReadonlyArray<EnvTimelineEvent> {
    const lower = query.toLowerCase();
    return this.events.filter(
      (e) => e.title.toLowerCase().includes(lower) || e.detail.toLowerCase().includes(lower),
    );
  }

  getStats() {
    const eventsByType: Record<string, number> = {};
    const eventsByDevice: Record<string, number> = {};

    for (const e of this.events) {
      eventsByType[e.type] = (eventsByType[e.type] ?? 0) + 1;
      eventsByDevice[e.deviceId] = (eventsByDevice[e.deviceId] ?? 0) + 1;
    }

    return {
      totalEvents: this.events.length,
      eventsByType,
      eventsByDevice,
      timeRange: this.events.length > 0
        ? { start: this.events[0]!.timestamp, end: this.events[this.events.length - 1]!.timestamp }
        : null,
    };
  }

  onChange(handler: (event: EnvTimelineEvent) => void): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }
}
