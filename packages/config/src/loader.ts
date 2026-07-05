import { DEFAULT_CONFIG } from "./defaults.js";
import type { AppConfig } from "./interfaces/app-config.js";
import { validateConfig } from "./validator.js";

export function loadConfig(): AppConfig {
  const config: AppConfig = {
    router: {
      ...DEFAULT_CONFIG.router,
    },
    providers: {
      openai: { ...DEFAULT_CONFIG.providers.openai },
      anthropic: { ...DEFAULT_CONFIG.providers.anthropic },
      gemini: { ...DEFAULT_CONFIG.providers.gemini },
      ollama: { ...DEFAULT_CONFIG.providers.ollama },
    },
  };

  validateConfig(config);

  return config;
}
