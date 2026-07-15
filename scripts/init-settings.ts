import * as fs from "node:fs";
import * as path from "node:path";

const SETTINGS_FILE = "settings.json";

const defaultSettings = {
  router: {
    retryCount: 3,
    requestTimeoutMs: 30000,
    fallbackEnabled: true,
    strategy: "balanced",
  },
  providers: {
    openai: {
      enabled: true,
      apiKey: "",
      baseUrl: "https://api.openai.com/v1",
      defaultModel: "gpt-4o",
    },
    anthropic: {
      enabled: true,
      apiKey: "",
      baseUrl: "https://api.anthropic.com",
      defaultModel: "claude-sonnet-4-20250514",
    },
    gemini: {
      enabled: false,
      apiKey: "",
      baseUrl: "https://generativelanguage.googleapis.com",
      defaultModel: "gemini-pro",
    },
    ollama: {
      enabled: true,
      baseUrl: "http://localhost:11434",
      defaultModel: "qwen2.5:0.5b",
    },
  },
};

function initSettings(): void {
  const rootDir = path.resolve(process.cwd(), "../..");
  const settingsPath = path.join(rootDir, SETTINGS_FILE);

  if (fs.existsSync(settingsPath)) {
    console.log(`✓ ${SETTINGS_FILE} already exists at ${rootDir}`);
    return;
  }

  const content = JSON.stringify(defaultSettings, null, 2);
  fs.writeFileSync(settingsPath, content, "utf-8");
  console.log(`✓ Created ${SETTINGS_FILE} at ${rootDir}`);
  console.log("  Edit this file to add your API keys");
}

initSettings();
