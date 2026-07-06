import { BaseProvider } from "../../base/base-provider.js";
import { DEFAULT_PROVIDER_METADATA } from "../../metadata/default-provider-metadata.js";

import type { HttpClient } from "../../http/http-client.js";

import type { CompletionRequest } from "../../types/completion-request.js";
import type { CompletionResponse } from "../../types/completion-response.js";
import { ProviderCapabilities } from "../../capabilities/provider-capabilities.js";
import { ProviderModel } from "../../models/provider-model.js";

interface OpenRouterModelsResponse {
  readonly data: readonly {
    id: string;
  }[];
}

interface OpenRouterChatResponse {
  readonly choices: readonly {
    message: {
      content: string;
    };

    finish_reason?: string;
  }[];

  readonly usage?: {
    prompt_tokens?: number;

    completion_tokens?: number;
  };
}

export class OpenRouterProvider extends BaseProvider {
  public getCapabilities(): ProviderCapabilities {
    return {
      chat: true,
      completion: true,
      streaming: true,
      tools: true,
      vision: true,
      embeddings: false,
      local: false,
    };
  }

  public getModels(): readonly ProviderModel[] {
    return [
      {
        id: "openai/gpt-4.1",
        name: "GPT-4.1",
        contextWindow: 1_048_576,
        maxOutputTokens: 32_768,
        supportsVision: true,
        supportsTools: true,
        supportsStreaming: true,
        local: false,
      },
      {
        id: "anthropic/claude-sonnet-4",
        name: "Claude Sonnet 4",
        contextWindow: 200_000,
        maxOutputTokens: 8_192,
        supportsVision: true,
        supportsTools: true,
        supportsStreaming: true,
        local: false,
      },
    ];
  }
  
  private readonly apiKey: string;

  private readonly baseUrl =
    "https://openrouter.ai/api/v1";

  public constructor(
    http: HttpClient,
    apiKey: string,
  ) {
    super(
      "openrouter",
      DEFAULT_PROVIDER_METADATA.openrouter!,
      http,
    );

    this.apiKey = apiKey;
  }

  public async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      await this.http.get<OpenRouterModelsResponse>(
        `${this.baseUrl}/models`,
        {
          headers: this.headers,
        },
      );

      return true;
    } catch {
      return false;
    }
  }

  public async listModels(): Promise<readonly string[]> {
    const response =
      await this.http.get<OpenRouterModelsResponse>(
        `${this.baseUrl}/models`,
        {
          headers: this.headers,
        },
      );

    return response.data.data.map(
      (model) => model.id,
    );
  }

  public async refreshMetadata(): Promise<void> {
    const models = await this.listModels();

    this.metadata.models.length = 0;

    for (const model of models) {
      this.metadata.models.push({
        id: model,

        displayName: model,

        contextWindow: 128000,

        maxOutputTokens: 4096,

        vision: true,

        toolCalling: true,

        embeddings: false,
      });
    }
  }

  public async complete(
    request: CompletionRequest,
  ): Promise<CompletionResponse> {
    const response =
      await this.http.post<OpenRouterChatResponse>(
        `${this.baseUrl}/chat/completions`,
        {
          model: request.model,

          messages: [
            {
              role: "user",
              content: request.prompt,
            },
          ],

          temperature: request.temperature,

          max_tokens: request.maxTokens,
        },
        {
          headers: this.headers,
        },
      );

    const choice = response.data.choices[0];

    if (!choice) {
      throw new Error("No choices in response");
    }
    
    const result: CompletionResponse = {
      text: choice.message.content,
    };

    if (
      response.data.usage?.prompt_tokens !==
      undefined
    ) {
      result.inputTokens =
        response.data.usage.prompt_tokens;
    }

    if (
      response.data.usage
        ?.completion_tokens !== undefined
    ) {
      result.outputTokens =
        response.data.usage.completion_tokens;
    }

    if (choice.finish_reason !== undefined) {
      result.finishReason =
        choice.finish_reason;
    }

    return result;
  }

  private get headers(): string {
    return `Bearer ${this.apiKey}`;
  }
}