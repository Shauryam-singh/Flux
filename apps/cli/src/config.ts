import { loadConfig, type AppConfig } from "@ai-agent/config";
import type { ProviderName } from "@ai-agent/providers";

export interface AppConfig2 {
  app: AppConfig;
  providerConfigs: Partial<
    Record<ProviderName, { apiKey?: string; baseUrl?: string }>
  >;
}

export function loadAppConfig(): AppConfig2 {
  const app = loadConfig();

  const providerConfigs: Partial<
    Record<ProviderName, { apiKey?: string; baseUrl?: string }>
  > = {
    ollama: {
      ...(app.providers.ollama.baseUrl && {
        baseUrl: app.providers.ollama.baseUrl,
      }),
    },
    openai: {
      ...(app.providers.openai.apiKey && {
        apiKey: app.providers.openai.apiKey,
      }),
      ...(app.providers.openai.baseUrl && {
        baseUrl: app.providers.openai.baseUrl,
      }),
    },
    anthropic: {
      ...(app.providers.anthropic.apiKey && {
        apiKey: app.providers.anthropic.apiKey,
      }),
      ...(app.providers.anthropic.baseUrl && {
        baseUrl: app.providers.anthropic.baseUrl,
      }),
    },
  };

  return { app, providerConfigs };
}
