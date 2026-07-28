import type { ConfidenceRecord, CalibrationBucket } from "@ai-agent/evo-types";

export interface ConfidenceCalibration {
  record(domain: string, predictedConfidence: number, actualOutcome: boolean, context?: Record<string, unknown>): ConfidenceRecord;
  getBuckets(bucketCount?: number): ReadonlyArray<CalibrationBucket>;
  getOverallCalibrationError(): number;
  getDomainCalibrationError(domain: string): number;
  getDomainRecords(domain: string): ReadonlyArray<ConfidenceRecord>;
  getAllRecords(): ReadonlyArray<ConfidenceRecord>;
  isWellCalibrated(domain?: string): boolean;
  getRecommendedAdjustment(domain: string): number;
  count(): number;
}
