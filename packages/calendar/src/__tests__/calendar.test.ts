import { describe, it, expect, beforeEach } from "vitest";
import { DefaultCalendarSensor } from "../impl/default-calendar-sensor.js";
import type { CalendarEvent } from "@ai-agent/ambient-types";

describe("DefaultCalendarSensor", () => {
  let sensor: DefaultCalendarSensor;

  beforeEach(() => {
    sensor = new DefaultCalendarSensor();
  });

  const makeEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
    id: `evt_${Math.random()}`,
    title: "Team Sync",
    description: "Weekly standup",
    startTime: Date.now() + 3600000,
    endTime: Date.now() + 7200000,
    type: "meeting",
    location: "Zoom",
    attendees: ["alice@example.com"],
    isAllDay: false,
    recurring: true,
    reminderMinutes: 15,
    metadata: {},
    ...overrides,
  });

  it("should return empty state by default", async () => {
    const state = await sensor.getState();
    expect(state.events.length).toBe(0);
    expect(state.todayEventCount).toBe(0);
    expect(state.focusBlockActive).toBe(false);
  });

  it("should add and retrieve events", async () => {
    sensor.addEvent(makeEvent({ startTime: Date.now() + 60000, endTime: Date.now() + 120000 }));
    const state = await sensor.getState();
    expect(state.events.length).toBe(1);
  });

  it("should find next event", async () => {
    const futureEvent = makeEvent({ startTime: Date.now() + 60000, endTime: Date.now() + 120000 });
    sensor.addEvent(futureEvent);
    const next = await sensor.getNextEvent();
    expect(next).not.toBeNull();
    expect(next!.title).toBe("Team Sync");
  });

  it("should report availability", () => {
    expect(sensor.isAvailable()).toBe(true);
  });

  it("should remove events", async () => {
    const event = makeEvent();
    sensor.addEvent(event);
    sensor.removeEvent(event.id);
    const state = await sensor.getState();
    expect(state.events.length).toBe(0);
  });
});
