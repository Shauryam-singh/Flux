import type { Observation, ObservationSummary, ObservationPriority } from "./types.js";

/**
 * Summarizes related observations into concise summaries
 */
export class ObservationSummarizer {
  /**
   * Summarize a batch of observations into a single summary
   */
  summarize(observations: Observation[]): ObservationSummary {
    const sorted = [...observations].sort((a, b) => a.timestamp - b.timestamp);
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;

    // Determine highest priority
    const priorityOrder: ObservationPriority[] = [
      "ignore", "background", "low", "medium", "high", "critical",
    ];
    let highestPriorityIdx = 0;
    let highestScore = 0;

    for (const obs of sorted) {
      const pIdx = priorityOrder.indexOf(obs.priority);
      if (pIdx > highestPriorityIdx) highestPriorityIdx = pIdx;
      if (obs.score > highestScore) highestScore = obs.score;
    }

    return {
      id: `summary_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      observations: sorted,
      summary: this.generateSummaryText(sorted),
      totalCount: sorted.length,
      timeRange: { start: first.timestamp, end: last.timestamp },
      highestPriority: priorityOrder[highestPriorityIdx]!,
      highestScore,
    };
  }

  /**
   * Find groups of mergeable observations that can be combined
   */
  findGroups(observations: Observation[]): Observation[][] {
    const groups: Observation[][] = [];
    const used = new Set<string>();

    // Group by source
    const bySource = new Map<string, Observation[]>();
    for (const obs of observations) {
      if (!obs.mergeable || obs.consumed || used.has(obs.id)) continue;

      const key = obs.source;
      if (!bySource.has(key)) bySource.set(key, []);
      bySource.get(key)!.push(obs);
    }

    // Group similar observations within each source
    for (const [, sourceObs] of bySource) {
      const sorted = sourceObs.sort((a, b) => a.timestamp - b.timestamp);

      let currentGroup: Observation[] = [];
      let lastTitle = "";

      for (const obs of sorted) {
        if (used.has(obs.id)) continue;

        // Start new group if title changes significantly
        if (lastTitle && !this.isSimilarTitle(lastTitle, obs.title)) {
          if (currentGroup.length > 0) {
            groups.push(currentGroup);
          }
          currentGroup = [];
        }

        currentGroup.push(obs);
        used.add(obs.id);
        lastTitle = obs.title;
      }

      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
    }

    return groups;
  }

  /**
   * Generate a human-readable summary text
   */
  private generateSummaryText(observations: Observation[]): string {
    if (observations.length === 0) return "No observations";
    if (observations.length === 1) {
      const obs = observations[0]!;
      return `${obs.title}: ${obs.detail}`;
    }

    // Count by source
    const bySource = new Map<string, number>();
    for (const obs of observations) {
      bySource.set(obs.source, (bySource.get(obs.source) ?? 0) + 1);
    }

    // Count by priority
    const byPriority = new Map<string, number>();
    for (const obs of observations) {
      byPriority.set(obs.priority, (byPriority.get(obs.priority) ?? 0) + 1);
    }

    const parts: string[] = [];

    // Lead with highest priority
    const highPrio = observations.filter(
      (o) => o.priority === "high" || o.priority === "critical",
    );
    if (highPrio.length > 0) {
      parts.push(`${highPrio.length} urgent: ${highPrio.map((o) => o.title).join(", ")}`);
    }

    // Summarize by source
    const sourceSummaries: string[] = [];
    for (const [source, count] of bySource) {
      if (count > 1) {
        sourceSummaries.push(`${count} ${source} events`);
      } else {
        const obs = observations.find((o) => o.source === source);
        if (obs) sourceSummaries.push(obs.title);
      }
    }
    if (sourceSummaries.length > 0) {
      parts.push(sourceSummaries.join("; "));
    }

    // Time range
    const first = observations[0]!;
    const last = observations[observations.length - 1]!;
    const durationMs = last.timestamp - first.timestamp;
    if (durationMs > 60000) {
      const mins = Math.round(durationMs / 60000);
      parts.push(`over ${mins} minute${mins > 1 ? "s" : ""}`);
    } else if (durationMs > 5000) {
      const secs = Math.round(durationMs / 1000);
      parts.push(`over ${secs} seconds`);
    }

    return parts.join(" — ");
  }

  /**
   * Check if two titles are similar enough to group
   */
  private isSimilarTitle(a: string, b: string): boolean {
    // Exact match
    if (a === b) return true;

    // One contains the other
    if (a.includes(b) || b.includes(a)) return true;

    // Same base pattern (e.g., "File saved: X" vs "File saved: Y")
    const baseA = a.replace(/:\s*\S+$/, "").trim();
    const baseB = b.replace(/:\s*\S+$/, "").trim();
    if (baseA === baseB) return true;

    return false;
  }
}
