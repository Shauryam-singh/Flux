import type {
  ObservationPriority,
  ObservationSource,
} from "@ai-agent/attention";
import type { SensorEvent, SensorMetadata } from "../../types/sensor.js";
import { BaseSensor } from "../base-sensor.js";

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
  private readonly isWindows: boolean;

  constructor(pollIntervalMs = 10000) {
    super(METADATA, pollIntervalMs);
    this.isWindows = process.platform === "win32";
  }

  protected async onStart(): Promise<void> {
    this.lastState = await this.collectSystemHealth();
  }

  protected async onStop(): Promise<void> {
    this.lastState = null;
  }

  protected async onSnapshot(): Promise<SystemHealthState | null> {
    return this.collectSystemHealth();
  }

  protected async onRefresh(): Promise<SystemHealthState | null> {
    const newState = await this.collectSystemHealth();
    if (newState && this.lastState) {
      this.detectChanges(this.lastState, newState);
    }
    this.lastState = newState;
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
    // CPU usage via PowerShell
    const cpuRaw = this.execCommand(
      `pwsh -NoProfile -Command "(Get-CimInstance Win32_Processor).LoadPercentage" 2>nul`,
      5000,
    );
    const cpuUsagePercent = cpuRaw ? parseInt(cpuRaw, 10) || 0 : 0;

    // Memory via PowerShell
    const memRaw = this.execCommand(
      `pwsh -NoProfile -Command "$os=Get-CimInstance Win32_OperatingSystem; [math]::Round(($os.TotalVisibleMemorySize-$os.FreePhysicalMemory)/$os.TotalVisibleMemorySize*100,1); [math]::Round(($os.TotalVisibleMemorySize-$os.FreePhysicalMemory)/1024); [math]::Round($os.TotalVisibleMemorySize/1024)"`,
      5000,
    );
    const memParts = memRaw?.split(/\s+/) ?? [];
    const memoryUsagePercent = parseFloat(memParts[0] ?? "0") || 0;
    const memoryUsedMB = parseInt(memParts[1] ?? "0", 10) || 0;
    const memoryTotalMB = parseInt(memParts[2] ?? "0", 10) || 0;

    // Disk via PowerShell
    const diskRaw = this.execCommand(
      `pwsh -NoProfile -Command "$d=Get-CimInstance Win32_LogicalDisk -Filter \\"DriveType=3\\"; [math]::Round(($d.Size-$d.FreeSpace)/$d.Size*100,1); [math]::Round(($d.Size-$d.FreeSpace)/1GB,1); [math]::Round($d.Size/1GB,1)"`,
      5000,
    );
    const diskParts = diskRaw?.split(/\s+/) ?? [];
    const diskUsagePercent = parseFloat(diskParts[0] ?? "0") || 0;
    const diskUsedGB = parseFloat(diskParts[1] ?? "0") || 0;
    const diskTotalGB = parseFloat(diskParts[2] ?? "0") || 0;

    // Uptime
    const uptimeRaw = this.execCommand(
      `pwsh -NoProfile -Command "(Get-CimInstance Win32_OS).LastBootUpTime"`,
      3000,
    );
    let uptimeSeconds = 0;
    if (uptimeRaw) {
      const bootTime = new Date(uptimeRaw).getTime();
      uptimeSeconds = Math.max(0, Math.floor((Date.now() - bootTime) / 1000));
    }

    // Process count
    const procCount = this.execCommand(
      `pwsh -NoProfile -Command "(Get-Process).Count"`,
      3000,
    );
    const processCount = procCount ? parseInt(procCount, 10) || 0 : 0;

    // Top CPU processes
    const topProcs = this.execCommand(
      `pwsh -NoProfile -Command "Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 Name, @{N='CPU';E={$_.CPU}}, @{N='MemMB';E={[math]::Round($_.WorkingSet64/1MB)}} | ForEach-Object { $_.Name + '|' + [math]::Round($_.CPU,1) + '|' + $_.MemMB }" 2>nul`,
      5000,
    );
    const topCpuProcesses = topProcs
      ? topProcs
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const [name, cpu, mem] = line.split("|");
            return {
              name: name?.trim() ?? "",
              cpuPercent: parseFloat(cpu ?? "0") || 0,
              memoryMB: parseInt(mem ?? "0", 10) || 0,
            };
          })
      : [];

    // Network — try ping
    const pingResult = this.execCommand(
      `pwsh -NoProfile -Command "Test-Connection -ComputerName 8.8.8.8 -Count 1 -Quiet"`,
      5000,
    );
    const networkOnline = pingResult?.toLowerCase().includes("true") ?? true;

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
        3000,
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
    // Read /proc/stat twice with a short delay to calculate CPU usage
    const readCpu = (): { idle: number; total: number } | null => {
      const raw = this.execCommand("head -1 /proc/stat", 1000);
      if (!raw) return null;
      const parts = raw.split(/\s+/);
      const values = parts.slice(1).map(Number);
      const idle = values[3] ?? 0;
      const total = values.reduce((a, b) => a + b, 0);
      return { idle, total };
    };

    const first = readCpu();
    if (!first) return 0;

    // Wait 500ms
    this.execCommand("sleep 0.5", 1000);

    const second = readCpu();
    if (!second) return 0;

    const idleDiff = second.idle - first.idle;
    const totalDiff = second.total - first.total;
    if (totalDiff === 0) return 0;

    return Math.round(((totalDiff - idleDiff) / totalDiff) * 100);
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
