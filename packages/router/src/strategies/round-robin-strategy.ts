import type { Provider } from "@ai-agent/providers";
import type { RoutingStrategy } from "../interfaces/routing-strategy.js";
import type { RouteRequest } from "../types/route-request.js";

export class RoundRobinStrategy implements RoutingStrategy {
  private index = 0;

  public async select(
    _request: RouteRequest,
    providers: readonly Provider[],
  ): Promise<Provider> {
    if (providers.length === 0) {
      throw new Error("No providers registered.");
    }

    const provider = providers[this.index];

    if (provider === undefined) {
      throw new Error("Failed to select a provider.");
    }

    this.index = (this.index + 1) % providers.length;

    return provider;
  }
}
