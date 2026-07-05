import type { Provider } from "@ai-agent/providers";
import type { RoutingStrategy } from "../interfaces/routing-strategy.js";
import type { RouteRequest } from "../types/route-request.js";

export class ManualStrategy implements RoutingStrategy {
  public async select(
    request: RouteRequest,
    providers: readonly Provider[],
  ): Promise<Provider> {
    const provider = providers.find(
      (provider) => provider.name === request.provider,
    );

    if (!provider) {
      throw new Error(`Provider '${request.provider}' not found.`);
    }

    return provider;
  }
}
