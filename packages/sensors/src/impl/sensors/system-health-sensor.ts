import type {
  ObservationPriority,
  ObservationSource,
} from "@ai-agent/attention";
import type { SensorMetadata } from "../../types/sensor.js";
import { BaseSensor } from "../base-sensor.js";
import { runPowerShell } from "../powershell.js";

export interface SystemHealthState {
  readonly cpuUsagePercent: number;
  readonly memoryUsagePercent: number;
  readonly memoryUsedMB: number;
  readonly memoryTotalMB: number;
  readonly diskUsagePercent: number;
  readonly diskUsedGB: number;
  readonly diskTotalGB: number;
  readonly loadAverage: ReadonlyArray<number>;
  readonly networkOnline: boolean;
  readonly uptimeSeconds: number;
  readonly processCount: number;
  readonly topCpuProcesses: ReadonlyArray<{
    readonly name: string;
    readonly cpuPercent: number;
    readonly memoryMB: number;
  }>;
}

const METADATA: SensorMetadata = {
  id: "system-health",
  name: "System Health Sensor",
  description:
    "Monitors CPU, memory, disk, network, and process health on Windows 11 and Linux (CachyOS)",
  category: "hardware",
  platform: "all",
  version: "1.0.0",
};

export class SystemHealthSensor extends BaseSensor<SystemHealthState> {
  private lastState: SystemHealthState | null = null;
  private lastCollectAt = 0;
  private readonly isWindows: boolean;
  private readonly cacheWindowMs = 2000;

  // CPU delta tracking (avoids the 500ms sleep between /proc/stat samples)
  private prevCpuSample: { idle: number; total: number; at: number } | null = null;

  constructor(pollIntervalMs = 30000) {
    super(METADATA, pollIntervalMs);
    this.isWindows = process.platform === "win32";
  }

  protected async onStart(): Promise<void> {
    this.lastState = await this.collectSystemHealth();
  }

  protected async onStop(): Promise<void> {
    this.lastState = null;
    this.prevCpuSample = null;
  }

  protected async onSnapshot(): Promise<SystemHealthState | null> {
    // Serve cached state within a short window so rapid snapshot() calls
    // (chat context gathering, background ticks) don't each spawn a 3s
    // PowerShell process.
    if (
      this.lastState &&
      Date.now() - this.lastCollectAt < this.cacheWindowMs
    ) {
      return this.lastState;
    }
    const state = await this.collectSystemHealth();
    if (state) {
      this.lastState = state;
      this.lastCollectAt = Date.now();
    }
    return state;
  }

  protected async onRefresh(): Promise<SystemHealthState | null> {
    const newState = await this.collectSystemHealth();
    if (newState && this.lastState) {
      this.detectChanges(this.lastState, newState);
    }
    this.lastState = newState;
    this.lastCollectAt = Date.now();
    return newState;
  }

  protected getEventSource(): ObservationSource {
    return "system";
  }

  protected getEventPriority(data: SystemHealthState): ObservationPriority {
    if (data.cpuUsagePercent > 90 || data.memoryUsagePercent > 90) return "high";
    if (data.cpuUsagePercent > 70 || data.memoryUsagePercent > 70) return "medium";
    if (!data.networkOnline) return "high";
    return "background";
  }

  private async collectSystemHealth(): Promise<SystemHealthState> {
    if (this.isWindows) {
      return this.collectWindowsHealth();
    }
    return this.collectLinuxHealth();
  }

  private async collectWindowsHealth(): Promise<SystemHealthState> {
    // Single PowerShell invocation for all system metrics (avoids spawning
    // powershell.exe multiple times, which is slow on Windows).
    const raw = runPowerShell(
      [
        "$ErrorActionPreference='SilentlyContinue'",
        "$cpu=(Get-CimInstance Win32_Processor).LoadPercentage",
        "$os=Get-CimInstance Win32_OperatingSystem",
        "$memPct=[math]::Round(($os.TotalVisibleMemorySize-$os.FreePhysicalMemory)/$os.TotalVisibleMemorySize*100,1)",
        "$memUsed=[math]::Round(($os.TotalVisibleMemorySize-$os.FreePhysicalMemory)/1024)",
        "$memTotal=[math]::Round($os.TotalVisibleMemorySize/1024)",
        "$boot=[datetime]$os.LastBootUpTime",
        "$procs=@(Get-Process)",
        "$procCount=$procs.Count",
        '$disks=@(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3")',
        "$diskTotalSize=($disks | Measure-Object Size -Sum).Sum",
        "$diskFreeSize=($disks | Measure-Object FreeSpace -Sum).Sum",
        "$diskUsedSize=$diskTotalSize-$diskFreeSize",
        "$diskPct=[math]::Round($diskUsedSize/$diskTotalSize*100,1)",
        "$diskUsed=[math]::Round($diskUsedSize/1GB,1)",
        "$diskTotal=[math]::Round($diskTotalSize/1GB,1)",
        'Write-Output "$cpu|$memPct|$memUsed|$memTotal|$diskPct|$diskUsed|$diskTotal|$procCount|$boot"',
        "$procs | Sort-Object CPU -Descending | Select-Object -First 5 Name, @{N='CPU';E={$_.CPU}}, @{N='MemMB';E={[math]::Round($_.WorkingSet64/1MB)}} | ForEach-Object { $_.Name + '|' + [math]::Round($_.CPU,1) + '|' + $_.MemMB }",
      ].join("; "),
      10000,
    );

    const lines = raw?.split("\n") ?? [];
    const parts = (lines[0] ?? "").split("|");
    const cpuUsagePercent = parseInt(parts[0] ?? "0", 10) || 0;
    const memoryUsagePercent = parseFloat(parts[1] ?? "0") || 0;
    const memoryUsedMB = parseInt(parts[2] ?? "0", 10) || 0;
    const memoryTotalMB = parseInt(parts[3] ?? "0", 10) || 0;
    const diskUsagePercent = parseFloat(parts[4] ?? "0") || 0;
    const diskUsedGB = parseFloat(parts[5] ?? "0") || 0;
    const diskTotalGB = parseFloat(parts[6] ?? "0") || 0;
    const processCount = parseInt(parts[7] ?? "0", 10) || 0;

    let uptimeSeconds = 0;
    const boot = parts[8];
    if (boot) {
      const bootTime = new Date(boot).getTime();
      uptimeSeconds = Math.max(0, Math.floor((Date.now() - bootTime) / 1000));
    }

    const topCpuProcesses = lines
      .slice(1)
      .filter(Boolean)
      .map((line) => {
        const [name, cpu, mem] = line.split("|");
        return {
          name: name?.trim() ?? "",
          cpuPercent: parseFloat(cpu ?? "0") || 0,
          memoryMB: parseInt(mem ?? "0", 10) || 0,
        };
      });

    // Network — fast native ping (1 request, short timeout). Cached by the
    // snapshot cache window so it only runs occasionally.
    // On Windows, use powershell Test-Connection which is more reliable.
    const isWin = process.platform === "win32";
    const networkOnline = isWin
      ? this.execCommand('powershell -NoProfile -Command "(Test-Connection -ComputerName 8.8.8.8 -Count 1 -Quiet)"', 3000) === "True"
      : this.execCommand("ping -c 1 -W 1 8.8.8.8 >/dev/null 2>&1 && echo true || echo false", 3000) === "true";

    return {
      cpuUsagePercent,
      memoryUsagePercent,
      memoryUsedMB,
      memoryTotalMB,
      diskUsagePercent,
      diskUsedGB,
      diskTotalGB,
      loadAverage: [0, 0, 0],
      networkOnline,
      uptimeSeconds,
      processCount,
      topCpuProcesses,
    };
  }

  private async collectLinuxHealth(): Promise<SystemHealthState> {
    // CPU usage from /proc/stat
    const cpuUsagePercent = await this.getCpuUsageLinux();

    // Memory from /proc/meminfo
    const memRaw = this.execCommand(
      "awk '/^MemTotal:/{t=$2} /^MemAvailable:/{a=$2} /^MemUsed:/{u=$2} END{if(u)print u; else print t-a; print t}' /proc/meminfo",
      2000,
    );
    const memLines = memRaw?.split("\n") ?? [];
    const memoryUsedKB = parseInt(memLines[0] ?? "0", 10) || 0;
    const memoryTotalKB = parseInt(memLines[1] ?? "0", 10) || 1;
    const memoryUsedMB = Math.round(memoryUsedKB / 1024);
    const memoryTotalMB = Math.round(memoryTotalKB / 1024);
    const memoryUsagePercent = Math.round((memoryUsedKB / memoryTotalKB) * 100);

    // Disk usage
    const diskRaw = this.execCommand(
      "df -BM / | awk 'NR==2{gsub(/%/,\"\",$5); print $5, $3, $2}'",
      2000,
    );
    const diskParts = diskRaw?.split(/\s+/) ?? [];
    const diskUsagePercent = parseInt(diskParts[0] ?? "0", 10) || 0;
    const diskUsedGB = parseInt(diskParts[1] ?? "0", 10) / 1024 || 0;
    const diskTotalGB = parseInt(diskParts[2] ?? "0", 10) / 1024 || 1;

    // Load average
    const loadRaw = this.execCommand("cat /proc/loadavg 2>/dev/null", 1000);
    const loadParts = loadRaw?.split(/\s+/) ?? [];
    const loadAverage: number[] = [
      parseFloat(loadParts[0] ?? "0") || 0,
      parseFloat(loadParts[1] ?? "0") || 0,
      parseFloat(loadParts[2] ?? "0") || 0,
    ];

    // Network
    const networkOnline =
      this.execCommand(
        "ping -c1 -W1 8.8.8.8 >/dev/null 2>&1 && echo true || echo false",
        2000,
      ) === "true";

    // Uptime
    const uptimeRaw = this.execCommand("cat /proc/uptime 2>/dev/null", 1000);
    const uptimeSeconds = parseFloat(uptimeRaw?.split(/\s+/)[0] ?? "0") || 0;

    // Process count
    const processCount =
      parseInt(this.execCommand("ls /proc | grep -c '^[0-9]'") ?? "0", 10) || 0;

    // Top CPU processes
    const topProcs = this.execCommand(
      "ps aux --sort=-%cpu | head -6 | tail -5 | awk '{print $11, $3, $4}'",
      2000,
    );
    const topCpuProcesses = topProcs
      ? topProcs
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const parts = line.split(/\s+/);
            return {
              name: parts[0]?.split("/").pop() ?? "",
              cpuPercent: parseFloat(parts[1] ?? "0") || 0,
              memoryMB: Math.round(
                (parseFloat(parts[2] ?? "0") / 100) * memoryTotalMB,
              ),
            };
          })
      : [];

    return {
      cpuUsagePercent,
      memoryUsagePercent,
      memoryUsedMB,
      memoryTotalMB,
      diskUsagePercent,
      diskUsedGB,
      diskTotalGB,
      loadAverage,
      networkOnline,
      uptimeSeconds,
      processCount,
      topCpuProcesses,
    };
  }

  private async getCpuUsageLinux(): Promise<number> {
    // Read /proc/stat and compute CPU usage from the delta against the
    // previous sample (no 500ms sleep needed).
    const readCpu = (): { idle: number; total: number } | null => {
      const raw = this.execCommand("head -1 /proc/stat", 1000);
      if (!raw) return null;
      const parts = raw.split(/\s+/);
      const values = parts.slice(1).map(Number);
      const idle = (values[3] ?? 0) + (values[4] ?? 0); // idle + iowait
      const total = values.reduce((a, b) => a + b, 0);
      return { idle, total };
    };

    const sample = readCpu();
    if (!sample) return 0;

    const prev = this.prevCpuSample;
    this.prevCpuSample = { ...sample, at: Date.now() };

    if (!prev) return 0;

    const idleDiff = sample.idle - prev.idle;
    const totalDiff = sample.total - prev.total;
    if (totalDiff <= 0) return 0;

    // Sample interval is usually ~10s (poll interval) or shorter; no sleep needed.
    return Math.min(100, Math.round(((totalDiff - idleDiff) / totalDiff) * 100));
  }

  private detectChanges(
    oldState: SystemHealthState,
    newState: SystemHealthState,
  ): void {
    // CPU spike
    if (oldState.cpuUsagePercent < 70 && newState.cpuUsagePercent >= 70) {
      this.emit({
        sensorId: this.metadata.id,
        timestamp: Date.now(),
        type: "cpu_high",
        data: newState,
        priority: newState.cpuUsagePercent > 90 ? "high" : "medium",
        source: "system",
      });
    }

    // Memory pressure
    if (
      oldState.memoryUsagePercent < 80 &&
      newState.memoryUsagePercent >= 80
    ) {
      this.emit({
        sensorId: this.metadata.id,
        timestamp: Date.now(),
        type: "memory_high",
        data: newState,
        priority: newState.memoryUsagePercent > 90 ? "high" : "medium",
        source: "system",
      });
    }

    // Disk space warning
    if (oldState.diskUsagePercent < 90 && newState.diskUsagePercent >= 90) {
      this.emit({
        sensorId: this.metadata.id,
        timestamp: Date.now(),
        type: "disk_high",
        data: newState,
        priority: "high",
        source: "system",
      });
    }

    // Network change
    if (oldState.networkOnline !== newState.networkOnline) {
      this.emit({
        sensorId: this.metadata.id,
        timestamp: Date.now(),
        type: newState.networkOnline ? "network_online" : "network_offline",
        data: newState,
        priority: newState.networkOnline ? "low" : "high",
        source: "system",
      });
    }
  }
}
