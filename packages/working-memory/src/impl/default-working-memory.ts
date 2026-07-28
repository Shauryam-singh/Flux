import type { WorkingMemory } from "../interfaces/working-memory.js";
import type { MemoryEntry, MemorySnapshot } from "../types/memory-entry.js";

export class DefaultWorkingMemory implements WorkingMemory {
  private entries: MemoryEntry[] = [];
  private readonly capacity: number;
  private idCounter = 0;
  private handlers: Array<(snapshot: MemorySnapshot) => void> = [];

  constructor(options?: { capacity?: number }) {
    this.capacity = options?.capacity ?? 50;
  }

  add(entry: Omit<MemoryEntry, "id" | "timestamp">): MemoryEntry {
    const full: MemoryEntry = {
      ...entry,
      id: `wm_${Date.now()}_${++this.idCounter}`,
      timestamp: Date.now(),
    };

    if (this.entries.length >= this.capacity) {
      this.evictLowest();
    }

    this.entries.push(full);
    this.emit();
    return full;
  }

  remove(id: string): boolean {
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => e.id !== id);
    if (this.entries.length < before) {
      this.emit();
      return true;
    }
    return false;
  }

  snapshot(): MemorySnapshot {
    const sorted = [...this.entries].sort((a, b) => b.weight - a.weight);
    const totalWeight = sorted.reduce((sum, e) => sum + e.weight, 0);
    return {
      entries: sorted,
      totalWeight,
      capacity: this.capacity,
      utilization: this.entries.length / this.capacity,
      timestamp: Date.now(),
    };
  }

  getByType(type: MemoryEntry["type"]): ReadonlyArray<MemoryEntry> {
    return this.entries.filter((e) => e.type === type);
  }

  search(query: string): ReadonlyArray<MemoryEntry> {
    const lower = query.toLowerCase();
    return this.entries.filter((e) => e.content.toLowerCase().includes(lower));
  }

  clear(): void {
    this.entries = [];
    this.emit();
  }

  gc(): number {
    const before = this.entries.length;
    const now = Date.now();
    this.entries = this.entries.filter((e) => {
      if (e.expiresAt && e.expiresAt < now) return false;
      const ageMs = now - e.timestamp;
      if (ageMs > 7200000) return false; // 2 hours
      return true;
    });
    const removed = before - this.entries.length;
    if (removed > 0) this.emit();
    return removed;
  }

  onChange(handler: (snapshot: MemorySnapshot) => void): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  private evictLowest(): void {
    if (this.entries.length === 0) return;
    let minIdx = 0;
    for (let i = 1; i < this.entries.length; i++) {
      if (this.entries[i]!.weight < this.entries[minIdx]!.weight) {
        minIdx = i;
      }
    }
    this.entries.splice(minIdx, 1);
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const handler of this.handlers) {
      handler(snap);
    }
  }
}
