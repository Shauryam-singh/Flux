import type { ExecutionContext } from "../context/execution-context.js";
import type { ExecutionResult } from "../context/execution-result.js";
import type { ProviderRegistry } from "../interfaces/provider-registry.js";
import type { Router } from "../interfaces/router.js";
import type { RoutingStrategy } from "../interfaces/routing-strategy.js";
import type { RouteRequest } from "../types/route-request.js";
import type { RouteResponse } from "../types/route-response.js";

export class DefaultRouter implements Router {
  public constructor(
    private readonly registry: ProviderRegistry,
    private readonly strategy: RoutingStrategy,
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
    };

    const response = await provider.complete(context.request.request);

    const durationMs = Date.now() - context.startedAt.getTime();

    const result: ExecutionResult = {
      response: {
        provider: provider.name,
        response,
      },
      durationMs,
    };

    return result.response;
  }
}
