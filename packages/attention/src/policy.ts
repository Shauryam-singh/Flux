import type { Observation, ObservationSource, ObservationPriority } from "./types.js";

/**
 * A rule that determines how to handle an observation
 */
export interface AttentionRule {
  /** Unique rule name */
  name: string;

  /** Match condition */
  match: {
    source?: ObservationSource | ObservationSource[];
    title?: RegExp;
    detail?: RegExp;
    context?: Record<string, string>;
  };

  /** What to do with matching observations */
  action: {
    priority: ObservationPriority;
    scoreOverride?: number;  // Force this score
    mergeable?: boolean;
    suppressSimilar?: number; // ms — ignore duplicate events within this window
  };
}

/**
 * Policy that determines how observations are handled
 */
export class AttentionPolicy {
  private rules: AttentionRule[] = [];
  private recentEvents = new Map<string, number>(); // title → last seen timestamp

  constructor(customRules?: AttentionRule[]) {
    this.rules = customRules ?? this.getDefaultRules();
  }

  /**
   * Evaluate an observation against all rules
   * Returns the decision: what priority, what score, should it be merged
   */
  evaluate(observation: {
    source: ObservationSource;
    title: string;
    detail: string;
    timestamp: number;
    duration?: number;
    context?: Record<string, string>;
    mergeable: boolean;
  }): {
    priority: ObservationPriority;
    score: number;
    mergeable: boolean;
    suppressed: boolean;
  } {
    // Check suppression first
    const suppressKey = `${observation.source}:${observation.title}`;
    const lastSeen = this.recentEvents.get(suppressKey);
    const now = observation.timestamp;

    // Find matching rules (first match wins)
    for (const rule of this.rules) {
      if (this.matchesRule(rule, observation)) {
        // Check suppress window
        if (rule.action.suppressSimilar && lastSeen) {
          if (now - lastSeen < rule.action.suppressSimilar) {
            return {
              priority: "ignore",
              score: 0,
              mergeable: false,
              suppressed: true,
            };
          }
        }

        // Record this event
        this.recentEvents.set(suppressKey, now);

        return {
          priority: rule.action.priority,
          score: rule.action.scoreOverride ?? this.estimateScore(observation),
          mergeable: rule.action.mergeable ?? observation.mergeable,
          suppressed: false,
        };
      }
    }

    // No rule matched — use default scoring
    this.recentEvents.set(suppressKey, now);
    return {
      priority: "medium",
      score: this.estimateScore(observation),
      mergeable: observation.mergeable,
      suppressed: false,
    };
  }

  private matchesRule(
    rule: AttentionRule,
    observation: {
      source: ObservationSource;
      title: string;
      detail: string;
      timestamp: number;
      duration?: number;
      context?: Record<string, string>;
      mergeable: boolean;
    },
  ): boolean {
    // Check source
    if (rule.match.source) {
      const sources = Array.isArray(rule.match.source)
        ? rule.match.source
        : [rule.match.source];
      if (!sources.includes(observation.source)) return false;
    }

    // Check title
    if (rule.match.title && !rule.match.title.test(observation.title)) return false;

    // Check detail
    if (rule.match.detail && !rule.match.detail.test(observation.detail)) return false;

    // Check context
    if (rule.match.context && observation.context) {
      for (const [key, value] of Object.entries(rule.match.context)) {
        if (observation.context[key] !== value) return false;
      }
    }

    return true;
  }

  private estimateScore(
    observation: {
      source: ObservationSource;
      title: string;
      detail: string;
      timestamp: number;
      duration?: number;
      context?: Record<string, string>;
      mergeable: boolean;
    },
  ): number {
    let score = 50; // baseline

    // Source scoring
    switch (observation.source) {
      case "user": score += 30; break;       // User input is always important
      case "git": score += 15; break;        // Git events matter
      case "code": score += 20; break;       // Code events matter
      case "terminal": score += 10; break;   // Terminal somewhat important
      case "system": score += 25; break;     // System issues are important
      case "process": score += 15; break;    // Process changes matter
      case "screen": score -= 10; break;     // Screen is usually noise
      case "file": score += 5; break;        // File events less important
      case "timer": score -= 20; break;      // Timer events low priority
      case "inference": score += 10; break;  // AI inferences moderate
    }

    // Title keywords
    const titleLower = observation.title.toLowerCase();
    if (titleLower.includes("fail") || titleLower.includes("error")) score += 25;
    if (titleLower.includes("crash")) score += 30;
    if (titleLower.includes("warning")) score += 10;
    if (titleLower.includes("success") || titleLower.includes("completed")) score += 5;
    if (titleLower.includes("started") || titleLower.includes("switched")) score -= 5;

    // Cap at 0-100
    return Math.max(0, Math.min(100, score));
  }

  private getDefaultRules(): AttentionRule[] {
    return [
      // ── IGNORE: Mouse/keyboard noise ──
      {
        name: "ignore-mouse",
        match: { source: "screen", title: /mouse|cursor|scroll|click/i },
        action: { priority: "ignore", mergeable: false },
      },
      {
        name: "ignore-keyboard",
        match: { source: "screen", title: /keystroke|typed|key\s+press/i },
        action: { priority: "ignore", mergeable: false },
      },
      {
        name: "ignore-repaint",
        match: { source: "screen", title: /repaint|redraw|refresh|render/i },
        action: { priority: "ignore", mergeable: false },
      },
      {
        name: "ignore-focus-loss",
        match: { source: "screen", title: /focus\s*lost|blur/i },
        action: { priority: "ignore", mergeable: false },
      },

      // ── BACKGROUND: Frequent but sometimes useful ──
      {
        name: "background-window-switch",
        match: { source: "screen", title: /window\s+switched|app\s+switched/i },
        action: {
          priority: "background",
          mergeable: true,
          suppressSimilar: 5000, // Ignore rapid window switches within 5s
        },
      },
      {
        name: "background-cursor-move",
        match: { source: "screen", title: /mouse\s+moved|cursor\s+moved/i },
        action: { priority: "ignore", mergeable: false },
      },

      // ── LOW: Routine events ──
      {
        name: "low-file-save",
        match: { source: "file", title: /saved|written/i },
        action: {
          priority: "low",
          mergeable: true,
          suppressSimilar: 2000, // Batch saves within 2s
        },
      },
      {
        name: "low-timer",
        match: { source: "timer" },
        action: { priority: "low", mergeable: true },
      },

      // ── MEDIUM: Meaningful events ──
      {
        name: "medium-command-executed",
        match: { source: "terminal", title: /command\s+executed/i },
        action: {
          priority: "medium",
          mergeable: true,
          suppressSimilar: 1000,
        },
      },
      {
        name: "medium-git-push",
        match: { source: "git", title: /push|commit/i },
        action: { priority: "medium", mergeable: false },
      },
      {
        name: "medium-file-change",
        match: { source: "file", title: /created|deleted|renamed/i },
        action: {
          priority: "medium",
          mergeable: true,
          suppressSimilar: 3000,
        },
      },

      // ── HIGH: Important events ──
      {
        name: "high-build-failed",
        match: { source: "terminal", title: /build\s+failed|compilation\s+error/i },
        action: { priority: "high", mergeable: false },
      },
      {
        name: "high-test-failed",
        match: { source: "terminal", title: /test\s+failed|tests?\s+failed/i },
        action: { priority: "high", mergeable: false },
      },
      {
        name: "high-git-conflict",
        match: { source: "git", title: /conflict|merge\s+conflict/i },
        action: { priority: "high", mergeable: false },
      },
      {
        name: "high-process-crash",
        match: { source: "process", title: /crash|segfault|killed|died/i },
        action: { priority: "high", mergeable: false },
      },

      // ── CRITICAL: Act now ──
      {
        name: "critical-system-danger",
        match: { source: "system", title: /disk\s+(almost\s+)?full|out\s+of\s+memory|oom/i },
        action: { priority: "critical", mergeable: false },
      },
      {
        name: "critical-security",
        match: { source: "system", title: /security|breach|unauthorized|intrusion/i },
        action: { priority: "critical", mergeable: false },
      },

      // ── User input is always at least medium ──
      {
        name: "user-input",
        match: { source: "user" },
        action: { priority: "medium", mergeable: false },
      },
    ];
  }
}
