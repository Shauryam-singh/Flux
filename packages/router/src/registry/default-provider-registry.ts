import type { Provider } from "@ai-agent/providers";
import type { ProviderRegistry } from "../interfaces/provider-registry.js";

export class DefaultProviderRegistry implements ProviderRegistry {
  private readonly providers = new Map<string, Provider>();

  register(provider: Provider): void {
    this.providers.set(provider.name, provider);
  }

  unregister(name: string): void {
    this.providers.delete(name);
  }

  get(name: string): Provider | undefined {
    return this.providers.get(name);
  }

  getAll(): readonly Provider[] {
    return [...this.providers.values()];
  }
}
