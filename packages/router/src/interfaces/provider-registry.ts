import type { Provider } from "@ai-agent/providers";

export interface ProviderRegistry {
  register(provider: Provider): void;

  unregister(name: string): void;

  get(name: string): Provider | undefined;

  getAll(): readonly Provider[];
}
