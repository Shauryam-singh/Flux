import { BaseSensor } from "../base-sensor.js";
import type { SensorMetadata, SensorEvent } from "../../types/sensor.js";
import type { ObservationSource, ObservationPriority } from "@ai-agent/attention";

export interface BatteryState {
  readonly level: number; // 0-100
  readonly isCharging: boolean;
  readonly timeToEmpty: number | null; // minutes
  readonly timeToFull: number | null; // minutes
  readonly status: "charging" | "discharging" | "full" | "empty" | "unknown";
}

const METADATA: SensorMetadata = {
  id: "battery",
  name: "Battery Sensor",
  description: "Monitors battery level and charging state",
  category: "hardware",
  platform: "all",
  version: "1.0.0",
};

export class BatterySensor extends BaseSensor<BatteryState> {
  constructor(pollIntervalMs = 30000) {
    super(METADATA, pollIntervalMs);
  }

  protected async onStart(): Promise<void> {
    // No initialization needed
  }

  protected async onStop(): Promise<void> {
    // No cleanup needed
  }

  protected async onSnapshot(): Promise<BatteryState | null> {
    return this.readBattery();
  }

  protected async onRefresh(): Promise<BatteryState | null> {
    return this.readBattery();
  }

  protected getEventSource(): ObservationSource {
    return "system";
  }

  protected getEventPriority(data: BatteryState): ObservationPriority {
    if (data.level < 5) return "critical";
    if (data.level < 15) return "high";
    if (data.level < 30) return "medium";
    return "background";
  }

  private async readBattery(): Promise<BatteryState | null> {
    const platform = process.platform;

    if (platform === "linux") {
      return this.readLinuxBattery();
    }
    if (platform === "darwin") {
      return this.readMacBattery();
    }
    if (platform === "win32") {
      return this.readWindowsBattery();
    }
    return null;
  }

  private async readLinuxBattery(): Promise<BatteryState | null> {
    const capacity = this.execCommand("cat /sys/class/power_supply/BAT*/capacity 2>/dev/null");
    const status = this.execCommand("cat /sys/class/power_supply/BAT*/status 2>/dev/null");

    if (capacity === null) return null;

    const level = parseInt(capacity, 10);
    const isCharging = status?.toLowerCase() === "charging";
    const batteryStatus: BatteryState["status"] = isCharging
      ? "charging"
      : status?.toLowerCase() === "full"
        ? "full"
        : "discharging";

    return {
      level: isNaN(level) ? 0 : level,
      isCharging,
      timeToEmpty: null,
      timeToFull: null,
      status: batteryStatus,
    };
  }

  private async readMacBattery(): Promise<BatteryState | null> {
    const output = this.execCommand(
      "pmset -g batt 2>/dev/null | head -2",
    );
    if (!output) return null;

    const levelMatch = output.match(/(\d+)%/);
    const level = levelMatch ? parseInt(levelMatch[1]!, 10) : 0;
    const isCharging = output.includes("charging") || output.includes("AC attached");

    return {
      level,
      isCharging,
      timeToEmpty: null,
      timeToFull: null,
      status: isCharging ? "charging" : "discharging",
    };
  }

  private async readWindowsBattery(): Promise<BatteryState | null> {
    const output = this.execCommand(
      'powershell -command "Get-WmiObject Win32_Battery | Select-Object EstimatedChargeRemaining, BatteryStatus"',
    );
    if (!output) return null;

    const lines = output.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return null;

    const level = parseInt(lines[1]?.trim() ?? "0", 10);
    const status = parseInt(lines[2]?.trim() ?? "0", 10);

    return {
      level: isNaN(level) ? 0 : level,
      isCharging: status === 2 || status === 6 || status === 7 || status === 8,
      timeToEmpty: null,
      timeToFull: null,
      status: status === 2 ? "charging" : "discharging",
    };
  }
}
