export type MemoryEntryType =
  | "focus"
  | "observation"
  | "thought"
  | "blocker"
  | "error"
  | "context"
  | "goal";

export interface MemoryEntry {
  readonly id: string;
  readonly type: MemoryEntryType;
  readonly content: string;
  readonly weight: number;
  readonly timestamp: number;
  readonly source: string;
  readonly expiresAt?: number;
}

export interface MemorySnapshot {
  readonly entries: ReadonlyArray<MemoryEntry>;
  readonly totalWeight: number;
  readonly capacity: number;
  readonly utilization: number;
  readonly timestamp: number;
}
