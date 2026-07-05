import type { ExecutionContext } from "../context/execution-context.js";
import type { ExecutionResult } from "../context/execution-result.js";
import type { RouterMiddleware } from "./router-middleware.js";

export class TimeoutMiddleware implements RouterMiddleware {
  public constructor(private readonly timeoutMs: number) {}

  public async execute(
    context: ExecutionContext,
    next: (context: ExecutionContext) => Promise<ExecutionResult>,
  ): Promise<ExecutionResult> {
    const timer = globalThis.setTimeout(() => {
      context.abortController.abort();
    }, this.timeoutMs);

    try {
      return await next(context);
    } finally {
      globalThis.clearTimeout(timer);
    }
  }
}
