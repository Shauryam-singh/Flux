import type { Provider } from "./provider.js";

export interface ProviderManager {
  register(name: string): void;

  get(name: string): Provider;

  has(name: string): boolean;

  list(): readonly Provider[];
}
