import type { CalendarEvent, CalendarState } from "@ai-agent/ambient-types";

export interface CalendarSensor {
  getState(): Promise<CalendarState>;
  getUpcoming(hours: number): Promise<ReadonlyArray<CalendarEvent>>;
  getNextEvent(): Promise<CalendarEvent | null>;
  isAvailable(): boolean;
  refresh(): Promise<void>;
  onChange(handler: (state: CalendarState) => void): () => void;
}

export interface CalendarConfig {
  readonly provider: "ical" | "google" | "outlook" | "mock";
  readonly pollIntervalMs: number;
  readonly enabled: boolean;
  readonly lookAheadHours: number;
  readonly reminderMinutes: number;
}
