import type { ExecutionContext } from "../context/execution-context.js";
import type { ExecutionResult } from "../context/execution-result.js";

export interface RouterMiddleware {
  execute(
    context: ExecutionContext,
    next: (context: ExecutionContext) => Promise<ExecutionResult>,
  ): Promise<ExecutionResult>;
}
