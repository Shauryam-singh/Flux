import type { Provider } from "@ai-agent/providers";
import type { RoutingStrategy } from "../interfaces/routing-strategy.js";
import type { RouteRequest } from "../types/route-request.js";

export class RandomStrategy implements RoutingStrategy {
  public async select(
    _request: RouteRequest,
    providers: readonly Provider[],
  ): Promise<Provider> {
    if (providers.length === 0) {
      throw new Error("No providers registered.");
    }

    const index = Math.floor(Math.random() * providers.length);
    const provider = providers[index];

    if (provider === undefined) {
      throw new Error("Failed to select a provider.");
    }

    return provider;
  }
}
