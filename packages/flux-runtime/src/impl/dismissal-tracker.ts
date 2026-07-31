/**
 * Suggestion Dismissal Tracker
 *
 * Tracks when users dismiss suggestions and learns to suppress
 * repeated ignored suggestions over time.
 */

interface DismissalRecord {
  readonly suggestionId: string;
  readonly timestamp: number;
  readonly message: string;
}

interface SuppressionRule {
  readonly pattern: string;
  readonly suppressUntil: number;
  readonly dismissCount: number;
}

export class DismissalTracker {
  private readonly dismissals: DismissalRecord[] = [];
  private readonly suppressions: Map<string, SuppressionRule> = new Map();
  private readonly maxDismissals = 200;
  private readonly dismissThreshold = 3; // After 3 dismissals, start suppressing
  private readonly suppressionDuration = 1800_000; // 30 minutes

  /**
   * Record that a suggestion was dismissed.
   */
  recordDismissal(suggestionId: string, message: string): void {
    this.dismissals.push({
      suggestionId,
      timestamp: Date.now(),
      message,
    });

    if (this.dismissals.length > this.maxDismissals) {
      this.dismissals.splice(0, this.dismissals.length - this.maxDismissals);
    }

    // Count dismissals for this suggestion pattern
    const pattern = this.extractPattern(suggestionId);
    const recentDismissals = this.dismissals.filter(
      (d) =>
        this.extractPattern(d.suggestionId) === pattern &&
        Date.now() - d.timestamp < 3600_000, // Last hour
    );

    if (recentDismissals.length >= this.dismissThreshold) {
      this.suppressions.set(pattern, {
        pattern,
        suppressUntil: Date.now() + this.suppressionDuration,
        dismissCount: recentDismissals.length,
      });
    }
  }

  /**
   * Check if a suggestion should be suppressed.
   */
  shouldSuppress(suggestionId: string): boolean {
    const pattern = this.extractPattern(suggestionId);
    const rule = this.suppressions.get(pattern);
    if (!rule) return false;

    if (Date.now() > rule.suppressUntil) {
      this.suppressions.delete(pattern);
      return false;
    }

    return true;
  }

  /**
   * Get suppression stats for debugging.
   */
  getStats(): {
    readonly totalDismissals: number;
    readonly activeSuppressions: number;
    readonly suppressedPatterns: ReadonlyArray<string>;
  } {
    // Clean expired suppressions
    const now = Date.now();
    for (const [key, rule] of this.suppressions) {
      if (now > rule.suppressUntil) {
        this.suppressions.delete(key);
      }
    }

    return {
      totalDismissals: this.dismissals.length,
      activeSuppressions: this.suppressions.size,
      suppressedPatterns: Array.from(this.suppressions.keys()),
    };
  }

  /**
   * Extract a pattern from a suggestion ID for grouping.
   * e.g., "docker_die_abc123" → "docker_die"
   */
  private extractPattern(suggestionId: string): string {
    // Remove random suffixes like _abc123
    return suggestionId.replace(/_[a-z0-9]{6}$/, "").replace(/_\d{13}$/, "");
  }
}
