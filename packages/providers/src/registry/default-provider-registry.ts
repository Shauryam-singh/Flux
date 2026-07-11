import type { Provider } from "../interfaces/provider.js";
import type { ProviderRegistry } from "../interfaces/provider-registry.js";

import type { ProviderName } from "../types/provider-name.js";

export class DefaultProviderRegistry implements ProviderRegistry {
  private readonly providers = new Map<ProviderName, Provider>();

  public register(provider: Provider): void {
    this.providers.set(provider.name, provider);
  }

  public unregister(name: ProviderName): void {
    this.providers.delete(name);
  }

  public get(name: ProviderName): Provider | undefined {
    return this.providers.get(name);
  }

  public has(name: ProviderName): boolean {
    return this.providers.has(name);
  }

  public clear(): void {
    this.providers.clear();
  }

  public list(): readonly Provider[] {
    return [...this.providers.values()];
  }
}
