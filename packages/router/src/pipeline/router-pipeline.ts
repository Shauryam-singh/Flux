import type { ExecutionContext } from "../context/execution-context.js";
import type { ExecutionResult } from "../context/execution-result.js";
import type { RouterMiddleware } from "../middleware/router-middleware.js";

export class RouterPipeline {
  public constructor(
    private readonly middleware: readonly RouterMiddleware[],
  ) {}

  public async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const dispatch = async (
      index: number,
      current: ExecutionContext,
    ): Promise<ExecutionResult> => {
      const middleware = this.middleware[index];

      if (!middleware) {
        throw new Error("Pipeline terminated unexpectedly.");
      }

      return middleware.execute(current, (nextContext) =>
        dispatch(index + 1, nextContext),
      );
    };

    return dispatch(0, context);
  }
}
