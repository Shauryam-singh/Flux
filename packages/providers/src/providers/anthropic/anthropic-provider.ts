import { BaseProvider } from "../../base/base-provider.js";
import type { ProviderCapabilities } from "../../capabilities/provider-capabilities.js";
import type { HttpClient } from "../../http/http-client.js";
import { DEFAULT_PROVIDER_METADATA } from "../../metadata/default-provider-metadata.js";
import type { ProviderModel } from "../../models/provider-model.js";
import type { CompletionRequest } from "../../types/completion-request.js";
import type { CompletionResponse } from "../../types/completion-response.js";

import type {
  AnthropicChatRequest,
  AnthropicChatResponse,
  AnthropicModelsResponse,
} from "./anthropic-types.js";

export class AnthropicProvider extends BaseProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  public constructor(
    http: HttpClient,
    apiKey: string,
    baseUrl = "https://api.anthropic.com",
  ) {
    super("anthropic", DEFAULT_PROVIDER_METADATA.anthropic!, http);
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  public async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      await this.http.get<AnthropicModelsResponse>(
        `${this.baseUrl}/v1/models`,
        {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
      );
      return true;
    } catch {
      return false;
    }
  }

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
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        contextWindow: 200000,
        maxOutputTokens: 8192,
        supportsVision: true,
        supportsTools: true,
        supportsStreaming: true,
        local: false,
      },
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        contextWindow: 200000,
        maxOutputTokens: 8192,
        supportsVision: true,
        supportsTools: true,
        supportsStreaming: true,
        local: false,
      },
      {
        id: "claude-3-5-haiku-20241022",
        name: "Claude 3.5 Haiku",
        contextWindow: 200000,
        maxOutputTokens: 8192,
        supportsVision: true,
        supportsTools: true,
        supportsStreaming: true,
        local: false,
      },
    ];
  }

  public async refreshMetadata(): Promise<void> {
    const models = await this.listModels();

    this.metadata.models.length = 0;

    for (const model of models) {
      this.metadata.models.push({
        id: model,
        displayName: model,
        contextWindow: 200000,
        maxOutputTokens: 8192,
        vision: true,
        toolCalling: true,
        embeddings: false,
      });
    }
  }

  public async listModels(): Promise<readonly string[]> {
    const response = await this.http.get<AnthropicModelsResponse>(
      `${this.baseUrl}/v1/models`,
      {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
    );

    return response.data.data.map((model) => model.id);
  }

  public async complete(
    request: CompletionRequest,
  ): Promise<CompletionResponse> {
    const body: AnthropicChatRequest = {
      model: request.model,
      max_tokens: request.maxTokens ?? 4096,
      messages: [
        {
          role: "user",
          content: request.prompt,
        },
      ],
      stream: false,
      ...(request.temperature !== undefined && {
        temperature: request.temperature,
      }),
    };

    const response = await this.http.post<AnthropicChatResponse>(
      `${this.baseUrl}/v1/messages`,
      body,
      {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
    );

    const contentBlock = response.data.content[0];

    if (!contentBlock) {
      throw new Error("No content in response");
    }

    const result: CompletionResponse = {
      text: contentBlock.text,
    };

    if (response.data.usage?.input_tokens !== undefined) {
      result.inputTokens = response.data.usage.input_tokens;
    }

    if (response.data.usage?.output_tokens !== undefined) {
      result.outputTokens = response.data.usage.output_tokens;
    }

    if (response.data.stop_reason !== undefined) {
      result.finishReason = response.data.stop_reason;
    }

    return result;
  }
}
