import type { Observation, ObservationSource } from "./types.js";

/**
 * Scores observations based on multiple factors
 * Returns 0-100 where higher = more important
 */
export class PriorityScorer {
  private recentScores: number[] = [];
  private readonly windowSize = 20;

  /**
   * Score an observation (0-100)
   */
  score(observation: {
    source: ObservationSource;
    title: string;
    detail: string;
    timestamp: number;
    duration?: number;
    context?: Record<string, string>;
    mergeable: boolean;
  }): number {
    let score = 0;

    // Factor 1: Source importance (0-30)
    score += this.sourceScore(observation.source);

    // Factor 2: Title urgency (0-30)
    score += this.titleScore(observation.title);

    // Factor 3: Context signals (0-20)
    score += this.contextScore(observation.context);

    // Factor 4: Frequency (0-10) — rare events score higher
    score += this.frequencyScore(observation.title);

    // Factor 5: Time of day (0-10) — work hours score higher
    score += this.timeScore();

    // Cap at 0-100
    score = Math.max(0, Math.min(100, score));

    // Track for frequency analysis
    this.recentScores.push(score);
    if (this.recentScores.length > this.windowSize) {
      this.recentScores.shift();
    }

    return score;
  }

  /**
   * Get the distribution of recent scores
   */
  getDistribution(): { avg: number; max: number; min: number; count: number } {
    if (this.recentScores.length === 0) {
      return { avg: 0, max: 0, min: 0, count: 0 };
    }
    return {
      avg: this.recentScores.reduce((a, b) => a + b, 0) / this.recentScores.length,
      max: Math.max(...this.recentScores),
      min: Math.min(...this.recentScores),
      count: this.recentScores.length,
    };
  }

  private sourceScore(source: ObservationSource): number {
    const scores: Record<ObservationSource, number> = {
      user: 30,        // User input is always important
      system: 25,      // System issues are critical
      process: 20,     // Process changes matter
      code: 20,        // Code events matter
      git: 18,         // Git events matter
      terminal: 15,    // Terminal somewhat important
      inference: 12,   // AI inferences moderate
      file: 8,         // File events less important
      screen: 5,       // Screen is usually noise
      timer: 2,        // Timer events low priority
    };
    return scores[source] ?? 10;
  }

  private titleScore(title: string): number {
    const lower = title.toLowerCase();
    let score = 5; // baseline

    // Critical patterns
    if (lower.includes("crash") || lower.includes("segfault")) score += 25;
    if (lower.includes("security") || lower.includes("breach")) score += 30;
    if (lower.includes("disk full") || lower.includes("out of memory")) score += 25;

    // Error patterns
    if (lower.includes("failed") || lower.includes("failure")) score += 20;
    if (lower.includes("error")) score += 18;
    if (lower.includes("exception")) score += 15;

    // Warning patterns
    if (lower.includes("warning") || lower.includes("deprecated")) score += 10;

    // Success patterns (lower priority)
    if (lower.includes("success") || lower.includes("completed")) score += 5;
    if (lower.includes("passed")) score += 3;

    // Noise patterns (negative)
    if (lower.includes("mouse") || lower.includes("cursor")) score -= 10;
    if (lower.includes("scroll") || lower.includes("repaint")) score -= 10;
    if (lower.includes("focus") || lower.includes("blur")) score -= 5;

    return Math.max(0, Math.min(30, score));
  }

  private contextScore(context?: Record<string, string>): number {
    if (!context) return 0;

    let score = 0;

    // Error codes
    if (context.exitCode && parseInt(context.exitCode) !== 0) score += 15;
    if (context.signal === "SIGKILL" || context.signal === "SIGTERM") score += 10;

    // File types (code files are more important)
    if (context.fileType === "code" || context.fileType === "config") score += 8;
    if (context.fileType === "document") score += 5;

    // Duration (longer events are more significant)
    if (context.duration) {
      const ms = parseInt(context.duration);
      if (ms > 60000) score += 10; // > 1 minute
      else if (ms > 10000) score += 5; // > 10 seconds
    }

    return Math.min(20, score);
  }

  private frequencyScore(title: string): number {
    // Rare events score higher
    const recentTitles = this.recentScores.map((_, i) => title);
    const occurrences = recentTitles.filter((t) => t === title).length;

    if (occurrences <= 1) return 10;  // First time — important
    if (occurrences <= 3) return 5;   // A few times — moderate
    if (occurrences <= 5) return 2;   // Repeated — less important
    return 0;                          // Very frequent — noise
  }

  private timeScore(): number {
    const hour = new Date().getHours();

    // Work hours: 9am-6pm
    if (hour >= 9 && hour <= 18) return 10;

    // Extended hours: 6am-9am, 6pm-10pm
    if (hour >= 6 && hour < 9) return 7;
    if (hour > 18 && hour <= 22) return 7;

    // Night: 10pm-6am
    return 3;
  }
}
