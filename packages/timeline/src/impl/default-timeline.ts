import type { Timeline } from "../interfaces/timeline.js";
import type { TimelineEvent, TimelineEventType, DailySummary } from "../types/event.js";

export class DefaultTimeline implements Timeline {
  private events: TimelineEvent[] = [];
  private summaries: Map<string, DailySummary> = new Map();
  private idCounter = 0;
  private handlers: Array<(event: TimelineEvent) => void> = [];

  record(data: Omit<TimelineEvent, "id" | "timestamp">): TimelineEvent {
    const event: TimelineEvent = {
      ...data,
      id: `te_${++this.idCounter}`,
      timestamp: Date.now(),
    };
    this.events.push(event);
    for (const handler of this.handlers) {
      handler(event);
    }
    return event;
  }

  getRange(start: number, end: number): ReadonlyArray<TimelineEvent> {
    return this.events.filter((e) => e.timestamp >= start && e.timestamp <= end);
  }

  getToday(): ReadonlyArray<TimelineEvent> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return this.events.filter((e) => e.timestamp >= startOfDay);
  }

  getRecent(count: number): ReadonlyArray<TimelineEvent> {
    return this.events.slice(-count);
  }

  getByType(type: TimelineEventType): ReadonlyArray<TimelineEvent> {
    return this.events.filter((e) => e.type === type);
  }

  getByProject(project: string): ReadonlyArray<TimelineEvent> {
    return this.events.filter((e) => e.project === project);
  }

  search(query: string): ReadonlyArray<TimelineEvent> {
    const lower = query.toLowerCase();
    return this.events.filter(
      (e) => e.title.toLowerCase().includes(lower) || e.detail.toLowerCase().includes(lower),
    );
  }

  getDailySummary(date: string): DailySummary | null {
    return this.summary(date) ?? this.summaries.get(date) ?? null;
  }

  recordSummary(summary: DailySummary): void {
    this.summaries.set(summary.date, summary);
  }

  getWorkSessions(date: string): ReadonlyArray<{ start: number; end: number; duration: number }> {
    const dayStart = new Date(date).getTime();
    const dayEnd = dayStart + 86400000;
    const starts = this.events.filter(
      (e) => e.type === "work_session_start" && e.timestamp >= dayStart && e.timestamp < dayEnd,
    );
    const sessions: Array<{ start: number; end: number; duration: number }> = [];
    for (const s of starts) {
      const end = this.events.find(
        (e) => e.type === "work_session_end" && e.timestamp > s.timestamp && e.timestamp < dayEnd,
      );
      const endTs = end?.timestamp ?? Date.now();
      sessions.push({ start: s.timestamp, end: endTs, duration: endTs - s.timestamp });
    }
    return sessions;
  }

  onEvent(handler: (event: TimelineEvent) => void): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  private summary(date: string): DailySummary | null {
    const dayStart = new Date(date).getTime();
    const dayEnd = dayStart + 86400000;
    const dayEvents = this.events.filter((e) => e.timestamp >= dayStart && e.timestamp < dayEnd);
    if (dayEvents.length === 0) return null;

    const workSessions = this.getWorkSessions(date);
    const workDuration = workSessions.reduce((sum, s) => sum + s.duration, 0);
    const goalsProgressed = [...new Set(dayEvents.filter((e) => e.goalId).map((e) => e.goalId!))];
    const errorsEncountered = dayEvents.filter((e) => e.type === "error_occurred" || e.type === "build_failure").length;
    const commitsMade = dayEvents.filter((e) => e.type === "commit").length;

    return {
      date,
      events: dayEvents,
      totalEvents: dayEvents.length,
      workDuration,
      goalsProgressed,
      errorsEncountered,
      commitsMade,
      summary: "",
    };
  }
}
