import type { ProviderRegistry } from "../interfaces/provider-registry.js";
import type { Router } from "../interfaces/router.js";
import type { RouteRequest } from "../types/route-request.js";
import type { RouteResponse } from "../types/route-response.js";

export class DefaultRouter implements Router {
  public constructor(private readonly registry: ProviderRegistry) {}

  public async route(request: RouteRequest): Promise<RouteResponse> {
    const provider = this.registry.get(request.provider);

    if (!provider) {
      throw new Error(`Provider '${request.provider}' is not registered.`);
    }

    const response = await provider.complete(request.request);

    return {
      provider: provider.name,
      response,
    };
  }
}
