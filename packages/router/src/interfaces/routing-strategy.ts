import type { Provider } from "@ai-agent/providers";
import type { RouteRequest } from "../types/route-request.js";

export interface RoutingStrategy {
  select(
    request: RouteRequest,
    providers: readonly Provider[],
  ): Promise<Provider>;
}
