import type { Observation, ObservationSource, ObservationSummary } from "./types.js";
import { AttentionPolicy, type AttentionRule } from "./policy.js";
import { PriorityScorer } from "./scorer.js";
import { ObservationBuffer } from "./buffer.js";
import { ObservationSummarizer } from "./summarizer.js";

export interface AttentionManagerOptions {
  /** Custom policy rules */
  policyRules?: AttentionRule[];

  /** Max observations to buffer before evicting */
  maxBuffer?: number;

  /** How often to auto-flush buffer (ms) */
  flushInterval?: number;

  /** Minimum score to send to brain (0-100) */
  minBrainScore?: number;

  /** Callback when observation passes through */
  onObservation?: (observation: Observation) => void;

  /** Callback when urgent observation detected */
  onUrgent?: (observation: Observation) => void;

  /** Callback when summary is ready */
  onSummary?: (summary: ObservationSummary) => void;
}

/**
 * The Attention Manager — gates what reaches the AI brain
 *
 * Flow:
 *   Raw Event → Observation → Policy → Score → Buffer → (Summarize) → Brain
 *
 * Goal: ~20 meaningful observations/hour instead of 50000 raw events
 */
export class AttentionManager {
  private policy: AttentionPolicy;
  private scorer: PriorityScorer;
  private buffer: ObservationBuffer;
  private summarizer: ObservationSummarizer;
  private minBrainScore: number;
  private onObservation?: (observation: Observation) => void;
  private onUrgent?: (observation: Observation) => void;
  private onSummary?: (summary: ObservationSummary) => void;
  private idCounter = 0;

  // Stats
  private stats = {
    totalEvents: 0,
    ignored: 0,
    suppressed: 0,
    buffered: 0,
    sentToBrain: 0,
    summarized: 0,
  };

  constructor(options?: AttentionManagerOptions) {
    this.policy = new AttentionPolicy(options?.policyRules);
    this.scorer = new PriorityScorer();
    this.buffer = new ObservationBuffer({
      ...(options?.maxBuffer !== undefined && { maxBuffer: options.maxBuffer }),
      ...(options?.flushInterval !== undefined && { flushInterval: options.flushInterval }),
    });
    this.summarizer = new ObservationSummarizer();
    this.minBrainScore = options?.minBrainScore ?? 40;
    if (options?.onObservation) this.onObservation = options.onObservation;
    if (options?.onUrgent) this.onUrgent = options.onUrgent;
    if (options?.onSummary) this.onSummary = options.onSummary;
  }

  /**
   * Process a raw event and decide what to do with it
   */
  process(event: {
    source: ObservationSource;
    title: string;
    detail: string;
    context?: Record<string, string>;
    duration?: number;
  }): {
    action: "ignore" | "buffer" | "immediate" | "summarize";
    observation?: Observation;
    summary?: ObservationSummary;
  } {
    this.stats.totalEvents++;

    // Create observation (without id/priority/score yet)
    const partial: Omit<Observation, "id" | "priority" | "score" | "consumed"> = {
      source: event.source,
      title: event.title,
      detail: event.detail,
      timestamp: Date.now(),
      mergeable: true,
      ...(event.duration !== undefined && { duration: event.duration }),
      ...(event.context !== undefined && { context: event.context }),
    };

    // Step 1: Policy check
    const decision = this.policy.evaluate(partial);

    // Step 2: Suppressed
    if (decision.suppressed) {
      this.stats.suppressed++;
      return { action: "ignore" };
    }

    // Step 3: Ignored
    if (decision.priority === "ignore") {
      this.stats.ignored++;
      return { action: "ignore" };
    }

    // Step 4: Create full observation
    const observation: Observation = {
      id: `obs_${Date.now()}_${++this.idCounter}`,
      ...partial,
      priority: decision.priority,
      score: decision.score,
      consumed: false,
    };

    this.stats.buffered++;
    this.buffer.add(observation);

    // Step 5: Immediate — send to brain right now
    if (
      decision.priority === "critical" ||
      decision.priority === "high" ||
      observation.score >= this.minBrainScore
    ) {
      this.stats.sentToBrain++;
      observation.consumed = true;
      this.onObservation?.(observation);

      if (decision.priority === "critical" || decision.priority === "high") {
        this.onUrgent?.(observation);
      }

      return { action: "immediate", observation };
    }

    // Step 6: Check if we should flush/summarize
    if (this.buffer.shouldFlush()) {
      const summary = this.flush();
      if (summary) {
        return { action: "summarize", summary };
      }
    }

    return { action: "buffer", observation };
  }

  /**
   * Flush the buffer and create a summary
   */
  flush(): ObservationSummary | null {
    const all = this.buffer.drain(true);
    if (all.length === 0) return null;

    // Find mergeable groups
    const groups = this.summarizer.findGroups(all);

    // Summarize each group
    for (const group of groups) {
      if (group.length > 1) {
        const summary = this.summarizer.summarize(group);
        this.stats.summarized++;
        this.onSummary?.(summary);
        return summary;
      }
    }

    // No groups to merge — summarize everything together
    const summary = this.summarizer.summarize(all);
    this.stats.summarized++;
    this.onSummary?.(summary);
    return summary;
  }

  /**
   * Force-check for urgent observations
   */
  checkUrgent(): Observation[] {
    return this.buffer.getUrgent();
  }

  /**
   * Get current stats
   */
  getStats() {
    const distribution = this.scorer.getDistribution();
    const reduction = this.stats.totalEvents > 0
      ? ((1 - this.stats.sentToBrain / this.stats.totalEvents) * 100).toFixed(1)
      : "0";

    return {
      ...this.stats,
      bufferSize: this.buffer.size,
      brainReduction: `${reduction}%`,
      avgScore: distribution.avg.toFixed(1),
      scoreRange: `${distribution.min}-${distribution.max}`,
    };
  }

  /**
   * Get the scoring distribution
   */
  getScoreDistribution() {
    return this.scorer.getDistribution();
  }

  /**
   * Get all buffered observations
   */
  getBuffer(): Observation[] {
    return this.buffer.drain(false);
  }
}
