import type { LearningPipeline } from "../interfaces/learning-pipeline.js";
import type { Feedback } from "../types/feedback.js";
import type { LearningUpdate } from "../types/learning-update.js";

export class DefaultLearningPipeline implements LearningPipeline {
  private feedbackBuffer: Feedback[] = [];
  private pendingUpdates: LearningUpdate[] = [];
  private idCounter = 0;
  private lastProcessed = 0;
  private applyHandler: ((update: LearningUpdate) => void) | null = null;

  constructor(options?: { onApply?: (update: LearningUpdate) => void }) {
    this.applyHandler = options?.onApply ?? null;
  }

  record(feedback: Feedback): void {
    this.feedbackBuffer.push(feedback);
    if (this.feedbackBuffer.length > 1000) {
      this.feedbackBuffer = this.feedbackBuffer.slice(-1000);
    }
  }

  async process(): Promise<ReadonlyArray<LearningUpdate>> {
    const updates: LearningUpdate[] = [];
    const now = Date.now();

    const accepted = this.feedbackBuffer.filter((f) => f.type === "suggestion_accepted");
    const rejected = this.feedbackBuffer.filter((f) => f.type === "suggestion_rejected");
    const total = accepted.length + rejected.length;

    if (total > 5) {
      const acceptanceRate = accepted.length / total;

      if (acceptanceRate > 0.7) {
        updates.push({
          target: "relationship",
          field: "trustLevel",
          oldValue: null,
          newValue: 3,
          confidence: 0.6,
          reason: `High acceptance rate (${(acceptanceRate * 100).toFixed(0)}%)`,
          timestamp: now,
        });
      }

      if (acceptanceRate < 0.3) {
        updates.push({
          target: "relationship",
          field: "trustLevel",
          oldValue: null,
          newValue: -2,
          confidence: 0.5,
          reason: `Low acceptance rate (${(acceptanceRate * 100).toFixed(0)}%)`,
          timestamp: now,
        });
      }
    }

    const corrections = this.feedbackBuffer.filter((f) => f.type === "user_correction");
    if (corrections.length > 3) {
      updates.push({
        target: "relationship",
        field: "communication.technicalDepth",
        oldValue: null,
        newValue: "high",
        confidence: 0.5,
        reason: `${corrections.length} corrections — user prefers precision`,
        timestamp: now,
      });
    }

    const positives = this.feedbackBuffer.filter((f) => f.type === "user_positive");
    const negatives = this.feedbackBuffer.filter((f) => f.type === "user_negative");
    if (positives.length > negatives.length * 2) {
      updates.push({
        target: "relationship",
        field: "humourTolerance",
        oldValue: null,
        newValue: 0.1,
        confidence: 0.4,
        reason: "User responds positively",
        timestamp: now,
      });
    }

    this.pendingUpdates.push(...updates);
    this.lastProcessed = now;
    this.feedbackBuffer = [];

    return updates;
  }

  getPendingUpdates(): ReadonlyArray<LearningUpdate> {
    return this.pendingUpdates;
  }

  apply(update: LearningUpdate): void {
    this.pendingUpdates = this.pendingUpdates.filter((u) => u !== update);
    this.applyHandler?.(update);
  }

  getStats() {
    const accepted = this.feedbackBuffer.filter((f) => f.type === "suggestion_accepted").length;
    const rejected = this.feedbackBuffer.filter((f) => f.type === "suggestion_rejected").length;
    const total = accepted + rejected;
    return {
      totalFeedback: this.feedbackBuffer.length,
      pendingUpdates: this.pendingUpdates.length,
      lastProcessed: this.lastProcessed,
      acceptedRate: total > 0 ? accepted / total : 0,
      rejectedRate: total > 0 ? rejected / total : 0,
    };
  }
}
