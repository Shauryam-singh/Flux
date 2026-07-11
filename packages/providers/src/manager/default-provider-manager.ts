import type { Provider } from "../interfaces/provider.js";
import type { ProviderFactory } from "../interfaces/provider-factory.js";
import type { ProviderManager } from "../interfaces/provider-manager.js";

export class DefaultProviderManager implements ProviderManager {
  private readonly providers = new Map<string, Provider>();

  public constructor(private readonly factory: ProviderFactory) {}

  public register(name: string): void {
    if (this.providers.has(name)) {
      return;
    }

    const provider = this.factory.create(name as any);

    this.providers.set(name, provider);
  }

  public get(name: string): Provider {
    const provider = this.providers.get(name);

    if (!provider) {
      throw new Error(`Provider '${name}' is not registered.`);
    }

    return provider;
  }

  public has(name: string): boolean {
    return this.providers.has(name);
  }

  public list(): readonly Provider[] {
    return [...this.providers.values()];
  }
}
