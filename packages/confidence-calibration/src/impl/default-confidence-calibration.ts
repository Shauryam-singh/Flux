import type { ConfidenceCalibration } from "../interfaces/confidence-calibration.js";
import type { ConfidenceRecord, CalibrationBucket } from "@ai-agent/evo-types";

let counter = 0;

export class DefaultConfidenceCalibration implements ConfidenceCalibration {
  private readonly records: ConfidenceRecord[] = [];

  record(domain: string, predictedConfidence: number, actualOutcome: boolean, context?: Record<string, unknown>): ConfidenceRecord {
    const id = `cc_${++counter}`;
    const record: ConfidenceRecord = {
      id,
      domain,
      predictedConfidence,
      actualOutcome,
      calibrationError: Math.abs(predictedConfidence - (actualOutcome ? 1 : 0)),
      timestamp: Date.now(),
      context: context ?? {},
    };
    this.records.push(record);
    return record;
  }

  getBuckets(bucketCount: number = 10): ReadonlyArray<CalibrationBucket> {
    const buckets: CalibrationBucket[] = [];
    const width = 1 / bucketCount;

    for (let i = 0; i < bucketCount; i++) {
      const lowerBound = i * width;
      const upperBound = (i + 1) * width;
      const inBucket = this.records.filter(
        (r) => r.predictedConfidence >= lowerBound && r.predictedConfidence < upperBound
      );
      const predictions = inBucket.length;
      const correct = inBucket.filter((r) => r.actualOutcome).length;
      const actualAccuracy = predictions > 0 ? correct / predictions : 0;
      const averageConfidence = predictions > 0
        ? inBucket.reduce((sum, r) => sum + r.predictedConfidence, 0) / predictions
        : (lowerBound + upperBound) / 2;
      const calibrationError = Math.abs(averageConfidence - actualAccuracy);

      buckets.push({
        lowerBound,
        upperBound,
        predictions,
        correct,
        averageConfidence,
        actualAccuracy,
        calibrationError,
      });
    }

    return buckets;
  }

  getOverallCalibrationError(): number {
    if (this.records.length === 0) return 0;
    const totalError = this.records.reduce((sum, r) => sum + r.calibrationError, 0);
    return totalError / this.records.length;
  }

  getDomainCalibrationError(domain: string): number {
    const domainRecords = this.getDomainRecords(domain);
    if (domainRecords.length === 0) return 0;
    const totalError = domainRecords.reduce((sum, r) => sum + r.calibrationError, 0);
    return totalError / domainRecords.length;
  }

  getDomainRecords(domain: string): ReadonlyArray<ConfidenceRecord> {
    return this.records.filter((r) => r.domain === domain);
  }

  getAllRecords(): ReadonlyArray<ConfidenceRecord> {
    return this.records;
  }

  isWellCalibrated(domain?: string): boolean {
    const error = domain !== undefined
      ? this.getDomainCalibrationError(domain)
      : this.getOverallCalibrationError();
    return error < 0.1;
  }

  getRecommendedAdjustment(domain: string): number {
    const domainRecords = this.getDomainRecords(domain);
    if (domainRecords.length === 0) return 0;
    const totalDiff = domainRecords.reduce(
      (sum, r) => sum + ((r.actualOutcome ? 1 : 0) - r.predictedConfidence),
      0
    );
    return totalDiff / domainRecords.length;
  }

  count(): number {
    return this.records.length;
  }
}
