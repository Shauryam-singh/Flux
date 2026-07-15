import * as fs from "node:fs";
import * as path from "node:path";

import { DEFAULT_CONFIG } from "./defaults.js";
import type { AppConfig } from "./interfaces/app-config.js";
import { validateConfig } from "./validator.js";

const SETTINGS_FILE = "settings.json";

function getSettingsPath(): string {
  const cwd = process.cwd();
  const rootDir = path.resolve(cwd, "../..");
  return path.join(rootDir, SETTINGS_FILE);
}

export function loadConfig(): AppConfig {
  const settingsPath = getSettingsPath();

  if (fs.existsSync(settingsPath)) {
    try {
      const raw = fs.readFileSync(settingsPath, "utf-8");
      const settings = JSON.parse(raw) as Partial<AppConfig>;

      const config: AppConfig = {
        router: {
          ...DEFAULT_CONFIG.router,
          ...settings.router,
        },
        providers: {
          openai: {
            ...DEFAULT_CONFIG.providers.openai,
            ...settings.providers?.openai,
          },
          anthropic: {
            ...DEFAULT_CONFIG.providers.anthropic,
            ...settings.providers?.anthropic,
          },
          gemini: {
            ...DEFAULT_CONFIG.providers.gemini,
            ...settings.providers?.gemini,
          },
          ollama: {
            ...DEFAULT_CONFIG.providers.ollama,
            ...settings.providers?.ollama,
          },
        },
      };

      validateConfig(config);
      return config;
    } catch {
      console.warn("Failed to load settings.json, using defaults");
    }
  }

  return createDefaultConfig();
}

export function createDefaultConfig(): AppConfig {
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

export function saveConfig(config: AppConfig): void {
  const settingsPath = getSettingsPath();
  const dir = path.dirname(settingsPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const content = JSON.stringify(config, null, 2);
  fs.writeFileSync(settingsPath, content, "utf-8");
}

export function getSettingsPath$(): string {
  return getSettingsPath();
}
