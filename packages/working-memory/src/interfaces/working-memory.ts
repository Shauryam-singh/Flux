import type { MemoryEntry, MemorySnapshot } from "../types/memory-entry.js";

export interface WorkingMemory {
  add(entry: Omit<MemoryEntry, "id" | "timestamp">): MemoryEntry;
  remove(id: string): boolean;
  snapshot(): MemorySnapshot;
  getByType(type: MemoryEntry["type"]): ReadonlyArray<MemoryEntry>;
  search(query: string): ReadonlyArray<MemoryEntry>;
  clear(): void;
  gc(): number;
  onChange(handler: (snapshot: MemorySnapshot) => void): () => void;
}
