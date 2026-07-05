import type { ProviderConfig } from "./provider-config.js";
import type { RouterConfig } from "./router-config.js";

export interface AppConfig {
  router: RouterConfig;

  providers: {
    openai: ProviderConfig;

    anthropic: ProviderConfig;

    gemini: ProviderConfig;

    ollama: ProviderConfig;
  };
}