import type { CalendarSensor, CalendarConfig } from "../interfaces/calendar-sensor.js";
import type { CalendarEvent, CalendarState } from "@ai-agent/ambient-types";

const DEFAULT_CONFIG: CalendarConfig = {
  provider: "mock",
  pollIntervalMs: 60000,
  enabled: true,
  lookAheadHours: 24,
  reminderMinutes: 15,
};

export class DefaultCalendarSensor implements CalendarSensor {
  private config: CalendarConfig;
  private events: CalendarEvent[] = [];
  private handlers: Array<(state: CalendarState) => void> = [];

  constructor(config?: Partial<CalendarConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async getState(): Promise<CalendarState> {
    const now = Date.now();
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayEvents = this.events.filter((e) => {
      const eventDate = new Date(e.startTime);
      return eventDate.toDateString() === new Date().toDateString();
    });

    const currentEvent = this.events.find(
      (e) => now >= e.startTime && now <= e.endTime,
    ) ?? null;

    const nextEvent = this.events
      .filter((e) => e.startTime > now)
      .sort((a, b) => a.startTime - b.startTime)[0] ?? null;

    const upcomingDeadlines = this.events
      .filter((e) => e.type === "deadline" && e.startTime > now && e.startTime < now + 7 * 86400000)
      .sort((a, b) => a.startTime - b.startTime);

    const focusBlockActive = currentEvent !== null && currentEvent.type === "focus_block";

    return {
      events: this.events,
      nextEvent,
      timeUntilNextEvent: nextEvent ? nextEvent.startTime - now : null,
      currentEvent,
      focusBlockActive,
      todayEventCount: todayEvents.length,
      upcomingDeadlines,
    };
  }

  async getUpcoming(hours: number): Promise<ReadonlyArray<CalendarEvent>> {
    const now = Date.now();
    const cutoff = now + hours * 3600000;
    return this.events
      .filter((e) => e.startTime >= now && e.startTime <= cutoff)
      .sort((a, b) => a.startTime - b.startTime);
  }

  async getNextEvent(): Promise<CalendarEvent | null> {
    const now = Date.now();
    return this.events
      .filter((e) => e.startTime > now)
      .sort((a, b) => a.startTime - b.startTime)[0] ?? null;
  }

  isAvailable(): boolean {
    return this.config.enabled;
  }

  async refresh(): Promise<void> {
    for (const handler of this.handlers) {
      handler(await this.getState());
    }
  }

  onChange(handler: (state: CalendarState) => void): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  addEvent(event: CalendarEvent): void {
    this.events.push(event);
    this.events.sort((a, b) => a.startTime - b.startTime);
  }

  removeEvent(eventId: string): void {
    this.events = this.events.filter((e) => e.id !== eventId);
  }
}
