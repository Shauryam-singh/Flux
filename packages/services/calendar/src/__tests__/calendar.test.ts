import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCalendarService } from "../impl/calendar-service.js";

// Mock execSync
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

// Mock fs
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  readdirSync: vi.fn().mockReturnValue([]),
}));

describe("calendarService", () => {
  let service: ReturnType<typeof createCalendarService>;
  const mockContext = {} as any;

  beforeEach(() => {
    service = createCalendarService();
    vi.clearAllMocks();
  });

  it("should have correct name", () => {
    expect(service.name).toBe("calendar");
  });

  it("should have canHandle method", () => {
    expect(typeof service.canHandle).toBe("function");
  });

  it("should handle calendar queries", () => {
    expect(service.canHandle("what's on my calendar")).toBe(true);
    expect(service.canHandle("my schedule today")).toBe(true);
    expect(service.canHandle("upcoming meetings")).toBe(true);
    expect(service.canHandle("create meeting")).toBe(true);
    expect(service.canHandle("cancel meeting")).toBe(true);
  });

  it("should not handle non-calendar queries", () => {
    expect(service.canHandle("what time is it")).toBe(false);
    expect(service.canHandle("play music")).toBe(false);
  });

  it("should have execute method", () => {
    expect(typeof service.execute).toBe("function");
  });
});
