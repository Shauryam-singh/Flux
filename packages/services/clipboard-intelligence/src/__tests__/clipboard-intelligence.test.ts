import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClipboardIntelligenceService } from "../impl/clipboard-intelligence-service.js";

// Mock execSync
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

describe("clipboardIntelligenceService", () => {
  let service: ReturnType<typeof createClipboardIntelligenceService>;
  const mockContext = {} as any;

  beforeEach(() => {
    service = createClipboardIntelligenceService();
    vi.clearAllMocks();
  });

  it("should have correct name", () => {
    expect(service.name).toBe("clipboard-intelligence");
  });

  it("should have canHandle method", () => {
    expect(typeof service.canHandle).toBe("function");
  });

  it("should handle clipboard queries", () => {
    expect(service.canHandle("what's on my clipboard")).toBe(true);
    expect(service.canHandle("translate clipboard")).toBe(true);
    expect(service.canHandle("summarize clipboard")).toBe(true);
    expect(service.canHandle("clipboard history")).toBe(true);
    expect(service.canHandle("explain clipboard")).toBe(true);
  });

  it("should not handle non-clipboard queries", () => {
    expect(service.canHandle("what time is it")).toBe(false);
    expect(service.canHandle("play music")).toBe(false);
  });

  it("should have execute method", () => {
    expect(typeof service.execute).toBe("function");
  });
});
