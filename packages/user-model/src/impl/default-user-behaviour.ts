import type { UserBehaviourModel } from "../interfaces/user-behaviour.js";
import type { BehaviourPattern, PatternType } from "../types/behaviour-pattern.js";
import type { Observation } from "@ai-agent/attention";

export class DefaultUserBehaviourModel implements UserBehaviourModel {
  private patterns: Map<string, BehaviourPattern> = new Map();
  private idCounter = 0;
  private observationBuffer: Observation[] = [];

  observe(observation: Observation): void {
    this.observationBuffer.push(observation);
    if (this.observationBuffer.length > 100) {
      this.observationBuffer = this.observationBuffer.slice(-100);
    }

    this.detectPattern("testing_habit", observation);
    this.detectPattern("commit_habit", observation);
    this.detectPattern("error_response", observation);
    this.detectPattern("work_hours", observation);
    this.detectPattern("session_length", observation);
  }

  getPatterns(): ReadonlyArray<BehaviourPattern> {
    return [...this.patterns.values()];
  }

  getPatternsByType(type: PatternType): ReadonlyArray<BehaviourPattern> {
    return [...this.patterns.values()].filter((p) => p.type === type);
  }

  getConfidence(type: PatternType): number {
    const patterns = this.getPatternsByType(type);
    if (patterns.length === 0) return 0;
    return patterns.reduce((max, p) => Math.max(max, p.confidence), 0);
  }

  getHabits(): ReadonlyArray<string> {
    return [...this.patterns.values()]
      .filter((p) => p.confidence > 0.5)
      .map((p) => p.description);
  }

  updateConfidence(patternId: string, correct: boolean): void {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return;
    const delta = correct ? 0.05 : -0.05;
    const newConfidence = Math.max(0, Math.min(1, pattern.confidence + delta));
    this.patterns.set(patternId, {
      ...pattern,
      confidence: newConfidence,
      occurrences: pattern.occurrences + 1,
      lastSeen: Date.now(),
    });
  }

  private detectPattern(type: PatternType, observation: Observation): void {
    switch (type) {
      case "testing_habit":
        if (observation.source === "terminal" && observation.title.toLowerCase().includes("test")) {
          this.upsertPattern(type, "Always runs tests", 0.3);
        }
        break;
      case "commit_habit":
        if (observation.source === "git" && observation.title.toLowerCase().includes("commit")) {
          this.upsertPattern(type, "Regular committer", 0.3);
        }
        break;
      case "error_response":
        if (observation.source === "system" && observation.title.toLowerCase().includes("error")) {
          const hasBrowser = this.observationBuffer.some(
            (o) => o.source === "screen" && o.context?.["app"]?.toLowerCase().includes("browser"),
          );
          if (hasBrowser) {
            this.upsertPattern(type, "Opens browser after errors", 0.4);
          }
        }
        break;
      case "work_hours": {
        const hour = new Date(observation.timestamp).getHours();
        const isNight = hour >= 20 || hour < 6;
        this.upsertPattern(type, isNight ? "Works primarily at night" : "Works primarily during day", 0.2);
        break;
      }
      case "session_length":
        this.upsertPattern(type, "Active session", 0.1);
        break;
    }
  }

  private upsertPattern(type: PatternType, description: string, initialConfidence: number): void {
    const existing = [...this.patterns.values()].find((p) => p.type === type && p.description === description);
    if (existing) {
      const newConf = Math.min(1, existing.confidence + 0.02);
      this.patterns.set(existing.id, {
        ...existing,
        confidence: newConf,
        occurrences: existing.occurrences + 1,
        lastSeen: Date.now(),
      });
    } else {
      const id = `bp_${++this.idCounter}`;
      this.patterns.set(id, {
        id,
        type,
        description,
        confidence: initialConfidence,
        occurrences: 1,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        metadata: {},
      });
    }
  }
}
