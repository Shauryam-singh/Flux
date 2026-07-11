import { AxiosHttpClient } from "../http/axios-http-client.js";

import type { Provider } from "../interfaces/provider.js";
import type { ProviderFactory } from "../interfaces/provider-factory.js";
import { AnthropicProvider } from "../providers/anthropic/anthropic-provider.js";
import { OllamaProvider } from "../providers/ollama/ollama-provider.js";
import { OpenAIProvider } from "../providers/openai/openai-provider.js";
import { OpenRouterProvider } from "../providers/openrouter/openrouter-provider.js";
import type { ProviderName } from "../types/provider-name.js";

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
}

export class DefaultProviderFactory implements ProviderFactory {
  private readonly http = new AxiosHttpClient();
  private readonly config: Partial<Record<ProviderName, ProviderConfig>>;

  public constructor(config?: Partial<Record<ProviderName, ProviderConfig>>) {
    this.config = config ?? {};
  }

  public create(name: ProviderName): Provider {
    const providerConfig = this.config[name] ?? {};

    switch (name.toLowerCase()) {
      case "ollama":
        return new OllamaProvider(
          this.http,
          providerConfig.baseUrl ?? "http://localhost:11434",
        );

      case "openai":
        return new OpenAIProvider(
          this.http,
          providerConfig.apiKey ?? process.env.OPENAI_API_KEY ?? "",
          providerConfig.baseUrl ?? "https://api.openai.com/v1",
        );

      case "anthropic":
        return new AnthropicProvider(
          this.http,
          providerConfig.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "",
          providerConfig.baseUrl ?? "https://api.anthropic.com",
        );

      case "openrouter":
        return new OpenRouterProvider(
          this.http,
          providerConfig.apiKey ?? process.env.OPENROUTER_API_KEY ?? "",
        );

      default:
        throw new Error(`Unknown provider: ${name}`);
    }
  }
}
