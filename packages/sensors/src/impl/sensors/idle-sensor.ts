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
  description: "Detects user inactivity via X11/screensaver APIs",
  category: "linux",
  platform: "linux",
  version: "1.0.0",
};

export class IdleSensor extends BaseSensor<IdleState> {
  private lastActivity = Date.now();
  private lastIdleSeconds = 0;
  private readonly idleThresholdMs: number;

  constructor(idleThresholdSeconds = 60, pollIntervalMs = 5000) {
    super(METADATA, pollIntervalMs);
    this.idleThresholdMs = idleThresholdSeconds * 1000;
  }

  protected async onStart(): Promise<void> {
    this.lastActivity = Date.now();
  }

  protected async onStop(): Promise<void> {
    // No cleanup needed
  }

  protected async onSnapshot(): Promise<IdleState> {
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
