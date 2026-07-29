import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({
  exec: vi.fn((cmd: string, ...args: unknown[]) => {
    let cb: (err: Error | null, stdout: string) => void;
    if (typeof args[0] === "function") {
      cb = args[0] as (err: Error | null, stdout: string) => void;
    } else {
      cb = args[1] as (err: Error | null, stdout: string) => void;
    }
    let stdout = "";
    if (cmd.includes("hostname")) stdout = "test-host\n";
    else if (cmd.includes("uptime -p")) stdout = "up 5 hours\n";
    else if (cmd.includes("nproc")) stdout = "8\n";
    else if (cmd.includes("MemTotal")) stdout = "16384000\n";
    else if (cmd.includes("MemAvailable")) stdout = "8192000\n";
    else if (cmd.includes("uname -r")) stdout = "5.15.0\n";
    else if (cmd.includes("df -h")) stdout = "/dev/sda1  100G  50G  50G  50% /\n";
    else if (cmd.includes("which")) stdout = "/usr/bin/test\n";
    else if (cmd.includes("PRETTY_NAME")) stdout = 'PRETTY_NAME="CachyOS"\n';
    else if (cmd.includes("XDG_CURRENT_DESKTOP")) stdout = "HyDE\n";
    else if (cmd.includes("WAYLAND_DISPLAY")) stdout = "wayland-0\n";
    else if (cmd.includes("DESKTOP_SESSION")) stdout = "hyprland\n";
    else if (cmd.includes("wpctl get-volume")) stdout = "Volume: 0.50\n";
    else if (cmd.includes("brightnessctl -m")) stdout = "70\n";
    else if (cmd.includes("upower")) stdout = "percentage: 85%\nstate: discharging\n";
    else if (cmd.includes("BAT0/capacity")) stdout = "85\n";
    else if (cmd.includes("BAT0/status")) stdout = "Discharging\n";
    else if (cmd.includes("acpi")) stdout = "Battery 0: Discharging, 85%, 04:30:00 remaining\n";
    cb(null, stdout);
    return { on: () => {}, kill: () => {} };
  }),
  execSync: vi.fn((cmd: string) => {
    if (cmd.includes("hostname")) return "test-host\n";
    if (cmd.includes("HYPRLAND_INSTANCE_SIGNATURE")) return "abc123\n";
    return "";
  }),
}));

import { createSystemService } from "../impl/system-service.js";
import type { ServiceContext } from "@ai-agent/services-core";

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

  it("should handle 'hey flux can u open kitty'", async () => {
    const result = await service.execute("hey flux can u open kitty", ctx);
    expect(result.text).toContain("kitty");
  });

  it("should handle 'can you open firefox for me'", async () => {
    const result = await service.execute("can you open firefox for me", ctx);
    expect(result.text).toContain("firefox");
  });

  it("should handle 'whats my battery'", async () => {
    const result = await service.execute("whats my battery", ctx);
    expect(result.text.toLowerCase()).toContain("battery");
  });

  it("should handle 'lower my brightness'", async () => {
    const result = await service.execute("lower my brightness", ctx);
    expect(result.text.toLowerCase()).toContain("brightness");
  });

  it("should handle 'mute'", async () => {
    const result = await service.execute("mute", ctx);
    expect(result.text).toContain("toggled");
  });

  it("should handle standalone app name 'firefox'", async () => {
    const result = await service.execute("firefox", ctx);
    expect(result.text).toContain("firefox");
  });

  it("should handle 'close discord'", async () => {
    const result = await service.execute("close discord", ctx);
    expect(result.text).toContain("Closed");
  });

  it("should handle 'screenshot'", async () => {
    const result = await service.execute("screenshot", ctx);
    expect(result.text.toLowerCase()).toContain("screenshot");
  });
});
