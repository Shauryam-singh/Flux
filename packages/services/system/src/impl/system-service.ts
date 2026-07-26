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

  parts.push(`Platform: ${process.platform}`);
  parts.push(`Arch: ${process.arch}`);
  parts.push(`Node: ${process.version}`);

  if (platform === "linux") {
    const hostname = run("hostname");
    const uptime = run("uptime -p");
    const cpuModel = run("grep 'model name' /proc/cpuinfo | head -1 | cut -d: -f2");
    const memTotal = run("grep MemTotal /proc/meminfo | awk '{print $2}'");
    const memAvail = run("grep MemAvailable /proc/meminfo | awk '{print $2}'");

    if (hostname) parts.push(`Hostname: ${hostname}`);
    if (uptime) parts.push(`Uptime: ${uptime}`);
    if (cpuModel) parts.push(`CPU: ${cpuModel.trim()}`);
    if (memTotal && memAvail) {
      const totalMB = Math.round(parseInt(memTotal) / 1024);
      const availMB = Math.round(parseInt(memAvail) / 1024);
      parts.push(`Memory: ${availMB}MB available / ${totalMB}MB total`);
    }
  } else if (platform === "win32") {
    const hostname = run("hostname");
    const memInfo = run("wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /value");
    if (hostname) parts.push(`Hostname: ${hostname}`);
    if (memInfo) {
      const free = memInfo.match(/FreePhysicalMemory=(\d+)/)?.[1];
      const total = memInfo.match(/TotalVisibleMemorySize=(\d+)/)?.[1];
      if (free && total) {
        parts.push(`Memory: ${Math.round(parseInt(free) / 1024)}MB available / ${Math.round(parseInt(total) / 1024)}MB total`);
      }
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

  if (platform === "linux") {
    run(`${app} &`);
    return `Opened ${app}`;
  } else if (platform === "win32") {
    run(`start ${app}`);
    return `Opened ${app}`;
  } else if (platform === "darwin") {
    run(`open -a "${app}"`);
    return `Opened ${app}`;
  }

  return `Cannot open ${app} on this platform`;
}

function getVolume(): string {
  const platform = getPlatform();
  if (platform === "linux") {
    const result = run("amixer get Master 2>/dev/null | grep -o '\\[.*%\\]' | head -1");
    return result ? `Volume: ${result}` : "Could not get volume. Is ALSA installed?";
  } else if (platform === "win32") {
    return "Volume control not yet implemented for Windows";
  }
  return "Volume control not available on this platform";
}

function setVolume(level: number): string {
  const platform = getPlatform();
  if (platform === "linux") {
    run(`amixer set Master ${level}% 2>/dev/null`);
    return `Volume set to ${level}%`;
  }
  return "Volume control not available on this platform";
}

export function createSystemService(): Service {
  return {
    name: "system",
    description: "System control: open apps, get system info, volume control",

    async canHandle(input: string): Promise<boolean> {
      const lower = input.toLowerCase();
      const keywords = [
        "open", "close", "volume", "brightness", "battery", "wifi",
        "bluetooth", "shutdown", "restart", "sleep", "lock",
        "screenshot", "screen", "display", "cpu", "memory", "disk",
        "system info", "hostname", "uptime", "platform",
      ];
      return keywords.some((k) => lower.includes(k));
    },

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const lower = input.toLowerCase();

      let result: string;

      if (lower.includes("system info") || lower.includes("hostname") || lower.includes("uptime") || lower.includes("platform")) {
        result = getSystemInfo();
      } else if (lower.startsWith("open ") || lower.startsWith("launch ") || lower.startsWith("start ") || lower.startsWith("run ")) {
        result = openApplication(input);
      } else if (lower.includes("volume") && (lower.includes("set") || lower.includes("change") || lower.includes("adjust"))) {
        const match = input.match(/(\d+)/);
        const level = match?.[1] ? parseInt(match[1]) : 50;
        result = setVolume(Math.min(100, Math.max(0, level)));
      } else if (lower.includes("volume")) {
        result = getVolume();
      } else {
        result = `System command not recognized: "${input}"`;
      }

      await ctx.memory.add("user", input);
      await ctx.memory.add("assistant", result);
      ctx.reply(result);

      return { text: result };
    },
  };
}
