import { describe, it, expect, vi, beforeEach } from "vitest";
import { createEmailService } from "../impl/email-service.js";

// Mock execSync
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

// Mock fs
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  writeFileSync: vi.fn(),
  readdirSync: vi.fn().mockReturnValue([]),
  mkdirSync: vi.fn(),
}));

describe("emailService", () => {
  let service: ReturnType<typeof createEmailService>;
  const mockContext = {} as any;

  beforeEach(() => {
    service = createEmailService();
    vi.clearAllMocks();
  });

  it("should have correct name", () => {
    expect(service.name).toBe("email");
  });

  it("should have canHandle method", () => {
    expect(typeof service.canHandle).toBe("function");
  });

  it("should handle email queries", () => {
    expect(service.canHandle("check my email")).toBe(true);
    expect(service.canHandle("read emails from john")).toBe(true);
    expect(service.canHandle("summarize my inbox")).toBe(true);
    expect(service.canHandle("draft email to alice")).toBe(true);
    expect(service.canHandle("search emails meeting")).toBe(true);
  });

  it("should not handle non-email queries", () => {
    expect(service.canHandle("what time is it")).toBe(false);
    expect(service.canHandle("play music")).toBe(false);
  });

  it("should have execute method", () => {
    expect(typeof service.execute).toBe("function");
  });
});
