import { BaseSensor } from "../base-sensor.js";
import type { SensorMetadata, SensorEvent } from "../../types/sensor.js";
import type { ObservationSource, ObservationPriority } from "@ai-agent/attention";

export interface NotificationEvent {
  readonly app: string;
  readonly summary: string;
  readonly body: string;
  readonly urgency: "low" | "normal" | "critical";
  readonly timestamp: number;
  readonly id: number;
}

export interface NotificationState {
  readonly recentNotifications: ReadonlyArray<NotificationEvent>;
  readonly totalCount: number;
  readonly lastNotification: NotificationEvent | null;
}

const METADATA: SensorMetadata = {
  id: "notifications",
  name: "Notification Sensor",
  description: "Monitors desktop notifications via D-Bus/org.freedesktop.Notifications",
  category: "linux",
  platform: "linux",
  version: "1.0.0",
};

export class NotificationSensor extends BaseSensor<NotificationState> {
  private notifications: NotificationEvent[] = [];
  private totalCount = 0;
  private lastId = 0;
  private monitorProcess: ReturnType<typeof import("node:child_process").exec> | null = null;

  constructor(pollIntervalMs = 1000) {
    super(METADATA, pollIntervalMs);
  }

  protected async onStart(): Promise<void> {
    // Start monitoring D-Bus notifications using dbus-monitor
    this.startDBusMonitor();
  }

  protected async onStop(): Promise<void> {
    if (this.monitorProcess) {
      this.monitorProcess.kill();
      this.monitorProcess = null;
    }
  }

  protected async onSnapshot(): Promise<NotificationState> {
    return {
      recentNotifications: [...this.notifications],
      totalCount: this.totalCount,
      lastNotification: this.notifications[this.notifications.length - 1] ?? null,
    };
  }

  protected async onRefresh(): Promise<NotificationState | null> {
    return this.onSnapshot();
  }

  protected getEventSource(): ObservationSource {
    return "system";
  }

  protected getEventPriority(data: NotificationState): ObservationPriority {
    const last = data.lastNotification;
    if (!last) return "ignore";
    if (last.urgency === "critical") return "critical";
    if (last.urgency === "normal") return "medium";
    return "low";
  }

  private startDBusMonitor(): void {
    try {
      const { exec } = require("node:child_process") as typeof import("node:child_process");
      const proc = exec(
        "dbus-monitor --session type='method_call',interface='org.freedesktop.Notifications',member='Notify' 2>/dev/null",
        { encoding: "utf-8" },
      );

      let buffer = "";
      proc.stdout?.on("data", (chunk: string) => {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          this.parseDBusLine(line.trim());
        }
      });

      this.monitorProcess = proc;
    } catch {
      // D-Bus not available
    }
  }

  private parseDBusLine(line: string): void {
    // Parse D-Bus notification format
    // This is a simplified parser - real D-Bus monitoring is more complex
    const appMatch = line.match(/string\s+"(.+?)"/);
    if (appMatch && appMatch[1]) {
      // We got an app name, look for summary and body in subsequent lines
      const app = appMatch[1];
      // For now, create a notification with what we have
      if (app && !app.startsWith("org.")) {
        this.addNotification(app, "Notification", "", "normal");
      }
    }
  }

  private addNotification(
    app: string,
    summary: string,
    body: string,
    urgency: NotificationEvent["urgency"],
  ): void {
    const notification: NotificationEvent = {
      app,
      summary,
      body,
      urgency,
      timestamp: Date.now(),
      id: ++this.lastId,
    };

    this.notifications.push(notification);
    if (this.notifications.length > 50) {
      this.notifications = this.notifications.slice(-50);
    }
    this.totalCount++;

    this.emit({
      sensorId: this.metadata.id,
      timestamp: Date.now(),
      type: "notification",
      data: {
        recentNotifications: [...this.notifications],
        totalCount: this.totalCount,
        lastNotification: notification,
      },
      priority: this.getEventPriority({
        recentNotifications: [notification],
        totalCount: this.totalCount,
        lastNotification: notification,
      }),
      source: "system",
    });
  }
}
