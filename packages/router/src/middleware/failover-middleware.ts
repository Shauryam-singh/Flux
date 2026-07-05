import type { ExecutionContext } from "../context/execution-context.js";
import type { ExecutionResult } from "../context/execution-result.js";
import type { FailoverPolicy } from "../failover/failover-policy.js";
import type { ProviderRegistry } from "../interfaces/provider-registry.js";
import type { RouterMiddleware } from "./router-middleware.js";

export class FailoverMiddleware implements RouterMiddleware {
  public constructor(
    private readonly registry: ProviderRegistry,
    private readonly policy: FailoverPolicy,
  ) {}

  public async execute(
    context: ExecutionContext,
    next: (context: ExecutionContext) => Promise<ExecutionResult>,
  ): Promise<ExecutionResult> {
    try {
      return await next(context);
    } catch {
      const provider = this.policy.next(
        context.provider,
        this.registry.getAll(),
      );

      if (!provider) {
        throw new Error("No failover provider available.");
      }

      return next({
        ...context,
        provider,
      });
    }
  }
}
