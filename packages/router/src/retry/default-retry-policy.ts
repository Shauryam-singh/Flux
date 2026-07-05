import type { RetryPolicy } from "./retry-policy.js";

export class DefaultRetryPolicy implements RetryPolicy {
  public readonly maxAttempts = 3;

  public shouldRetry(_error: unknown, attempt: number): boolean {
    return attempt < this.maxAttempts;
  }

  public getDelayMs(attempt: number): number {
    return 250 * 2 ** (attempt - 1);
  }
}
