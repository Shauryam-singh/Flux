import type { Provider } from "@ai-agent/providers";

export interface RoutingStrategy {
  select(providers: readonly Provider[]): Promise<Provider>;
}
