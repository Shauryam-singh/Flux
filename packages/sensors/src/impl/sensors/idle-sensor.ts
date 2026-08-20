import type {
  ObservationPriority,
  ObservationSource,
} from "@ai-agent/attention";
import type { SensorEvent, SensorMetadata } from "../../types/sensor.js";
import { BaseSensor } from "../base-sensor.js";

export interface IdleState {
  readonly isIdle: boolean;
  readonly idleSeconds: number;
  readonly lastActivity: number;
  readonly activeWindow: string | null;
  readonly keyboardActivity: boolean;
  readonly mouseActivity: boolean;
}

const METADATA: SensorMetadata = {
  id: "idle",
  name: "Idle Sensor",
  description: "Detects user inactivity via Win32 API / X11/screensaver APIs",
  category: "hardware",
  platform: "all",
  version: "1.1.0",
};

export class IdleSensor extends BaseSensor<IdleState> {
  private lastActivity = Date.now();
  private lastIdleSeconds = 0;
  private readonly idleThresholdMs: number;

  constructor(idleThresholdSeconds = 60, pollIntervalMs = 15000) {
    super(METADATA, pollIntervalMs);
    this.idleThresholdMs = idleThresholdSeconds * 1000;
  }

  protected async onStart(): Promise<void> {
    this.lastActivity = Date.now();
  }

  protected async onStop(): Promise<void> {
    // No cleanup needed
  }

  protected async onSnapshot(): Promise<IdleState | null> {
    const idleSeconds = await this.getIdleSeconds();
    const activeWindow = this.getActiveWindow();

    return {
      isIdle: idleSeconds * 1000 > this.idleThresholdMs,
      idleSeconds,
      lastActivity: this.lastActivity,
      activeWindow: activeWindow || null,
      keyboardActivity: idleSeconds < 5,
      mouseActivity: idleSeconds < 5,
    };
  }

  protected async onRefresh(): Promise<IdleState | null> {
    const idleSeconds = await this.getIdleSeconds();
    const activeWindow = this.getActiveWindow();

    const state: IdleState = {
      isIdle: idleSeconds * 1000 > this.idleThresholdMs,
      idleSeconds,
      lastActivity: this.lastActivity,
      activeWindow: activeWindow || null,
      keyboardActivity: idleSeconds < 5,
      mouseActivity: idleSeconds < 5,
    };

    // Detect activity change
    const wasIdle = this.lastIdleSeconds * 1000 > this.idleThresholdMs;
    if (wasIdle && !state.isIdle) {
      // User came back
      this.lastActivity = Date.now();
      this.emit({
        sensorId: this.metadata.id,
        timestamp: Date.now(),
        type: "user_returned",
        data: state,
        priority: "medium",
        source: "system",
      });
    } else if (!wasIdle && state.isIdle) {
      // User went idle
      this.emit({
        sensorId: this.metadata.id,
        timestamp: Date.now(),
        type: "user_idle",
        data: state,
        priority: "low",
        source: "system",
      });
    }

    this.lastIdleSeconds = idleSeconds;
    return state;
  }

  protected getEventSource(): ObservationSource {
    return "system";
  }

  protected getEventPriority(data: IdleState): ObservationPriority {
    if (data.isIdle && data.idleSeconds > 300) return "high"; // Idle > 5 min
    if (data.isIdle) return "medium";
    return "background";
  }

  private async getIdleSeconds(): Promise<number> {
    // Windows: call user32.dll GetLastInputInfo via PowerShell
    if (process.platform === "win32") {
      const ps = `$code = @'
using System;
using System.Runtime.InteropServices;
public class IdleTime {
  [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
  [StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO { public int cbSize; public int dwTime; }
}
'@; Add-Type -TypeDefinition $code -Language CSharp; $lii = New-Object IdleTime+LASTINPUTINFO; $lii.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($lii); [IdleTime]::GetLastInputInfo([ref]$lii) | Out-Null; $ticks = [System.Environment]::TickCount - $lii.dwTime; [math]::Max(0, [math]::Floor($ticks / 1000))`;
      const output = this.execCommand(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`);
      if (output) {
        const parsed = parseInt(output.trim(), 10);
        if (!isNaN(parsed) && parsed >= 0) return parsed;
      }
      return 0;
    }

    // Try Hyprland first (Wayland)
    const hyprIdle = this.execCommand("hyprctl activewindow -j 2>/dev/null");
    if (hyprIdle) {
      try {
        const data = JSON.parse(hyprIdle) as {
          focusHistoryID?: number;
          address?: string;
        };
        // On Hyprland, we can approximate idle from focus history
        // If there's a focused window, user is likely active
        if (data.address && data.address !== "0x0") {
          return 0; // Has focused window = active
        }
      } catch {
        // parse error, continue
      }
    }

    // Try xprintidle on X11
    const output = this.execCommand("xprintidle 2>/dev/null");
    if (output) {
      // xprintidle returns milliseconds
      return parseInt(output, 10) / 1000;
    }

    // Fallback: use xssstat or screensaver query
    const screensaver = this.execCommand(
      "xssstate -i 2>/dev/null || xdpyinfo | grep -i 'screen saver' 2>/dev/null",
    );
    if (screensaver) {
      const match = screensaver.match(/(\d+)/);
      if (match) return parseInt(match[1]!, 10);
    }

    return 0;
  }

  private getActiveWindow(): string | null {
    // Windows: use PowerShell GetForegroundWindow
    if (process.platform === "win32") {
      const output = this.execCommand(
        `powershell -NoProfile -Command "Add-Type @' using System; using System.Runtime.InteropServices; public class Win { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count); }'@; $hwnd = [Win]::GetForegroundWindow(); $sb = New-Object System.Text.StringBuilder 256; [Win]::GetWindowText($hwnd, $sb, 256) | Out-Null; $sb.ToString()"`,
      );
      if (output?.trim()) return output.trim();
    }

    // Try Hyprland first (Wayland)
    const hyprOutput = this.execCommand("hyprctl activewindow -j 2>/dev/null");
    if (hyprOutput) {
      try {
        const data = JSON.parse(hyprOutput) as {
          class?: string;
          title?: string;
        };
        if (data.class) {
          return data.title ? `${data.class} - ${data.title}` : data.class;
        }
      } catch {
        // parse error, continue
      }
    }

    // Fallback to xdotool for X11
    return this.execCommand(
      "xdotool getactivewindow getwindowname 2>/dev/null",
    );
  }
}
