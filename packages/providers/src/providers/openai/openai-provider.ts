import { BaseProvider } from "../../base/base-provider.js";
import type { ProviderCapabilities } from "../../capabilities/provider-capabilities.js";
import type { HttpClient } from "../../http/http-client.js";
import { DEFAULT_PROVIDER_METADATA } from "../../metadata/default-provider-metadata.js";
import type { ProviderModel } from "../../models/provider-model.js";
import type { CompletionRequest } from "../../types/completion-request.js";
import type { CompletionResponse, StreamingCallbacks } from "../../types/completion-response.js";

import type {
  OpenAIChatRequest,
  OpenAIChatResponse,
  OpenAIModelsResponse,
} from "./openai-types.js";

export class OpenAIProvider extends BaseProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  public constructor(
    http: HttpClient,
    apiKey: string,
    baseUrl = "https://api.openai.com/v1",
  ) {
    super("openai", DEFAULT_PROVIDER_METADATA.openai!, http);
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  public async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      await this.http.get<OpenAIModelsResponse>(`${this.baseUrl}/models`, {
        Authorization: `Bearer ${this.apiKey}`,
      });
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
        id: "gpt-4o",
        name: "GPT-4o",
        contextWindow: 128000,
        maxOutputTokens: 16384,
        supportsVision: true,
        supportsTools: true,
        supportsStreaming: true,
        local: false,
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        contextWindow: 128000,
        maxOutputTokens: 16384,
        supportsVision: true,
        supportsTools: true,
        supportsStreaming: true,
        local: false,
      },
      {
        id: "gpt-4-turbo",
        name: "GPT-4 Turbo",
        contextWindow: 128000,
        maxOutputTokens: 4096,
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
        contextWindow: 128000,
        maxOutputTokens: 4096,
        vision: true,
        toolCalling: true,
        embeddings: false,
      });
    }
  }

  public async listModels(): Promise<readonly string[]> {
    const response = await this.http.get<OpenAIModelsResponse>(
      `${this.baseUrl}/models`,
      {
        Authorization: `Bearer ${this.apiKey}`,
      },
    );

    return response.data.data.map((model) => model.id);
  }

  public async complete(
    request: CompletionRequest,
  ): Promise<CompletionResponse> {
    const body: OpenAIChatRequest = {
      model: request.model,
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
      ...(request.maxTokens !== undefined && {
        max_tokens: request.maxTokens,
      }),
    };

    const response = await this.http.post<OpenAIChatResponse>(
      `${this.baseUrl}/chat/completions`,
      body,
      {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    );

    const choice = response.data.choices[0];

    if (!choice) {
      throw new Error("No choices in response");
    }

    const result: CompletionResponse = {
      text: choice.message.content,
    };

    if (response.data.usage?.prompt_tokens !== undefined) {
      result.inputTokens = response.data.usage.prompt_tokens;
    }

    if (response.data.usage?.completion_tokens !== undefined) {
      result.outputTokens = response.data.usage.completion_tokens;
    }

    if (choice.finish_reason !== undefined) {
      result.finishReason = choice.finish_reason;
    }

    return result;
  }

  public async completeStream(
    request: CompletionRequest,
    callbacks: StreamingCallbacks,
  ): Promise<void> {
    const body: OpenAIChatRequest = {
      model: request.model,
      messages: [
        {
          role: "user",
          content: request.prompt,
        },
      ],
      stream: true,
      ...(request.temperature !== undefined && {
        temperature: request.temperature,
      }),
      ...(request.maxTokens !== undefined && {
        max_tokens: request.maxTokens,
      }),
    };

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              callbacks.onDone?.({
                text: fullText,
              });
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullText += content;
                callbacks.onToken?.(content);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      callbacks.onDone?.({
        text: fullText,
      });
    } catch (error) {
      callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
