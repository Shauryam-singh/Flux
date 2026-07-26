import { execSync } from "node:child_process";
import type { Service } from "@ai-agent/services-core";
import type { ServiceContext } from "@ai-agent/services-core";
import type { ServiceResponse } from "@ai-agent/services-core";

function getPlatform(): "linux" | "win32" | "darwin" {
  return process.platform as "linux" | "win32" | "darwin";
}

function run(command: string): string {
  try {
    return execSync(command, { encoding: "utf-8", timeout: 10000 }).trim();
  } catch {
    return "";
  }
}

function getSystemInfo(): string {
  const platform = getPlatform();
  const parts: string[] = [];

  parts.push(`**System Information**`);
  parts.push(`Platform: ${process.platform}`);
  parts.push(`Arch: ${process.arch}`);
  parts.push(`Node: ${process.version}`);

  if (platform === "linux") {
    const hostname = run("hostname");
    const uptime = run("uptime -p");
    const cpuModel = run("grep 'model name' /proc/cpuinfo | head -1 | cut -d: -f2");
    const cpuCores = run("nproc");
    const memTotal = run("grep MemTotal /proc/meminfo | awk '{print $2}'");
    const memAvail = run("grep MemAvailable /proc/meminfo | awk '{print $2}'");
    const diskUsage = run("df -h / | tail -1 | awk '{print $3\"/\"$2\" (\"$5\" used)\"}'");
    const kernelVersion = run("uname -r");

    if (hostname) parts.push(`Hostname: ${hostname}`);
    if (kernelVersion) parts.push(`Kernel: ${kernelVersion}`);
    if (uptime) parts.push(`Uptime: ${uptime}`);
    if (cpuModel) parts.push(`CPU: ${cpuModel.trim()} (${cpuCores} cores)`);
    if (memTotal && memAvail) {
      const totalMB = Math.round(parseInt(memTotal) / 1024);
      const availMB = Math.round(parseInt(memAvail) / 1024);
      const usedMB = totalMB - availMB;
      const pct = Math.round((usedMB / totalMB) * 100);
      parts.push(`Memory: ${usedMB}MB used / ${totalMB}MB total (${pct}%)`);
    }
    if (diskUsage) parts.push(`Disk: ${diskUsage}`);
  } else if (platform === "win32") {
    const hostname = run("hostname");
    const memInfo = run("wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /value");
    if (hostname) parts.push(`Hostname: ${hostname}`);
    if (memInfo) {
      const free = memInfo.match(/FreePhysicalMemory=(\d+)/)?.[1];
      const total = memInfo.match(/TotalVisibleMemorySize=(\d+)/)?.[1];
      if (free && total) {
        const freeMB = Math.round(parseInt(free) / 1024);
        const totalMB = Math.round(parseInt(total) / 1024);
        parts.push(`Memory: ${totalMB - freeMB}MB used / ${totalMB}MB total`);
      }
    }
  } else if (platform === "darwin") {
    const hostname = run("hostname");
    const uptime = run("uptime -p");
    const memInfo = run("sysctl -n hw.memsize");
    if (hostname) parts.push(`Hostname: ${hostname}`);
    if (uptime) parts.push(`Uptime: ${uptime}`);
    if (memInfo) {
      const totalMB = Math.round(parseInt(memInfo) / 1024 / 1024);
      parts.push(`Memory: ${totalMB}MB total`);
    }
  }

  return parts.join("\n");
}

function openApplication(input: string): string {
  const platform = getPlatform();
  const app = input
    .replace(/^(open|launch|start|run)\s*/i, "")
    .trim();

  if (!app) return "What would you like to open?";

  // Common app name mappings
  const appMap: Record<string, string> = {
    "vs code": "code",
    "vscode": "code",
    "visual studio code": "code",
    "chrome": "google-chrome",
    "firefox": "firefox",
    "terminal": "gnome-terminal",
    "nautilus": "nautilus",
    "files": "nautilus",
    "settings": "gnome-control-center",
    "calculator": "gnome-calculator",
    "spotify": "spotify",
    "discord": "discord",
    "slack": "slack",
    "code": "code",
  };

  const resolved = appMap[app.toLowerCase()] ?? app;

  if (platform === "linux") {
    const result = run(`which ${resolved} 2>/dev/null`);
    if (result) {
      run(`nohup ${resolved} > /dev/null 2>&1 &`);
      return `Opened **${app}**`;
    }
    // Try as-is
    run(`nohup ${app} > /dev/null 2>&1 &`);
    return `Attempting to open **${app}**`;
  } else if (platform === "win32") {
    run(`start "" "${resolved}"`);
    return `Opened **${app}**`;
  } else if (platform === "darwin") {
    run(`open -a "${app}"`);
    return `Opened **${app}**`;
  }

  return `Cannot open ${app} on this platform`;
}

function closeApplication(input: string): string {
  const app = input
    .replace(/^(close|quit|kill)\s*/i, "")
    .trim();

  if (!app) return "What would you like to close?";

  const result = run(`pkill -f "${app}" 2>/dev/null`);
  if (result === "" || result.includes("no process")) {
    return `No running process found for **${app}**`;
  }
  return `Closed **${app}**`;
}

function getVolume(): string {
  const platform = getPlatform();
  if (platform === "linux") {
    const result = run("amixer get Master 2>/dev/null | grep -o '\\[.*%\\]' | head -1");
    if (result) {
      const pct = result.replace(/[[\]%]/g, "").trim();
      return `Volume: **${pct}%**`;
    }
    return "Could not get volume. Is ALSA installed?";
  } else if (platform === "win32") {
    return "Volume control not yet implemented for Windows";
  }
  return "Volume control not available on this platform";
}

function setVolume(level: number): string {
  const platform = getPlatform();
  if (platform === "linux") {
    run(`amixer set Master ${level}% 2>/dev/null`);
    return `Volume set to **${level}%**`;
  }
  return "Volume control not available on this platform";
}

function takeScreenshot(): string {
  const platform = getPlatform();
  const path = `/tmp/flux_screenshot_${Date.now()}.png`;

  if (platform === "linux") {
    run(`gnome-screenshot -f ${path} 2>/dev/null || scrot ${path} 2>/dev/null || import -window root ${path} 2>/dev/null`);
    return `Screenshot saved to \`${path}\``;
  } else if (platform === "darwin") {
    run(`screencapture ${path}`);
    return `Screenshot saved to \`${path}\``;
  }
  return "Screenshot not available on this platform";
}

export function createSystemService(): Service {
  return {
    name: "system",
    description: "System control: open/close apps, volume, brightness, battery, WiFi, system info, screenshots, shutdown, restart",

    async canHandle(input: string): Promise<boolean> {
      const lower = input.toLowerCase();
      const keywords = [
        "open ", "close ", "launch ", "start ", "run ",
        "volume", "brightness", "battery", "wifi", "bluetooth",
        "shutdown", "restart", "reboot", "sleep", "lock", "suspend",
        "screenshot", "system info", "hostname", "uptime",
        "cpu", "memory", "disk", "platform", "kernel",
      ];
      return keywords.some((k) => lower.includes(k));
    },

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const lower = input.toLowerCase();

      let result: string;

      if (/^(show|get|what('s| is))\s+(system\s+info|hostname|uptime|cpu|memory|disk|battery|wifi|bluetooth|kernel|platform)/i.test(lower) ||
          /^(system\s+info|hostname|uptime|kernel|platform)$/i.test(lower)) {
        result = getSystemInfo();
      } else if (/^(open|launch|start|run)\s+/i.test(lower)) {
        result = openApplication(input);
      } else if (/^(close|quit|kill)\s+/i.test(lower)) {
        result = closeApplication(input);
      } else if (/^(set|change|adjust)\s+volume\s+to?\s*(\d+)/i.test(lower)) {
        const match = input.match(/(\d+)/);
        const level = match?.[1] ? parseInt(match[1]) : 50;
        result = setVolume(Math.min(100, Math.max(0, level)));
      } else if (/^(get|show|what('s| is))\s+volume/i.test(lower) || /^volume$/i.test(lower)) {
        result = getVolume();
      } else if (/^(set|change|adjust)\s+brightness\s+to?\s*(\d+)/i.test(lower)) {
        const match = input.match(/(\d+)/);
        const level = match?.[1] ? parseInt(match[1]) : 50;
        run(`brightnessctl set ${level}% 2>/dev/null || xbacklight -set ${level} 2>/dev/null`);
        result = `Brightness set to **${level}%**`;
      } else if (/^(screenshot|take\s+screenshot)/i.test(lower)) {
        result = takeScreenshot();
      } else if (/^(shutdown|power\s*off)/i.test(lower)) {
        result = "⚠️ Shutdown requires root. Run: `sudo shutdown -h now`";
      } else if (/^(restart|reboot)/i.test(lower)) {
        result = "⚠️ Restart requires root. Run: `sudo reboot`";
      } else if (/^(sleep|suspend)/i.test(lower)) {
        run("systemctl suspend 2>/dev/null");
        result = "System **suspending**...";
      } else if (/^(lock)$/i.test(lower)) {
        run("gnome-screensaver-command -l 2>/dev/null || xdg-screensaver lock 2>/dev/null");
        result = "Screen **locked**";
      } else {
        result = `I can help with: open/close apps, volume, brightness, system info, screenshots, shutdown/restart/sleep/lock. What would you like to do?`;
      }

      await ctx.memory.add("user", input);
      await ctx.memory.add("assistant", result);
      ctx.reply(result);

      return { text: result };
    },
  };
}
