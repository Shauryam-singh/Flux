import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSystemService } from "../impl/system-service.js";
import type { ServiceContext } from "@ai-agent/services-core";

vi.mock("node:child_process", () => ({
  execSync: vi.fn((cmd: string) => {
    if (cmd.includes("hostname")) return "test-host\n";
    if (cmd.includes("uptime -p")) return "up 5 hours\n";
    if (cmd.includes("nproc")) return "8\n";
    if (cmd.includes("MemTotal")) return "16384000\n";
    if (cmd.includes("MemAvailable")) return "8192000\n";
    if (cmd.includes("uname -r")) return "5.15.0\n";
    if (cmd.includes("df -h")) return "/dev/sda1  100G  50G  50G  50% /\n";
    if (cmd.includes("which")) return "/usr/bin/test\n";
    return "";
  }),
}));

function createMockContext(): ServiceContext {
  return {
    sessionId: "test-session",
    memory: {
      add: vi.fn().mockResolvedValue(undefined),
      history: vi.fn().mockResolvedValue([]),
    } as unknown as ServiceContext["memory"],
    provider: null,
    reply: vi.fn(),
    speak: vi.fn(),
    emit: vi.fn(),
  };
}

describe("system service", () => {
  let service: ReturnType<typeof createSystemService>;
  let ctx: ServiceContext;

  beforeEach(() => {
    service = createSystemService();
    ctx = createMockContext();
  });

  it("should have correct name", () => {
    expect(service.name).toBe("system");
  });

  it("should return system info", async () => {
    const result = await service.execute("Show system info", ctx);
    expect(result.text).toContain("System Information");
    expect(result.text).toContain("Hostname");
  });

  it("should handle volume commands", async () => {
    const result = await service.execute("Set volume to 50%", ctx);
    expect(result.text).toContain("50");
  });

  it("should handle open commands", async () => {
    const result = await service.execute("open chrome", ctx);
    expect(result.text).toContain("Opened");
  });

  it("should handle sleep command", async () => {
    const result = await service.execute("sleep", ctx);
    expect(result.text).toContain("suspending");
  });
});
