import type { ExecutionContext } from "../context/execution-context.js";
import type { ExecutionResult } from "../context/execution-result.js";
import type { RetryPolicy } from "../retry/retry-policy.js";
import type { RouterMiddleware } from "./router-middleware.js";

export class RetryMiddleware implements RouterMiddleware {
  public constructor(private readonly policy: RetryPolicy) {}

  public async execute(
    context: ExecutionContext,
    next: () => Promise<ExecutionResult>,
  ): Promise<ExecutionResult> {
    let attempt = 1;

    while (true) {
      try {
        return await next();
      } catch (error) {
        if (!this.policy.shouldRetry(error, attempt)) {
          throw error;
        }

        const delay = this.policy.getDelayMs(attempt);

        await new Promise<void>((resolve) => {
          setTimeout(resolve, delay);
        });

        attempt++;
      }
    }
  }
}
