import type { ActionRecord, DiscoveredPattern } from "../types/index.js";
import type { LearningStore } from "./learning-store.js";

export class BehaviorLearner {
  constructor(private store: LearningStore) {}

  discoverPatterns(): DiscoveredPattern[] {
    const patterns: DiscoveredPattern[] = [];
    patterns.push(...this.discoverDailyRoutines());
    patterns.push(...this.discoverAppClusters());
    patterns.push(...this.discoverTriggerActions());
    return patterns;
  }

  private discoverDailyRoutines(): DiscoveredPattern[] {
    const patterns: DiscoveredPattern[] = [];
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const recentSnapshots = this.store.getSnapshots({ since: now - oneWeek });

    if (recentSnapshots.length < 10) return patterns;

    // Group by hour+day
    const slotMap = new Map<string, { snapshots: typeof recentSnapshots; apps: Map<string, number> }>();
    for (const s of recentSnapshots) {
      const d = new Date(s.timestamp);
      const key = `${d.getDay()}_${d.getHours()}`;
      if (!slotMap.has(key)) slotMap.set(key, { snapshots: [], apps: new Map() });
      const slot = slotMap.get(key)!;
      slot.snapshots.push(s);
      slot.apps.set(s.activeApp, (slot.apps.get(s.activeApp) ?? 0) + 1);
    }

    for (const [key, slot] of slotMap) {
      if (slot.snapshots.length < 3) continue;
      const parts = key.split("_");
      const day = Number(parts[0]);
      const hour = Number(parts[1]);

      // Find dominant app
      let dominantApp = "";
      let maxCount = 0;
      for (const [app, count] of slot.apps) {
        if (count > maxCount) { maxCount = count; dominantApp = app; }
      }

      const confidence = Math.min(0.95, slot.snapshots.length / 20);
      patterns.push(this.store.savePattern({
        type: "daily_routine",
        description: `On ${this.dayName(day)} at ${hour}:00, you typically use ${dominantApp}`,
        confidence,
        occurrences: slot.snapshots.length,
        lastSeen: Math.max(...slot.snapshots.map(s => s.timestamp)),
        conditions: [
          { field: "dayOfWeek", operator: "eq", value: day },
          { field: "hourOfDay", operator: "eq", value: hour },
        ],
        actions: [{ type: "app_open", detail: dominantApp, priority: 1 }],
      }));
    }

    return patterns;
  }

  private discoverAppClusters(): DiscoveredPattern[] {
    const patterns: DiscoveredPattern[] = [];
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const recentActions = this.store.getActions({ since: now - oneDay });

    // Find apps that appear together within 5-minute windows
    const windowMs = 5 * 60 * 1000;
    const clusters: Map<string, { apps: string[]; count: number }> = new Map();

    for (let i = 0; i < recentActions.length; i++) {
      const appsInWindow = new Set<string>();
      const windowStart = recentActions[i]!.timestamp;

      for (let j = i; j < recentActions.length; j++) {
        const aj = recentActions[j]!;
        if (aj.timestamp - windowStart >= windowMs) break;
        if (aj.type === "app_open" || aj.type === "app_switch") {
          appsInWindow.add(aj.detail);
        }
      }

      if (appsInWindow.size >= 2) {
        const key = [...appsInWindow].sort().join("+");
        const existing = clusters.get(key);
        if (existing) existing.count++;
        else clusters.set(key, { apps: [...appsInWindow], count: 1 });
      }
    }

    for (const [, cluster] of clusters) {
      if (cluster.count < 3) continue;
      patterns.push(this.store.savePattern({
        type: "app_cluster",
        description: `You often use these together: ${cluster.apps.join(", ")}`,
        confidence: Math.min(0.9, cluster.count / 10),
        occurrences: cluster.count,
        lastSeen: now,
        conditions: cluster.apps.map(app => ({ field: "activeApp", operator: "eq" as const, value: app })),
        actions: cluster.apps.map((app, i) => ({ type: "app_open", detail: app, priority: i + 1 })),
      }));
    }

    return patterns;
  }

  private discoverTriggerActions(): DiscoveredPattern[] {
    const patterns: DiscoveredPattern[] = [];
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const actions = this.store.getActions({ since: now - oneWeek, type: "app_open" });

    // Find sequences: app A always followed by app B within 2 minutes
    const seqMap = new Map<string, { count: number; lastSeen: number }>();
    const seqWindow = 2 * 60 * 1000;

    for (let i = 0; i < actions.length - 1; i++) {
      const a = actions[i]!;
      for (let j = i + 1; j < actions.length; j++) {
        const b = actions[j]!;
        if (b.timestamp - a.timestamp >= seqWindow) break;
        if (a.detail !== b.detail) {
          const key = `${a.detail}->${b.detail}`;
          const existing = seqMap.get(key);
          if (existing) { existing.count++; existing.lastSeen = b.timestamp; }
          else seqMap.set(key, { count: 1, lastSeen: b.timestamp });
        }
      }
    }

    for (const [key, seq] of seqMap) {
      if (seq.count < 5) continue;
      const parts = key.split("->");
      const from = parts[0];
      const to = parts[1];
      patterns.push(this.store.savePattern({
        type: "trigger_action",
        description: `After opening ${from}, you usually open ${to}`,
        confidence: Math.min(0.95, seq.count / 15),
        occurrences: seq.count,
        lastSeen: seq.lastSeen,
        conditions: [{ field: "lastApp", operator: "eq", value: from }],
        actions: [{ type: "app_open", detail: to!, priority: 1 }],
      }));
    }

    return patterns;
  }

  private dayName(d: number): string {
    return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d] ?? "Unknown";
  }
}
