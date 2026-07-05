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

    const response = await provider.complete(request.request);

    return {
      provider: provider.name,
      response,
    };
  }
}
