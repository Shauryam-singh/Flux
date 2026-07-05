import type { ExecutionContext } from "../context/execution-context.js";
import type { ExecutionResult } from "../context/execution-result.js";
import type { RouterMiddleware } from "./router-middleware.js";

export class ProviderExecutionMiddleware implements RouterMiddleware {
  public async execute(
    context: ExecutionContext,
    _next: (context: ExecutionContext) => Promise<ExecutionResult>,
  ): Promise<ExecutionResult> {
    const response = await context.provider.complete(context.request.request);

    return {
      response: {
        provider: context.provider.name,
        response,
      },
      durationMs: Date.now() - context.startedAt.getTime(),
    };
  }
}
