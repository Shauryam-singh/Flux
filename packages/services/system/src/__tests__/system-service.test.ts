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
    else if (cmd.includes("nmcli -t -f NAME,TYPE,DEVICE connection show --active")) stdout = "HomeWiFi:802-11-wireless:wlan0\n";
    else if (cmd.includes("nmcli -t -f NAME,TYPE connection show --active")) stdout = "HomeWiFi:802-11-wireless\n";
    else if (cmd.includes("nmcli -t -f NAME connection show")) stdout = "HomeWiFi\nWorkWiFi\n";
    else if (cmd.includes("nmcli -t -f WIFI general")) stdout = "enabled\n";
    else if (cmd.includes("nmcli -t -f AIRPLANE general")) stdout = "disabled\n";
    else if (cmd.includes("nmcli device wifi rescan")) stdout = "";
    else if (cmd.includes("nmcli -t -f SSID,SIGNAL,SECURITY device wifi list")) stdout = "HomeWiFi:85:WPA2\nWorkWiFi:72:WPA2\n";
    else if (cmd.includes("nmcli connection down")) stdout = "";
    else if (cmd.includes("nmcli connection up")) stdout = "";
    else if (cmd.includes("nmcli device wifi connect")) stdout = "";
    else if (cmd.includes("nmcli radio wifi")) stdout = "";
    else if (cmd.includes("bluetoothctl show 2>/dev/null | grep 'Powered:' | awk")) stdout = "yes\n";
    else if (cmd.includes("bluetoothctl show 2>/dev/null | grep 'Name:' | cut")) stdout = "TestPC\n";
    else if (cmd.includes("bluetoothctl show 2>/dev/null | grep 'Adapter:' | awk")) stdout = "/org/bluez/hci0\n";
    else if (cmd.includes("bluetoothctl show")) stdout = "Powered: yes\nName: TestPC\nAdapter: /org/bluez/hci0\n";
    else if (cmd.includes("bluetoothctl scan on")) stdout = "";
    else if (cmd.includes("bluetoothctl scan off")) stdout = "";
    else if (cmd.includes("bluetoothctl devices Connected")) stdout = "Device AA:BB:CC:DD:EE:FF AirPods\n";
    else if (cmd.includes("bluetoothctl devices")) stdout = "Device AA:BB:CC:DD:EE:FF AirPods\nDevice 11:22:33:44:55:66 Keyboard\n";
    else if (cmd.includes("wl-paste")) stdout = "clipboard content\n";
    else if (cmd.includes("ps aux --sort=-%cpu")) stdout = "user  10.0  5.0  firefox\nuser   8.0  3.0  code\n";
    else if (cmd.includes("ps aux --sort=-%mem")) stdout = "user   5.0 10.0  code\nuser  10.0  5.0  firefox\n";
    else if (cmd.includes("ps aux | wc -l")) stdout = "150\n";
    else if (cmd.includes("ps aux | grep -i")) stdout = "user  10.0  5.0  firefox\n";
    else if (cmd.includes("pkill -9 -f")) stdout = "";
    else if (cmd.includes("playerctl metadata")) stdout = "Artist - Song (Album)\n";
    else if (cmd.includes("playerctl play-pause")) stdout = "";
    else if (cmd.includes("playerctl status")) stdout = "Playing\n";
    else if (cmd.includes("playerctl")) stdout = "";
    else if (cmd.includes("ip -4 addr show scope global")) stdout = "inet 192.168.1.100/24\n";
    else if (cmd.includes("ip route show default")) stdout = "default via 192.168.1.1\n";
    else if (cmd.includes("ip -o link show")) stdout = "wlan0 UP\neth0 DOWN\n";
    else if (cmd.includes("cat /etc/resolv.conf")) stdout = "nameserver 8.8.8.8\nnameserver 8.8.4.4\n";
    else if (cmd.includes("curl -s ifconfig.me")) stdout = "203.0.113.42\n";
    else if (cmd.includes("pgrep -x gammastep")) stdout = "";
    else if (cmd.includes("makoctl")) stdout = "";
    else if (cmd.includes("echo $HYPRLAND_INSTANCE_SIGNATURE")) stdout = "abc123\n";
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

  // ── Original tests ──
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

  // ── WiFi tests ──
  it("should handle 'wifi status'", async () => {
    const result = await service.execute("wifi", ctx);
    expect(result.text).toContain("WiFi Status");
    expect(result.text).toContain("HomeWiFi");
  });

  it("should handle 'scan wifi'", async () => {
    const result = await service.execute("scan wifi", ctx);
    expect(result.text).toContain("Available WiFi");
    expect(result.text).toContain("HomeWiFi");
  });

  it("should handle 'connect to wifi HomeWiFi'", async () => {
    const result = await service.execute("connect to HomeWiFi", ctx);
    expect(result.text.toLowerCase()).toContain("connected");
    expect(result.text.toLowerCase()).toContain("homewifi");
  });

  it("should handle 'disconnect wifi'", async () => {
    const result = await service.execute("disconnect wifi", ctx);
    expect(result.text).toContain("Disconnected");
  });

  it("should handle 'turn on wifi'", async () => {
    const result = await service.execute("turn on wifi", ctx);
    expect(result.text).toContain("enabled");
  });

  it("should handle 'turn off wifi'", async () => {
    const result = await service.execute("turn off wifi", ctx);
    expect(result.text).toContain("disabled");
  });

  // ── Bluetooth tests ──
  it("should handle 'bluetooth status'", async () => {
    const result = await service.execute("bluetooth", ctx);
    expect(result.text).toContain("Bluetooth Status");
    expect(result.text).toContain("On");
  });

  it("should handle 'scan bluetooth'", { timeout: 10000 }, async () => {
    const result = await service.execute("scan bluetooth", ctx);
    expect(result.text).toContain("Nearby Bluetooth");
    expect(result.text).toContain("AirPods");
  });

  it("should handle 'turn on bluetooth'", async () => {
    const result = await service.execute("turn on bluetooth", ctx);
    expect(result.text).toContain("enabled");
  });

  it("should handle 'turn off bluetooth'", async () => {
    const result = await service.execute("turn off bluetooth", ctx);
    expect(result.text).toContain("disabled");
  });

  // ── Clipboard tests ──
  it("should handle 'clipboard'", async () => {
    const result = await service.execute("clipboard", ctx);
    expect(result.text).toContain("Clipboard");
    expect(result.text).toContain("clipboard content");
  });

  it("should handle 'copy hello world'", async () => {
    const result = await service.execute("copy hello world", ctx);
    expect(result.text).toContain("Copied");
    expect(result.text).toContain("hello world");
  });

  it("should handle 'clear clipboard'", async () => {
    const result = await service.execute("clear clipboard", ctx);
    expect(result.text).toContain("cleared");
  });

  // ── Process tests ──
  it("should handle 'list processes'", async () => {
    const result = await service.execute("processes", ctx);
    expect(result.text).toContain("Running Processes");
  });

  it("should handle 'top processes'", async () => {
    const result = await service.execute("top processes by cpu", ctx);
    expect(result.text).toContain("Top Processes");
  });

  it("should handle 'search process firefox'", async () => {
    const result = await service.execute("search process firefox", ctx);
    expect(result.text).toContain("firefox");
  });

  it("should handle 'kill process firefox'", async () => {
    const result = await service.execute("kill process firefox", ctx);
    expect(result.text).toContain("Killed");
    expect(result.text).toContain("firefox");
  });

  // ── Media tests ──
  it("should handle 'play music'", async () => {
    const result = await service.execute("play music", ctx);
    expect(result.text).toContain("playing");
  });

  it("should handle 'pause'", async () => {
    const result = await service.execute("pause", ctx);
    expect(result.text).toContain("Media");
  });

  it("should handle 'next track'", async () => {
    const result = await service.execute("next track", ctx);
    expect(result.text).toContain("next");
  });

  it("should handle 'what song is playing'", async () => {
    const result = await service.execute("what song is playing", ctx);
    expect(result.text).toContain("Now Playing");
    expect(result.text).toContain("Artist");
  });

  // ── Keyboard tests ──
  it("should handle 'press Ctrl+C'", async () => {
    const result = await service.execute("press Ctrl+C", ctx);
    expect(result.text).toContain("Pressed");
    expect(result.text.toLowerCase()).toContain("ctrl+c");
  });

  it("should handle 'shortcut Alt+Tab'", async () => {
    const result = await service.execute("shortcut Alt+Tab", ctx);
    expect(result.text).toContain("Pressed");
  });

  // ── Night Light tests ──
  it("should handle 'night light'", async () => {
    const result = await service.execute("night light", ctx);
    expect(result.text).toContain("Night light");
  });

  // ── DND tests ──
  it("should handle 'do not disturb'", async () => {
    const result = await service.execute("do not disturb", ctx);
    expect(result.text).toContain("DND");
  });

  it("should handle 'turn on dnd'", async () => {
    const result = await service.execute("turn on dnd", ctx);
    expect(result.text).toContain("enabled");
  });

  // ── Workspace tests ──
  it("should handle 'workspace 3'", async () => {
    const result = await service.execute("workspace 3", ctx);
    expect(result.text).toContain("workspace");
    expect(result.text).toContain("3");
  });

  it("should handle 'next workspace'", async () => {
    const result = await service.execute("next workspace", ctx);
    expect(result.text).toContain("right");
  });

  it("should handle 'previous workspace'", async () => {
    const result = await service.execute("previous workspace", ctx);
    expect(result.text).toContain("left");
  });

  // ── Network tests ──
  it("should handle 'my ip'", async () => {
    const result = await service.execute("my ip", ctx);
    expect(result.text).toContain("Network Info");
    expect(result.text).toContain("192.168.1.100");
  });

  it("should handle 'public ip'", async () => {
    const result = await service.execute("what is my public ip", ctx);
    expect(result.text).toContain("Public IP");
    expect(result.text).toContain("203.0.113.42");
  });

  it("should handle 'dns'", async () => {
    const result = await service.execute("dns", ctx);
    expect(result.text).toContain("DNS");
    expect(result.text).toContain("8.8.8.8");
  });

  it("should handle 'network interfaces'", async () => {
    const result = await service.execute("network interfaces", ctx);
    expect(result.text).toContain("Network Interfaces");
    expect(result.text).toContain("wlan0");
  });

  // ── canHandle tests ──
  it("should handle wifi keywords", async () => {
    expect(await service.canHandle("wifi")).toBe(true);
    expect(await service.canHandle("scan wifi networks")).toBe(true);
    expect(await service.canHandle("connect to wifi")).toBe(true);
  });

  it("should handle bluetooth keywords", async () => {
    expect(await service.canHandle("bluetooth")).toBe(true);
    expect(await service.canHandle("pair bluetooth device")).toBe(true);
  });

  it("should handle clipboard keywords", async () => {
    expect(await service.canHandle("clipboard")).toBe(true);
    expect(await service.canHandle("copy text")).toBe(true);
  });

  it("should handle media keywords", async () => {
    expect(await service.canHandle("play music")).toBe(true);
    expect(await service.canHandle("next track")).toBe(true);
  });

  it("should handle process keywords", async () => {
    expect(await service.canHandle("list processes")).toBe(true);
    expect(await service.canHandle("kill firefox")).toBe(true);
  });

  it("should handle workspace keywords", async () => {
    expect(await service.canHandle("workspace 1")).toBe(true);
    expect(await service.canHandle("next workspace")).toBe(true);
  });

  it("should handle network keywords", async () => {
    expect(await service.canHandle("my ip address")).toBe(true);
    expect(await service.canHandle("dns settings")).toBe(true);
  });

  it("should handle dnd keywords", async () => {
    expect(await service.canHandle("do not disturb")).toBe(true);
    expect(await service.canHandle("dnd on")).toBe(true);
  });

  it("should handle night light keywords", async () => {
    expect(await service.canHandle("night light")).toBe(true);
    expect(await service.canHandle("blue light filter")).toBe(true);
  });
});
