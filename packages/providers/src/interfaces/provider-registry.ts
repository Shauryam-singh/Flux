import type { ProviderName } from "../types/provider-name.js";
import type { Provider } from "./provider.js";

export interface ProviderRegistry {
  register(provider: Provider): void;

  unregister(name: ProviderName): void;

  get(name: ProviderName): Provider | undefined;

  has(name: ProviderName): boolean;

  clear(): void;

  list(): readonly Provider[];
}
