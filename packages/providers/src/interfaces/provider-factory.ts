import type { Provider } from "./provider.js";
import type { ProviderName } from "../types/provider-name.js";

export interface ProviderFactory {
  create(name: ProviderName): Provider;
}