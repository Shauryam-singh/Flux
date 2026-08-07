import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSystemFixService } from "../impl/system-fix-service.js";

// Mock execSync
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

describe("systemFixService", () => {
  let service: ReturnType<typeof createSystemFixService>;
  const mockContext = {} as any;

  beforeEach(() => {
    service = createSystemFixService();
    vi.clearAllMocks();
  });

  it("should have correct name", () => {
    expect(service.name).toBe("system-fix");
  });

  it("should have canHandle method", () => {
    expect(typeof service.canHandle).toBe("function");
  });

  it("should handle system queries", () => {
    expect(service.canHandle("CPU usage")).toBe(true);
    expect(service.canHandle("clean up disk")).toBe(true);
    expect(service.canHandle("check for updates")).toBe(true);
    expect(service.canHandle("network check")).toBe(true);
    expect(service.canHandle("system health")).toBe(true);
  });

  it("should not handle non-system queries", () => {
    expect(service.canHandle("what time is it")).toBe(false);
    expect(service.canHandle("play music")).toBe(false);
  });

  it("should have execute method", () => {
    expect(typeof service.execute).toBe("function");
  });
});
