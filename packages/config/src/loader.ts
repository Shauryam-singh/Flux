import { DEFAULT_CONFIG } from "./defaults.js";
import { validateConfig } from "./validator.js";
import type { AppConfig } from "./interfaces/app-config.js";

export function loadConfig(): AppConfig {
  const config = structuredClone(DEFAULT_CONFIG);

  validateConfig(config);

  return config;
}