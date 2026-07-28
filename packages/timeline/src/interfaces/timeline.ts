import type { TimelineEvent, TimelineEventType, DailySummary } from "../types/event.js";

export interface Timeline {
  record(event: Omit<TimelineEvent, "id" | "timestamp">): TimelineEvent;
  getRange(start: number, end: number): ReadonlyArray<TimelineEvent>;
  getToday(): ReadonlyArray<TimelineEvent>;
  getRecent(count: number): ReadonlyArray<TimelineEvent>;
  getByType(type: TimelineEventType): ReadonlyArray<TimelineEvent>;
  getByProject(project: string): ReadonlyArray<TimelineEvent>;
  search(query: string): ReadonlyArray<TimelineEvent>;
  getDailySummary(date: string): DailySummary | null;
  recordSummary(summary: DailySummary): void;
  getWorkSessions(date: string): ReadonlyArray<{ start: number; end: number; duration: number }>;
  onEvent(handler: (event: TimelineEvent) => void): () => void;
}
