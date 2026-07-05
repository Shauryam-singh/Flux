import type { AppConfig } from "./interfaces/app-config.js";

export const DEFAULT_CONFIG: AppConfig = {
  router: {
    retryCount: 3,
    requestTimeoutMs: 30_000,
    fallbackEnabled: true,
    strategy: "balanced",
  },

  providers: {
    openai: {
      enabled: true,
    },

    anthropic: {
      enabled: true,
    },

    gemini: {
      enabled: true,
    },

    ollama: {
      enabled: true,
      baseUrl: "http://localhost:11434",
    },
  },
};
