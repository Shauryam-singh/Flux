import type { ModelMetadata } from "./model-metadata.js";
import type { ProviderCapabilities } from "./provider-capabilities.js";

export interface ProviderMetadata {
  readonly id: string;

  readonly displayName: string;

  readonly website?: string;

  readonly capabilities: ProviderCapabilities;

  models: ModelMetadata[];
}
