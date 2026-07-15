import { BaseProvider } from "../../base/base-provider.js";
import type { ProviderCapabilities } from "../../capabilities/provider-capabilities.js";
import type { HttpClient } from "../../http/http-client.js";
import { DEFAULT_PROVIDER_METADATA } from "../../metadata/default-provider-metadata.js";
import type { ProviderModel } from "../../models/provider-model.js";
import type { CompletionRequest } from "../../types/completion-request.js";
import type { CompletionResponse, StreamingCallbacks } from "../../types/completion-response.js";

import type {
  OllamaChatRequest,
  OllamaChatResponse,
  OllamaTagsResponse,
} from "./ollama-types.js";

export class OllamaProvider extends BaseProvider {
  private readonly baseUrl: string;

  public constructor(http: HttpClient, baseUrl = "http://localhost:11434") {
    super("ollama", DEFAULT_PROVIDER_METADATA.ollama!, http);

    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  public async isAvailable(): Promise<boolean> {
    try {
      await this.http.get<OllamaTagsResponse>(`${this.baseUrl}/api/tags`);

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
        supportsStreaming: true,
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
      request.temperature !== undefined || request.maxTokens !== undefined
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

    const response = await this.http.post<OllamaChatResponse>(
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

  public async completeStream(
    request: CompletionRequest,
    callbacks: StreamingCallbacks,
  ): Promise<void> {
    const options =
      request.temperature !== undefined || request.maxTokens !== undefined
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
      stream: true,
      messages: [
        {
          role: "user",
          content: request.prompt,
        },
      ],
      ...(options !== undefined && { options }),
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let fullText = "";
      let inputTokens: number | undefined;
      let outputTokens: number | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line) as OllamaChatResponse;

            if (data.message?.content) {
              fullText += data.message.content;
              callbacks.onToken?.(data.message.content);
            }

            if (data.prompt_eval_count !== undefined) {
              inputTokens = data.prompt_eval_count;
            }
            if (data.eval_count !== undefined) {
              outputTokens = data.eval_count;
            }

            if (data.done) {
              callbacks.onDone?.({
                text: fullText,
                ...(inputTokens !== undefined && { inputTokens }),
                ...(outputTokens !== undefined && { outputTokens }),
                ...(data.done_reason !== undefined && { finishReason: data.done_reason }),
              });
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    } catch (error) {
      callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
