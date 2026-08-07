import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFileIntelligenceService } from "../impl/file-intelligence-service.js";

// Mock execSync
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

// Mock fs
vi.mock("node:fs", () => ({
  readdirSync: vi.fn().mockReturnValue([]),
  statSync: vi.fn().mockReturnValue({ isFile: () => true, size: 1024 }),
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  renameSync: vi.fn(),
  copyFileSync: vi.fn(),
}));

describe("fileIntelligenceService", () => {
  let service: ReturnType<typeof createFileIntelligenceService>;
  const mockContext = {} as any;

  beforeEach(() => {
    service = createFileIntelligenceService();
    vi.clearAllMocks();
  });

  it("should have correct name", () => {
    expect(service.name).toBe("file-intelligence");
  });

  it("should have canHandle method", () => {
    expect(typeof service.canHandle).toBe("function");
  });

  it("should handle file queries", () => {
    expect(service.canHandle("find all PDFs")).toBe(true);
    expect(service.canHandle("organize my downloads")).toBe(true);
    expect(service.canHandle("show diff")).toBe(true);
    expect(service.canHandle("disk usage")).toBe(true);
    expect(service.canHandle("clean up disk")).toBe(true);
  });

  it("should not handle non-file queries", () => {
    expect(service.canHandle("what time is it")).toBe(false);
    expect(service.canHandle("play music")).toBe(false);
  });

  it("should have execute method", () => {
    expect(typeof service.execute).toBe("function");
  });
});
