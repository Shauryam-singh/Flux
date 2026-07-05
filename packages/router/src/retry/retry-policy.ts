export interface RetryPolicy {
  shouldRetry(error: unknown, attempt: number): boolean;

  getDelayMs(attempt: number): number;

  readonly maxAttempts: number;
}
