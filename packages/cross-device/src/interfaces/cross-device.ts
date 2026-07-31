/**
 * Cross-device synchronization via shared directory.
 *
 * Syncs goals, reminders, and settings between Flux instances
 * by writing JSON files to a shared directory (e.g., NFS mount, cloud folder).
 */
export interface CrossDeviceSync {
  /** Initialize sync with a shared directory path */
  init(sharedDir: string): void;
  /** Push local state to shared directory */
  push(state: SyncState): Promise<void>;
  /** Pull remote state from shared directory */
  pull(): Promise<SyncState | null>;
  /** Watch for changes (polls every interval) */
  watch(intervalMs: number, onChange: (state: SyncState) => void): () => void;
  /** Get sync status */
  getStatus(): SyncStatus;
}

export interface SyncState {
  deviceId: string;
  timestamp: number;
  goals: ReadonlyArray<unknown>;
  reminders: ReadonlyArray<unknown>;
  settings: Record<string, unknown>;
}

export interface SyncStatus {
  enabled: boolean;
  sharedDir: string | null;
  lastPush: number | null;
  lastPull: number | null;
  error: string | null;
}
