import type { ProviderName } from "../types/provider-name.js";
import type { Provider } from "./provider.js";

export interface ProviderFactory {
  create(provider: ProviderName): Promise<Provider>;
}
