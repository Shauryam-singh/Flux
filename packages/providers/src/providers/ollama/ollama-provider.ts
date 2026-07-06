import { BaseProvider } from "../../base/base-provider.js";
import type { HttpClient } from "../../http/http-client.js";
import type { CompletionRequest } from "../../types/completion-request.js";
import type { CompletionResponse } from "../../types/completion-response.js";
import { DEFAULT_PROVIDER_METADATA } from "../../metadata/default-provider-metadata.js";
import type { ProviderCapabilities }
from "../../capabilities/provider-capabilities.js";

import type { ProviderModel }
from "../../models/provider-model.js";

import type {
  OllamaChatRequest,
  OllamaChatResponse,
  OllamaTagsResponse,
} from "./ollama-types.js";

export class OllamaProvider extends BaseProvider {
  private readonly baseUrl: string;

  public constructor(
    http: HttpClient,
    baseUrl = "http://localhost:11434",
  ) {
    super(
      "ollama",
      DEFAULT_PROVIDER_METADATA.ollama!,
      http,
    );

    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  public async isAvailable(): Promise<boolean> {
    try {
      await this.http.get<OllamaTagsResponse>(
        `${this.baseUrl}/api/tags`,
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
      streaming: false,
      tools: false,
      vision: false,
      embeddings: false,
      local: true,
    };
  }

  public getModels(): readonly ProviderModel[] {
    return [
      {
        id: "qwen2.5:0.5b",
        name: "Qwen 2.5 0.5B",
        contextWindow: 32768,
        maxOutputTokens: 8192,
        supportsVision: false,
        supportsTools: false,
        supportsStreaming: false,
        local: true,
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

        contextWindow: 32768,

        maxOutputTokens: 4096,

        vision: model.includes("vision"),

        toolCalling: true,

        embeddings: true,
      });
    }
  }

  public async listModels(): Promise<readonly string[]> {
    const response = await this.http.get<OllamaTagsResponse>(
      `${this.baseUrl}/api/tags`,
    );

    return response.data.models.map((model) => model.name);
  }

  public async complete(
    request: CompletionRequest,
    ): Promise<CompletionResponse> {
    const options =
        request.temperature !== undefined ||
        request.maxTokens !== undefined
        ? {
            ...(request.temperature !== undefined && {
                temperature: request.temperature,
            }),
            ...(request.maxTokens !== undefined && {
                num_predict: request.maxTokens,
            }),
            }
        : undefined;

    const body: OllamaChatRequest = {
        model: request.model,
        stream: false,
        messages: [
        {
            role: "user",
            content: request.prompt,
        },
        ],
        ...(options !== undefined && { options }),
    };

    const response =
        await this.http.post<OllamaChatResponse>(
        `${this.baseUrl}/api/chat`,
        body,
        );

    return {
        text: response.data.message.content,
        ...(response.data.prompt_eval_count !== undefined && {
        inputTokens: response.data.prompt_eval_count,
        }),
        ...(response.data.eval_count !== undefined && {
        outputTokens: response.data.eval_count,
        }),
        ...(response.data.done_reason !== undefined && {
        finishReason: response.data.done_reason,
        }),
    };
    }
}