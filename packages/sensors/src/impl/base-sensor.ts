import type {
  Sensor,
  SensorMetadata,
  SensorState,
  SensorEvent,
  SensorStatus,
} from "../types/sensor.js";
import type { ObservationSource, ObservationPriority } from "@ai-agent/attention";

export abstract class BaseSensor<TData = unknown> implements Sensor<TData> {
  readonly metadata: SensorMetadata;

  private state: SensorState = {
    status: "idle",
    lastUpdate: 0,
    errorCount: 0,
    lastError: null,
    eventsTotal: 0,
  };

  private handlers: Array<(event: SensorEvent<TData>) => void> = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private readonly pollIntervalMs: number;

  constructor(metadata: SensorMetadata, pollIntervalMs = 5000) {
    this.metadata = metadata;
    this.pollIntervalMs = pollIntervalMs;
  }

  isAvailable(): boolean {
    if (this.metadata.platform === "all") return true;
    return this.metadata.platform === process.platform;
  }

  async start(): Promise<void> {
    if (!this.isAvailable()) {
      this.updateState("unavailable");
      return;
    }

    this.updateState("starting");
    try {
      await this.onStart();
      this.updateState("running");

      // Start polling if interval is set
      if (this.pollIntervalMs > 0) {
        this.pollTimer = setInterval(() => {
          void this.refresh();
        }, this.pollIntervalMs);
      }
    } catch (e) {
      this.updateState("error", e instanceof Error ? e.message : "Unknown error");
    }
  }

  async stop(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    await this.onStop();
    this.updateState("idle");
  }

  getState(): SensorState {
    return { ...this.state };
  }

  async snapshot(): Promise<TData | null> {
    try {
      return await this.onSnapshot();
    } catch {
      return null;
    }
  }

  onChange(handler: (event: SensorEvent<TData>) => void): () => void {
    this.handlers.push(handler);
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx >= 0) this.handlers.splice(idx, 1);
    };
  }

  async refresh(): Promise<void> {
    try {
      const data = await this.onRefresh();
      if (data !== null) {
        this.emit({
          sensorId: this.metadata.id,
          timestamp: Date.now(),
          type: "refresh",
          data,
          priority: this.getEventPriority(data),
          source: this.getEventSource(),
        });
      }
    } catch (e) {
      this.state = {
        ...this.state,
        errorCount: this.state.errorCount + 1,
        lastError: e instanceof Error ? e.message : "Unknown error",
      };
    }
  }

  // ─── Protected methods for subclasses ─────────────────────────

  protected emit(event: SensorEvent<TData>): void {
    this.state = {
      ...this.state,
      lastUpdate: Date.now(),
      eventsTotal: this.state.eventsTotal + 1,
    };

    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch {
        // Handler errors are non-fatal
      }
    }
  }

  protected updateState(status: SensorStatus, error?: string): void {
    this.state = {
      ...this.state,
      status,
      lastError: error ?? (status === "error" ? this.state.lastError : null),
      errorCount: status === "error" ? this.state.errorCount + 1 : this.state.errorCount,
    };
  }

  protected execCommand(cmd: string, timeout = 5000): string | null {
    try {
      const { execSync } = require("node:child_process") as typeof import("node:child_process");
      return execSync(cmd, { encoding: "utf-8", timeout }).trim();
    } catch {
      return null;
    }
  }

  // ─── Abstract methods for subclasses ──────────────────────────

  protected abstract onStart(): Promise<void>;
  protected abstract onStop(): Promise<void>;
  protected abstract onSnapshot(): Promise<TData | null>;
  protected abstract onRefresh(): Promise<TData | null>;
  protected abstract getEventSource(): ObservationSource;
  protected abstract getEventPriority(data: TData): ObservationPriority;
}
