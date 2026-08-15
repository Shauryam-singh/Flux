import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ActionRecord, DiscoveredPattern, ActivitySnapshot } from "../types/index.js";

interface StoredData {
  actions: ActionRecord[];
  patterns: DiscoveredPattern[];
  snapshots: ActivitySnapshot[];
  version: number;
}

const DATA_DIR = join(homedir(), ".flux");
const LEARNING_FILE = join(DATA_DIR, "learning.json");
const MAX_ACTIONS = 10000;
const MAX_SNAPSHOTS = 5000;

export class LearningStore {
  private actions: ActionRecord[] = [];
  private patterns: DiscoveredPattern[] = [];
  private snapshots: ActivitySnapshot[] = [];
  private dirty = false;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private filePath: string;

  constructor(dataDir?: string) {
    const dir = dataDir ?? DATA_DIR;
    this.filePath = dataDir ? join(dataDir, "learning.json") : LEARNING_FILE;
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    this.load();
    this.flushTimer = setInterval(() => this.flush(), 30000);
  }

  private load(): void {
    try {
      if (!existsSync(this.filePath)) return;
      const raw = readFileSync(this.filePath, "utf-8");
      const data = JSON.parse(raw) as StoredData;
      if (Array.isArray(data.actions)) this.actions = data.actions;
      if (Array.isArray(data.patterns)) this.patterns = data.patterns;
      if (Array.isArray(data.snapshots)) this.snapshots = data.snapshots;
    } catch { /* fresh start */ }
  }

  private flush(): void {
    if (!this.dirty) return;
    try {
      const data: StoredData = {
        actions: this.actions.slice(-MAX_ACTIONS),
        patterns: this.patterns,
        snapshots: this.snapshots.slice(-MAX_SNAPSHOTS),
        version: 1,
      };
      writeFileSync(this.filePath, JSON.stringify(data, null, 2));
      this.dirty = false;
    } catch { /* best effort */ }
  }

  destroy(): void {
    this.flush();
    if (this.flushTimer) clearInterval(this.flushTimer);
  }

  recordAction(action: Omit<ActionRecord, "id" | "timestamp">): ActionRecord {
    const record: ActionRecord = {
      ...action,
      id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    this.actions.push(record);
    if (this.actions.length > MAX_ACTIONS) this.actions = this.actions.slice(-MAX_ACTIONS);
    this.dirty = true;
    return record;
  }

  recordSnapshot(snapshot: Omit<ActivitySnapshot, "timestamp">): ActivitySnapshot {
    const record: ActivitySnapshot = { ...snapshot, timestamp: Date.now() };
    this.snapshots.push(record);
    if (this.snapshots.length > MAX_SNAPSHOTS) this.snapshots = this.snapshots.slice(-MAX_SNAPSHOTS);
    this.dirty = true;
    return record;
  }

  getActions(filter?: { mode?: ActivitySnapshot["mode"]; type?: ActionRecord["type"]; since?: number }): ActionRecord[] {
    let result = this.actions;
    if (filter?.mode) result = result.filter(a => a.context === filter.mode);
    if (filter?.type) result = result.filter(a => a.type === filter.type);
    if (filter?.since !== undefined) result = result.filter(a => a.timestamp >= filter.since!);
    return result;
  }

  getSnapshots(filter?: { mode?: ActivitySnapshot["mode"]; since?: number }): ActivitySnapshot[] {
    let result = this.snapshots;
    if (filter?.mode) result = result.filter(s => s.mode === filter.mode);
    if (filter?.since !== undefined) result = result.filter(s => s.timestamp >= filter.since!);
    return result;
  }

  savePattern(pattern: Omit<DiscoveredPattern, "id">): DiscoveredPattern {
    const existing = this.patterns.find(
      p => p.type === pattern.type && p.description === pattern.description,
    );
    if (existing) {
      existing.occurrences++;
      existing.confidence = Math.min(1, existing.confidence + 0.05);
      existing.lastSeen = Date.now();
      this.dirty = true;
      return existing;
    }
    const record: DiscoveredPattern = {
      ...pattern,
      id: `pat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };
    this.patterns.push(record);
    this.dirty = true;
    return record;
  }

  getPatterns(): DiscoveredPattern[] {
    return [...this.patterns];
  }

  getPatternsByType(type: DiscoveredPattern["type"]): DiscoveredPattern[] {
    return this.patterns.filter(p => p.type === type);
  }

  removePattern(id: string): boolean {
    const idx = this.patterns.findIndex(p => p.id === id);
    if (idx === -1) return false;
    this.patterns.splice(idx, 1);
    this.dirty = true;
    return true;
  }

  getStats(): { actions: number; patterns: number; snapshots: number } {
    return { actions: this.actions.length, patterns: this.patterns.length, snapshots: this.snapshots.length };
  }

  clear(): void {
    this.actions = [];
    this.patterns = [];
    this.snapshots = [];
    this.dirty = true;
    this.flush();
  }
}
