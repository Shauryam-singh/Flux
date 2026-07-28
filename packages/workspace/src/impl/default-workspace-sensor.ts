import type { WorkspaceSensor, WorkspaceConfig } from "../interfaces/workspace-sensor.js";
import type { WorkspaceSnapshot, BrowserTab, WorkspaceTerminal, WorkspaceContainer } from "@ai-agent/ambient-types";

const DEFAULT_CONFIG: WorkspaceConfig = {
  pollIntervalMs: 2000,
  enabled: true,
  trackClipboard: true,
  trackBrowser: true,
  trackTerminals: true,
  trackContainers: true,
};

export class DefaultWorkspaceSensor implements WorkspaceSensor {
  private config: WorkspaceConfig;
  private handlers: Array<(snapshot: WorkspaceSnapshot) => void> = [];
  private lastSnapshot: WorkspaceSnapshot | null = null;

  constructor(config?: Partial<WorkspaceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async snapshot(): Promise<WorkspaceSnapshot> {
    const snapshot: WorkspaceSnapshot = {
      timestamp: Date.now(),
      openApplications: [],
      browserTabs: [],
      terminals: [],
      containers: [],
      openFiles: [],
      focusedFile: null,
      gitBranch: null,
      clipboardContent: null,
      clipboardType: null,
      recentDownloads: [],
      mountedDrives: [],
      notifications: [],
    };

    this.lastSnapshot = snapshot;
    for (const handler of this.handlers) {
      handler(snapshot);
    }
    return snapshot;
  }

  async getOpenApplications(): Promise<ReadonlyArray<{ name: string; windowCount: number; active: boolean }>> {
    return [];
  }

  async getBrowserTabs(): Promise<ReadonlyArray<BrowserTab>> {
    return [];
  }

  async getTerminals(): Promise<ReadonlyArray<WorkspaceTerminal>> {
    return [];
  }

  async getContainers(): Promise<ReadonlyArray<WorkspaceContainer>> {
    return [];
  }

  async getClipboard(): Promise<{ content: string; type: "text" | "image" | "file" | "unknown" } | null> {
    return null;
  }

  isAvailable(): boolean {
    return this.config.enabled;
  }

  onChange(handler: (snapshot: WorkspaceSnapshot) => void): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  getLastSnapshot(): WorkspaceSnapshot | null {
    return this.lastSnapshot;
  }
}
