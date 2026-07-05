import type { ProviderName } from "../types/provider-name.js";
import type { Provider } from "./provider.js";

export interface ProviderRegistry {
  register(provider: Provider): void;

  get(name: ProviderName): Provider | undefined;

  getAll(): readonly Provider[];
}
