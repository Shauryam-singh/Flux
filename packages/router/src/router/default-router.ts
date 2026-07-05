import type { ExecutionContext } from "../context/execution-context.js";
import type { ProviderRegistry } from "../interfaces/provider-registry.js";
import type { Router } from "../interfaces/router.js";
import type { RoutingStrategy } from "../interfaces/routing-strategy.js";
import type { RouterPipeline } from "../pipeline/index.js";
import type { RouteRequest } from "../types/route-request.js";
import type { RouteResponse } from "../types/route-response.js";

export class DefaultRouter implements Router {
  public constructor(
    private readonly registry: ProviderRegistry,
    private readonly strategy: RoutingStrategy,
    private readonly pipeline: RouterPipeline,
  ) {}

  public async route(request: RouteRequest): Promise<RouteResponse> {
    const provider = await this.strategy.select(
      request,
      this.registry.getAll(),
    );

    const context: ExecutionContext = {
      request,
      provider,
      startedAt: new Date(),
      metadata: {},
      abortController: new AbortController(),
    };

    const result = await this.pipeline.execute(context);

    return result.response;
  }
}
