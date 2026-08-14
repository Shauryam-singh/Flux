import { AxiosHttpClient } from "../http/axios-http-client.js";

import type { Provider } from "../interfaces/provider.js";
import type { ProviderFactory } from "../interfaces/provider-factory.js";
import { AnthropicProvider } from "../providers/anthropic/anthropic-provider.js";
import { OllamaProvider } from "../providers/ollama/ollama-provider.js";
import type { OllamaProviderConfig } from "../providers/ollama/ollama-types.js";
import { OpenAIProvider } from "../providers/openai/openai-provider.js";
import { OpenRouterProvider } from "../providers/openrouter/openrouter-provider.js";
import type { ProviderName } from "../types/provider-name.js";

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  // Ollama-specific config
  num_ctx?: number;
  num_gpu?: number;
  num_thread?: number;
  keep_alive?: string;
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
      case "ollama": {
        const ollamaConfig: OllamaProviderConfig = {
          baseUrl: providerConfig.baseUrl ?? "http://localhost:11434",
          ...(providerConfig.num_ctx !== undefined && { num_ctx: providerConfig.num_ctx }),
          ...(providerConfig.num_gpu !== undefined && { num_gpu: providerConfig.num_gpu }),
          ...(providerConfig.num_thread !== undefined && { num_thread: providerConfig.num_thread }),
          ...(providerConfig.keep_alive !== undefined && { keep_alive: providerConfig.keep_alive }),
        };
        return new OllamaProvider(
          this.http,
          ollamaConfig.baseUrl,
          ollamaConfig,
        );
      }

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
