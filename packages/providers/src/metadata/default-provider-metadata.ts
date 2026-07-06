import type { ProviderMetadata } from "./provider-metadata.js";

export const DEFAULT_PROVIDER_METADATA: Record<
  string,
  ProviderMetadata
> = {
  ollama: {
    id: "ollama",

    displayName: "Ollama",

    website: "https://ollama.com",

    capabilities: {
      chat: true,

      streaming: true,

      toolCalling: true,

      vision: true,

      embeddings: true,

      functionCalling: true,

      jsonMode: true,

      local: true,
    },

    models: [],
  },

  openrouter: {
    id: "openrouter",

    displayName: "OpenRouter",

    website: "https://openrouter.ai",

    capabilities: {
      chat: true,

      streaming: true,

      toolCalling: true,

      vision: true,

      embeddings: false,

      functionCalling: true,

      jsonMode: true,

      local: false,
    },

    models: [],
  },
};