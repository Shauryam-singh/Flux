import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

interface WakeProfile {
  lastShutdownAt: number;
  lastApps: string[];
  lastMode: string;
  dayOfWeek: number;
  hourOfDay: number;
  sessions: WakeSessionRecord[];
}

interface WakeSessionRecord {
  dayOfWeek: number;
  hourOfDay: number;
  apps: string[];
  mode: string;
  timestamp: number;
}

const DEFAULT_WAKE_FILE = join(homedir(), ".flux", "smart-wake.json");

export class SmartWake {
  private profile: WakeProfile;
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? DEFAULT_WAKE_FILE;
    this.profile = this.load();
  }

  private load(): WakeProfile {
    try {
      if (existsSync(this.filePath)) {
        const raw = readFileSync(this.filePath, "utf-8");
        return JSON.parse(raw) as WakeProfile;
      }
    } catch { /* fresh start */ }
    return {
      lastShutdownAt: 0,
      lastApps: [],
      lastMode: "unknown",
      dayOfWeek: 0,
      hourOfDay: 0,
      sessions: [],
    };
  }

  private save(): void {
    try {
      const dir = this.filePath.substring(0, this.filePath.lastIndexOf("/"));
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      this.profile.sessions = this.profile.sessions.slice(-50);
      writeFileSync(this.filePath, JSON.stringify(this.profile, null, 2));
    } catch { /* best effort */ }
  }

  recordSession(apps: string[], mode: string): void {
    const now = new Date();
    this.profile.lastShutdownAt = Date.now();
    this.profile.lastApps = apps;
    this.profile.lastMode = mode;
    this.profile.dayOfWeek = now.getDay();
    this.profile.hourOfDay = now.getHours();
    this.profile.sessions.push({
      dayOfWeek: now.getDay(),
      hourOfDay: now.getHours(),
      apps,
      mode,
      timestamp: Date.now(),
    });
    this.save();
  }

  getSuggestedApps(): string[] {
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();

    const similar = this.profile.sessions.filter(s =>
      s.dayOfWeek === currentDay && Math.abs(s.hourOfDay - currentHour) <= 1,
    );

    if (similar.length === 0) {
      return this.getMostFrequentApps();
    }

    const appCounts = new Map<string, number>();
    for (const s of similar) {
      const weight = 1 + (Date.now() - s.timestamp) / (7 * 24 * 60 * 60 * 1000);
      for (const app of s.apps) {
        appCounts.set(app, (appCounts.get(app) ?? 0) + 1 / weight);
      }
    }

    return [...appCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([app]) => app);
  }

  getSuggestedMode(): string {
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();

    const similar = this.profile.sessions.filter(s =>
      s.dayOfWeek === currentDay && Math.abs(s.hourOfDay - currentHour) <= 1,
    );

    if (similar.length === 0) {
      // Fall back to most recent session's mode
      if (this.profile.sessions.length > 0) {
        return this.profile.sessions[this.profile.sessions.length - 1]!.mode;
      }
      return this.profile.lastMode;
    }

    const modeCounts = new Map<string, number>();
    for (const s of similar) {
      modeCounts.set(s.mode, (modeCounts.get(s.mode) ?? 0) + 1);
    }

    let bestMode = similar[0]!.mode;
    let bestCount = 0;
    for (const [mode, count] of modeCounts) {
      if (count > bestCount) { bestCount = count; bestMode = mode; }
    }
    return bestMode;
  }

  private getMostFrequentApps(): string[] {
    const appCounts = new Map<string, number>();
    for (const s of this.profile.sessions) {
      for (const app of s.apps) {
        appCounts.set(app, (appCounts.get(app) ?? 0) + 1);
      }
    }
    return [...appCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([app]) => app);
  }

  getProfile(): WakeProfile {
    return { ...this.profile };
  }
}
