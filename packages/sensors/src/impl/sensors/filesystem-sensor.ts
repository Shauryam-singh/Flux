import { BaseSensor } from "../base-sensor.js";
import type { SensorMetadata, SensorEvent } from "../../types/sensor.js";
import type { ObservationSource, ObservationPriority } from "@ai-agent/attention";
import * as fs from "node:fs";
import * as path from "node:path";

export interface FileChangeEvent {
  readonly type: "created" | "modified" | "deleted" | "renamed";
  readonly path: string;
  readonly filename: string;
  readonly directory: string;
  readonly isDirectory: boolean;
  readonly size: number | undefined;
}

export interface FileSystemState {
  readonly watchedPaths: ReadonlyArray<string>;
  readonly recentChanges: ReadonlyArray<FileChangeEvent>;
  readonly totalChanges: number;
  readonly watchCount: number;
}

const METADATA: SensorMetadata = {
  id: "filesystem",
  name: "File System Sensor",
  description: "Watches file system changes via fs.watch/inotify/fsevents",
  category: "filesystem",
  platform: "all",
  version: "1.0.0",
};

export class FileSystemSensor extends BaseSensor<FileSystemState> {
  private watchers: Map<string, fs.FSWatcher> = new Map();
  private recentChanges: FileChangeEvent[] = [];
  private totalChanges = 0;
  private readonly watchPaths: string[];
  private readonly maxRecentChanges: number;
  private readonly debounceMs: number;
  private pendingEvents: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(
    watchPaths: string[],
    options?: {
      pollIntervalMs?: number;
      maxRecentChanges?: number;
      debounceMs?: number;
    },
  ) {
    super(METADATA, options?.pollIntervalMs ?? 0); // Event-driven, no polling
    this.watchPaths = watchPaths;
    this.maxRecentChanges = options?.maxRecentChanges ?? 100;
    this.debounceMs = options?.debounceMs ?? 100;
  }

  protected async onStart(): Promise<void> {
    for (const watchPath of this.watchPaths) {
      this.watchDirectory(watchPath);
    }
  }

  protected async onStop(): Promise<void> {
    for (const [watchPath, watcher] of this.watchers) {
      watcher.close();
      this.watchers.delete(watchPath);
    }
    for (const timer of this.pendingEvents.values()) {
      clearTimeout(timer);
    }
    this.pendingEvents.clear();
  }

  protected async onSnapshot(): Promise<FileSystemState> {
    return {
      watchedPaths: [...this.watchers.keys()],
      recentChanges: [...this.recentChanges],
      totalChanges: this.totalChanges,
      watchCount: this.watchers.size,
    };
  }

  protected async onRefresh(): Promise<FileSystemState> {
    return this.onSnapshot();
  }

  protected getEventSource(): ObservationSource {
    return "file";
  }

  protected getEventPriority(data: FileSystemState): ObservationPriority {
    if (data.recentChanges.length === 0) return "ignore";
    const latest = data.recentChanges[data.recentChanges.length - 1];
    if (!latest) return "ignore";

    // Source files are more important than config files
    if (latest.path.endsWith(".ts") || latest.path.endsWith(".js") || latest.path.endsWith(".py")) {
      return "medium";
    }
    if (latest.path.includes("package.json") || latest.path.includes("tsconfig")) {
      return "medium";
    }
    return "low";
  }

  private watchDirectory(dirPath: string): void {
    if (this.watchers.has(dirPath)) return;

    try {
      const watcher = fs.watch(
        dirPath,
        { recursive: true },
        (eventType, filename) => {
          if (!filename) return;
          this.handleFileEvent(dirPath, eventType, filename);
        },
      );

      watcher.on("error", () => {
        this.watchers.delete(dirPath);
        this.updateState("error", `Watch failed for ${dirPath}`);
      });

      this.watchers.set(dirPath, watcher);
    } catch {
      // Directory might not exist
    }
  }

  private handleFileEvent(dirPath: string, eventType: string, filename: string): void {
    const fullPath = path.join(dirPath, filename);
    const key = `${eventType}:${fullPath}`;

    // Debounce rapid events
    const existing = this.pendingEvents.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    this.pendingEvents.set(
      key,
      setTimeout(() => {
        this.pendingEvents.delete(key);
        this.processFileEvent(dirPath, eventType, filename);
      }, this.debounceMs),
    );
  }

  private processFileEvent(dirPath: string, eventType: string, filename: string): void {
    const fullPath = path.join(dirPath, filename);
    let changeType: FileChangeEvent["type"] = "modified";

    if (eventType === "rename") {
      // Check if file exists to determine create vs delete
      try {
        fs.statSync(fullPath);
        changeType = "created";
      } catch {
        changeType = "deleted";
      }
    }

    let isDirectory = false;
    let size: number | undefined;
    try {
      const stat = fs.statSync(fullPath);
      isDirectory = stat.isDirectory();
      size = stat.size;
    } catch {
      // File might have been deleted
    }

    const event: FileChangeEvent = {
      type: changeType,
      path: fullPath,
      filename: path.basename(fullPath),
      directory: dirPath,
      isDirectory,
      size,
    };

    this.recentChanges.push(event);
    if (this.recentChanges.length > this.maxRecentChanges) {
      this.recentChanges = this.recentChanges.slice(-this.maxRecentChanges);
    }
    this.totalChanges++;

    this.emit({
      sensorId: this.metadata.id,
      timestamp: Date.now(),
      type: changeType,
      data: {
        watchedPaths: [...this.watchers.keys()],
        recentChanges: [...this.recentChanges],
        totalChanges: this.totalChanges,
        watchCount: this.watchers.size,
      },
      priority: this.getEventPriority({
        watchedPaths: [...this.watchers.keys()],
        recentChanges: [event],
        totalChanges: this.totalChanges,
        watchCount: this.watchers.size,
      }),
      source: "file",
    });
  }
}
