import type { Feedback } from "../types/feedback.js";
import type { LearningUpdate } from "../types/learning-update.js";

export interface LearningPipeline {
  record(feedback: Feedback): void;
  process(): Promise<ReadonlyArray<LearningUpdate>>;
  getPendingUpdates(): ReadonlyArray<LearningUpdate>;
  apply(update: LearningUpdate): void;
  getStats(): {
    totalFeedback: number;
    pendingUpdates: number;
    lastProcessed: number;
    acceptedRate: number;
    rejectedRate: number;
  };
}
