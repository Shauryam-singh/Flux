import type {
  ObservationPriority,
  ObservationSource,
} from "@ai-agent/attention";

// ─── Sensor Identity ──────────────────────────────────────────────

export type SensorCategory =
  | "filesystem" // File system changes (inotify/fsevents)
  | "git" // Git state changes
  | "linux" // Linux desktop (D-Bus, systemd, clipboard, etc.)
  | "process" // Process monitoring (Docker, SSH, K8s)
  | "service" // External services (Spotify, Discord, Slack)
  | "browser" // Browser integration (Chrome DevTools)
  | "vscode" // VS Code extension
  | "calendar" // Calendar events
  | "email" // Email notifications
  | "hardware"; // Hardware sensors (battery, audio, webcam)

export type SensorId = string;

export interface SensorMetadata {
  readonly id: SensorId;
  readonly name: string;
  readonly description: string;
  readonly category: SensorCategory;
  readonly platform: "linux" | "darwin" | "win32" | "all";
  readonly version: string;
}

// ─── Sensor State ─────────────────────────────────────────────────

export type SensorStatus =
  | "idle" // Not monitoring
  | "starting" // Initializing
  | "running" // Actively monitoring
  | "error" // Error state
  | "unavailable"; // Not available on this platform

export interface SensorState {
  readonly status: SensorStatus;
  readonly lastUpdate: number;
  readonly errorCount: number;
  readonly lastError: string | null;
  readonly eventsTotal: number;
}

// ─── Sensor Event ─────────────────────────────────────────────────

export interface SensorEvent<T = unknown> {
  readonly sensorId: SensorId;
  readonly timestamp: number;
  readonly type: string;
  readonly data: T;
  readonly priority: ObservationPriority;
  readonly source: ObservationSource;
}

// ─── Sensor Interface ─────────────────────────────────────────────

export interface Sensor<TData = unknown> {
  readonly metadata: SensorMetadata;

  /** Check if this sensor is available on the current platform */
  isAvailable(): boolean;

  /** Start monitoring */
  start(): Promise<void>;

  /** Stop monitoring */
  stop(): Promise<void>;

  /** Get current sensor state */
  getState(): SensorState;

  /** Get latest data snapshot */
  snapshot(): Promise<TData | null>;

  /** Subscribe to events */
  onChange(handler: (event: SensorEvent<TData>) => void): () => void;

  /** Force a refresh/poll */
  refresh(): Promise<void>;
}

// ─── Sensor Config ────────────────────────────────────────────────

export interface SensorConfig {
  readonly enabled: boolean;
  readonly pollIntervalMs?: number;
  readonly debounceMs?: number;
  readonly maxEventsPerSecond?: number;
}

// ─── Sensor Manager ───────────────────────────────────────────────

export interface SensorManager {
  /** Register a sensor */
  register<T>(sensor: Sensor<T>): void;

  /** Get a sensor by ID */
  get<T>(id: SensorId): Sensor<T> | null;

  /** Start all sensors */
  startAll(): Promise<void>;

  /** Stop all sensors */
  stopAll(): Promise<void>;

  /** Start a specific sensor */
  startSensor(id: SensorId): Promise<void>;

  /** Stop a specific sensor */
  stopSensor(id: SensorId): Promise<void>;

  /** Get all registered sensors */
  getAll(): ReadonlyArray<Sensor<unknown>>;

  /** Get sensors by category */
  getByCategory(category: SensorCategory): ReadonlyArray<Sensor<unknown>>;

  /** Get manager state */
  getState(): SensorManagerState;

  /** Subscribe to all events from all sensors */
  onEvent(handler: (event: SensorEvent<unknown>) => void): () => void;
}

export interface SensorManagerState {
  readonly totalSensors: number;
  readonly runningSensors: number;
  readonly errorSensors: number;
  readonly totalEvents: number;
  readonly uptime: number;
}
