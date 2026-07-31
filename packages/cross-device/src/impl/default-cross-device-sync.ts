import { writeFile, readFile, readdir, stat, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type {
  CrossDeviceSync,
  SyncState,
  SyncStatus,
} from "../interfaces/cross-device.js";

const SYNC_FILE = "flux-sync.json";
const DEVICE_ID_FILE = ".flux-device-id";

export class DefaultCrossDeviceSync implements CrossDeviceSync {
  private sharedDir: string | null = null;
  private deviceId: string = "";
  private status: SyncStatus = {
    enabled: false,
    sharedDir: null,
    lastPush: null,
    lastPull: null,
    error: null,
  };

  init(sharedDir: string): void {
    this.sharedDir = sharedDir;
    this.status.enabled = true;
    this.status.sharedDir = sharedDir;

    // Generate or load device ID
    this.deviceId = this.getOrCreateDeviceId();
  }

  async push(state: SyncState): Promise<void> {
    if (!this.sharedDir) {
      this.status.error = "No shared directory configured";
      return;
    }

    try {
      await mkdir(this.sharedDir, { recursive: true });

      const syncData: SyncState = {
        ...state,
        deviceId: this.deviceId,
        timestamp: Date.now(),
      };

      const filePath = join(this.sharedDir, SYNC_FILE);
      await writeFile(filePath, JSON.stringify(syncData, null, 2), "utf-8");

      this.status.lastPush = Date.now();
      this.status.error = null;
    } catch (err) {
      this.status.error = `Push failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  async pull(): Promise<SyncState | null> {
    if (!this.sharedDir) {
      this.status.error = "No shared directory configured";
      return null;
    }

    try {
      const filePath = join(this.sharedDir, SYNC_FILE);
      const raw = await readFile(filePath, "utf-8");
      const state: SyncState = JSON.parse(raw);

      this.status.lastPull = Date.now();
      this.status.error = null;

      // Don't return our own state
      if (state.deviceId === this.deviceId) return null;

      return state;
    } catch {
      // File doesn't exist or can't be read — that's fine
      this.status.error = null;
      return null;
    }
  }

  watch(intervalMs: number, onChange: (state: SyncState) => void): () => void {
    let running = true;

    const poll = async (): Promise<void> => {
      while (running) {
        const state = await this.pull();
        if (state) {
          onChange(state);
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    };

    void poll();

    return () => {
      running = false;
    };
  }

  getStatus(): SyncStatus {
    return { ...this.status };
  }

  private getOrCreateDeviceId(): string {
    // In a real implementation, this would persist to a file
    // For now, generate a random ID
    const id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return id;
  }
}
