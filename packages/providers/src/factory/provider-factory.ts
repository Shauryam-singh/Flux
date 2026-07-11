import type { Provider } from "../interfaces/provider.js";

export interface ProviderFactory {
  create(name: string): Provider;
}
