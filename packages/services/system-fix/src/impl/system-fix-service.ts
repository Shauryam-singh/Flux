/**
 * System Monitoring & Auto-Fix Service
 *
 * Analyze, cleanup, update — cross-platform.
 *
 * Commands:
 *   "why is my CPU high?" — analyze processes, suggest/kill
 *   "clean up my disk" — find large files, clear caches
 *   "update all packages" — check for updates, run upgrades
 *   "what's using my memory" — memory analysis
 *   "kill high CPU process" — find and kill CPU hogs
 *   "system health" — full system health report
 *   "restart <service>" — restart a service
 *   "check network" — network diagnostics
 *   "clear cache" — clear system/app caches
 *   "check for updates" — list available updates
 */

import { execSync } from "node:child_process";
import type { Service, ServiceContext, ServiceResponse } from "@ai-agent/services-core";

// ─── Helpers ────────────────────────────────────────────────────

function run(cmd: string, timeoutMs = 15000): string {
  try {
    return execSync(cmd, { timeout: timeoutMs, encoding: "utf-8", stdio: "pipe" }).trim();
  } catch {
    return "";
  }
}

function runPs(script: string): string {
  try {
    return execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"').replace(/\n/g, "; ")}"`, {
      timeout: 15000, encoding: "utf-8", stdio: "pipe",
    }).trim();
  } catch {
    return "";
  }
}

// ─── CPU Analysis ───────────────────────────────────────────────

function analyzeCPU(): string {
  const platform = process.platform;

  if (platform === "linux") {
    const top = run("top -bn1 | head -20");
    const cpuInfo = run("grep 'cpu ' /proc/stat");
    const loadAvg = run("cat /proc/loadavg");

    const processes = run("ps aux --sort=-%cpu | head -10");
    return `CPU Load: ${loadAvg}\n\nTop processes by CPU:\n${processes}`;
  }

  if (platform === "win32") {
    const processes = runPs("Get-Process | Sort-Object CPU -Descending | Select-Object -First 10 Name, Id, CPU, WorkingSet64 | Format-Table -AutoSize");
    const load = runPs("(Get-CimInstance Win32_Processor).LoadPercentage");
    return `CPU Load: ${load}%\n\nTop processes:\n${processes}`;
  }

  return "CPU analysis not available on this platform.";
}

function analyzeMemory(): string {
  const platform = process.platform;

  if (platform === "linux") {
    const memInfo = run("free -h");
    const topMem = run("ps aux --sort=-%mem | head -10");
    return `Memory Usage:\n${memInfo}\n\nTop processes by memory:\n${topMem}`;
  }

  if (platform === "win32") {
    const memInfo = runPs("Get-CimInstance Win32_OperatingSystem | Select-Object TotalVisibleMemorySize, FreePhysicalMemory | Format-List");
    const processes = runPs("Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 10 Name, Id, @{N='MB';E={[math]::Round($_.WorkingSet64/1MB)}} | Format-Table -AutoSize");
    return `Memory:\n${memInfo}\n\nTop processes:\n${processes}`;
  }

  return "Memory analysis not available.";
}

// ─── Disk Cleanup ───────────────────────────────────────────────

function cleanDisk(): string {
  const platform = process.platform;
  const cleaned: string[] = [];

  if (platform === "linux") {
    // Clear package manager cache
    const aptClean = run("sudo apt-get clean 2>/dev/null && echo 'apt cache cleaned'");
    if (aptClean) cleaned.push("apt cache");

    // Clear npm cache
    const npmClean = run("npm cache clean --force 2>/dev/null && echo 'npm cache cleaned'");
    if (npmClean) cleaned.push("npm cache");

    // Clear pip cache
    const pipClean = run("pip cache purge 2>/dev/null && echo 'pip cache cleaned'");
    if (pipClean) cleaned.push("pip cache");

    // Clear thumbnail cache
    const thumbClean = run("rm -rf ~/.cache/thumbnails/* 2>/dev/null && echo 'thumbnails cleared'");
    if (thumbClean) cleaned.push("thumbnails");

    // Clear journal logs older than 3 days
    const journalClean = run("sudo journalctl --vacuum-time=3d 2>/dev/null && echo 'journal cleaned'");
    if (journalClean) cleaned.push("system journal");

    // Empty trash
    const trashClean = run("rm -rf ~/.local/share/Trash/* 2>/dev/null && echo 'trash emptied'");
    if (trashClean) cleaned.push("trash");

    // Clear systemd tmp
    const tmpClean = run("sudo rm -rf /tmp/* 2>/dev/null && echo 'tmp cleaned'");
    if (tmpClean) cleaned.push("/tmp");
  }

  if (platform === "win32") {
    // Clear temp
    const tempClean = runPs("Remove-Item -Path $env:TEMP\\* -Recurse -Force -ErrorAction SilentlyContinue; echo 'temp cleaned'");
    if (tempClean) cleaned.push("temp files");

    // Clear Windows Update cache
    const wuClean = runPs("Stop-Service wuauserv; Remove-Item -Path C:\\Windows\\SoftwareDistribution\\Download\\* -Recurse -Force -ErrorAction SilentlyContinue; Start-Service wuauserv; echo 'WU cache cleaned'");
    if (wuClean) cleaned.push("Windows Update cache");

    // Clear thumbnail cache
    const thumbClean = runPs("Remove-Item -Path $env:LOCALAPPDATA\\Microsoft\\Windows\\Explorer\\thumbcache_*.db -Force -ErrorAction SilentlyContinue; echo 'thumbnails cleared'");
    if (thumbClean) cleaned.push("thumbnails");

    // Clear recycle bin
    const recycleClean = runPs("Clear-RecycleBin -Force -ErrorAction SilentlyContinue; echo 'recycle bin emptied'");
    if (recycleClean) cleaned.push("recycle bin");
  }

  if (cleaned.length === 0) return "No caches cleaned (may need sudo/admin).";
  return `Cleaned: ${cleaned.join(", ")}`;
}

// ─── Package Updates ────────────────────────────────────────────

function checkUpdates(): string {
  const platform = process.platform;
  const updates: string[] = [];

  if (platform === "linux") {
    // APT
    const aptUpdates = run("apt list --upgradable 2>/dev/null | grep -c upgradable");
    if (Number.parseInt(aptUpdates, 10) > 0) updates.push(`APT: ${aptUpdates} packages`);

    // pnpm
    const pnpmOutdated = run("pnpm outdated -r 2>/dev/null | head -5");
    if (pnpmOutdated) updates.push(`pnpm:\n${pnpmOutdated}`);

    // Flatpak
    const flatpakUpdates = run("flatpak update --appstream 2>/dev/null | grep -c available");
    if (Number.parseInt(flatpakUpdates, 10) > 0) updates.push(`Flatpak: ${flatpakUpdates} updates`);
  }

  if (platform === "win32") {
    const wingetUpdates = runPs("winget upgrade --source winget 2>$null | Select-Object -Skip 3 | Select-Object -First 10 | Out-String");
    if (wingetUpdates) updates.push(`winget:\n${wingetUpdates}`);
  }

  if (updates.length === 0) return "No updates available (or package manager not found).";
  return `Available updates:\n\n${updates.join("\n\n")}`;
}

function updateAll(): string {
  const platform = process.platform;
  const results: string[] = [];

  if (platform === "linux") {
    const aptUpdate = run("sudo apt-get update -qq && sudo apt-get upgrade -y 2>&1 | tail -5", 120000);
    if (aptUpdate) results.push(`APT: ${aptUpdate}`);

    const pnpmUpdate = run("pnpm update -r 2>&1 | tail -5", 60000);
    if (pnpmUpdate) results.push(`pnpm: ${pnpmUpdate}`);
  }

  if (platform === "win32") {
    const wingetUpdate = runPs("winget upgrade --all --source winget --accept-package-agreements --accept-source-agreements 2>&1 | Select-Object -Last 5 | Out-String");
    if (wingetUpdate) results.push(`winget: ${wingetUpdate}`);
  }

  if (results.length === 0) return "Update command executed (check output above).";
  return `Update results:\n${results.join("\n")}`;
}

// ─── Network ────────────────────────────────────────────────────

function checkNetwork(): string {
  const platform = process.platform;

  const ping = run("ping -c 3 8.8.8.8 2>/dev/null || ping -n 3 8.8.8.8 2>/dev/null");
  const dns = run("nslookup google.com 2>/dev/null | head -5");
  const ip = run("curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null");
  const connections = platform === "linux"
    ? run("ss -tuln | head -15")
    : runPs("Get-NetTCPConnection -State Established | Select-Object -First 10 LocalPort, RemoteAddress, RemotePort | Format-Table -AutoSize");

  return `Public IP: ${ip || "unknown"}\n\nPing:\n${ping.slice(0, 500)}\n\nDNS:\n${dns}\n\nConnections:\n${connections}`;
}

// ─── Service Management ─────────────────────────────────────────

function restartService(name: string): string {
  const platform = process.platform;

  if (platform === "linux") {
    const output = run(`sudo systemctl restart ${name} 2>&1`);
    return output || `Restarted ${name}`;
  }

  if (platform === "win32") {
    const output = runPs(`Restart-Service -Name "${name}" -Force -ErrorAction SilentlyContinue; echo "Restarted $name"`);
    return output || `Restarted ${name}`;
  }

  return `Service restart not supported on this platform.`;
}

// ─── Kill Process ───────────────────────────────────────────────

function killHighCPU(): string {
  const platform = process.platform;

  if (platform === "linux") {
    const top = run("ps aux --sort=-%cpu | awk 'NR==2{print $2, $11}'");
    const [pid, name] = top.split(/\s+/);
    if (pid) {
      run(`kill ${pid}`);
      return `Killed highest CPU process: ${name} (PID: ${pid})`;
    }
  }

  if (platform === "win32") {
    const proc = runPs("Get-Process | Sort-Object CPU -Descending | Select-Object -First 1 Name, Id | ConvertTo-Json");
    try {
      const parsed = JSON.parse(proc) as Record<string, unknown>;
      const name = String(parsed.Name ?? "");
      const id = Number(parsed.Id ?? 0);
      if (id) {
        runPs(`Stop-Process -Id ${id} -Force`);
        return `Killed highest CPU process: ${name} (PID: ${id})`;
      }
    } catch { /* ignore */ }
  }

  return "Could not identify high CPU process.";
}

// ─── Service ────────────────────────────────────────────────────

const MATCH = /\b(cpu|memory|disk|clean\s*up|cleanup|update|health|network|restart|kill\s+(high|cpu)|system\s+(health|monitor)|what('s| is)\s+using|check\s+(for\s+)?updates?|clear\s+cache|check\s+network)\b/i;

export function createSystemFixService(): Service {
  return {
    name: "system-fix",
    description: "System monitoring & auto-fix — analyze CPU/memory, disk cleanup, package updates, network diagnostics",
    canHandle: (input: string) => MATCH.test(input),

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const lower = input.toLowerCase();

      try {
        // CPU analysis
        if (/\b(why|what).*cpu|cpu.*(high|usage|load)|analyze\s+cpu\b/.test(lower)) {
          return { text: analyzeCPU() };
        }

        // Memory analysis
        if (/\bmemory|ram|what('s| is)\s+using\s+memory\b/.test(lower)) {
          return { text: analyzeMemory() };
        }

        // Kill high CPU
        if (/\bkill\s+(high|cpu)\b/.test(lower) || /\bhigh\s+cpu.*kill\b/.test(lower)) {
          return { text: killHighCPU() };
        }

        // Disk cleanup
        if (/\b(clean\s*up|cleanup)\s*(my\s+)?disk\b/.test(lower) || /\bclean\s*up\b/.test(lower)) {
          return { text: cleanDisk() };
        }

        // Clear cache
        if (/\bclear\s+cache\b/.test(lower)) {
          return { text: cleanDisk() };
        }

        // Check for updates
        if (/\bcheck\s+(for\s+)?updates?\b/.test(lower)) {
          return { text: checkUpdates() };
        }

        // Update all
        if (/\bupdate\s+all\b/.test(lower)) {
          return { text: updateAll() };
        }

        // Network
        if (/\bcheck\s+network\b/.test(lower) || /\bnetwork\s+(check|diagnostic)\b/.test(lower)) {
          return { text: checkNetwork() };
        }

        // Restart service
        const restartMatch = lower.match(/\brestart\s+(\S+)/);
        if (restartMatch) return { text: restartService(restartMatch[1]!) };

        // System health (default)
        if (/\b(health|status|report)\b/.test(lower)) {
          const cpu = analyzeCPU();
          const mem = analyzeMemory();
          return { text: `System Health Report:\n\n${cpu}\n\n${mem}` };
        }

        return { text: "System command not recognized. Try: CPU usage, clean up disk, check updates, network check" };
      } catch (e) {
        return { text: `System error: ${e instanceof Error ? e.message : String(e)}` };
      }
    },
  };
}
