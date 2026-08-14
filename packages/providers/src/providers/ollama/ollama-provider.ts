import { execSync } from "node:child_process";
import * as os from "node:os";
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
  OllamaProviderConfig,
  OllamaTagsResponse,
} from "./ollama-types.js";

// Platform capability detection
interface PlatformCapabilities {
  hasNvidiaGPU: boolean;
  hasAMDGPU: boolean;
  gpuType: "nvidia" | "amd" | "none";
  cpuThreads: number;
  isArchLinux: boolean;
}

function detectPlatformCapabilities(): PlatformCapabilities {
  const cpuThreads = Math.max(1, os.cpus().length);
  let hasNvidiaGPU = false;
  let hasAMDGPU = false;
  let isArchLinux = false;

  // Detect NVIDIA GPU
  try {
    if (process.platform === "win32") {
      // Windows: check for nvidia-smi
      execSync("nvidia-smi", { stdio: "ignore", timeout: 2000 });
      hasNvidiaGPU = true;
    } else if (process.platform === "linux") {
      // Linux: check for nvidia-smi or /proc/driver/nvidia
      try {
        execSync("nvidia-smi", { stdio: "ignore", timeout: 2000 });
        hasNvidiaGPU = true;
      } catch {
        // Check for NVIDIA driver via /proc
        try {
          execSync("ls /proc/driver/nvidia/gpus", { stdio: "ignore", timeout: 1000 });
          hasNvidiaGPU = true;
        } catch {
          // No NVIDIA GPU
        }
      }
    }
  } catch {
    // nvidia-smi not available
  }

  // Detect AMD GPU (ROCm)
  try {
    if (process.platform === "linux") {
      execSync("rocm-smi", { stdio: "ignore", timeout: 2000 });
      hasAMDGPU = true;
    }
  } catch {
    // ROCm not available
  }

  // Detect Arch Linux
  if (process.platform === "linux") {
    try {
      const osRelease = execSync("cat /etc/os-release", {
        encoding: "utf-8",
        timeout: 1000,
      });
      isArchLinux = osRelease.includes("Arch Linux");
    } catch {
      // Not Arch Linux or can't read os-release
    }
  }

  const gpuType = hasNvidiaGPU ? "nvidia" : hasAMDGPU ? "amd" : "none";

  return {
    hasNvidiaGPU,
    hasAMDGPU,
    gpuType,
    cpuThreads,
    isArchLinux,
  };
}

export class OllamaProvider extends BaseProvider {
  private readonly baseUrl: string;
  private readonly config: OllamaProviderConfig;
  private readonly capabilities: PlatformCapabilities;

  public constructor(http: HttpClient, baseUrl = "http://localhost:11434", config?: OllamaProviderConfig) {
    super("ollama", DEFAULT_PROVIDER_METADATA.ollama!, http);

    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.config = config ?? {};
    this.capabilities = detectPlatformCapabilities();

    // Log detected capabilities
    console.log(
      `[ollama] Platform: ${process.platform}, GPU: ${this.capabilities.gpuType}, CPU threads: ${this.capabilities.cpuThreads}, Arch Linux: ${this.capabilities.isArchLinux}`,
    );
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
      vision: true,
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
        supportsTools: true,
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

  /**
   * Get optimal Ollama options based on platform capabilities and config
   */
  private getOptimalOptions(): Record<string, unknown> {
    const opts: Record<string, unknown> = {};

    // Context window size
    opts.num_ctx = this.config.num_ctx ?? 4096;

    // GPU layers - use all layers if GPU available
    if (this.config.num_gpu !== undefined) {
      opts.num_gpu = this.config.num_gpu;
    } else if (this.capabilities.hasNvidiaGPU || this.capabilities.hasAMDGPU) {
      opts.num_gpu = 999; // Offload all layers to GPU
    } else {
      opts.num_gpu = 0; // CPU only
    }

    // CPU threads - optimize based on platform
    if (this.config.num_thread !== undefined) {
      opts.num_thread = this.config.num_thread;
    } else if (this.capabilities.isArchLinux) {
      // Arch Linux: use all cores for maximum performance
      opts.num_thread = this.capabilities.cpuThreads;
    } else if (process.platform === "win32") {
      // Windows: limit to 8 threads max to avoid context switching overhead
      opts.num_thread = Math.min(8, this.capabilities.cpuThreads);
    } else {
      // Default: use all cores minus one
      opts.num_thread = Math.max(1, this.capabilities.cpuThreads - 1);
    }

    // Sampling parameters for better quality
    opts.repeat_penalty = 1.1;
    opts.top_k = 40;
    opts.top_p = 0.9;

    return opts;
  }

  /**
   * Get keep_alive setting for model residency
   */
  private getKeepAlive(): string {
    if (this.config.keep_alive !== undefined) {
      return this.config.keep_alive;
    }
    // Arch Linux: longer keep-alive for rolling release
    if (this.capabilities.isArchLinux) {
      return "10m";
    }
    // Default: 5 minutes
    return "5m";
  }

  public async complete(
    request: CompletionRequest,
  ): Promise<CompletionResponse> {
    const messages =
      request.messages && request.messages.length > 0
        ? request.messages
        : [{ role: "user", content: request.prompt }];

    // Get optimal options for this platform
    const baseOpts = this.getOptimalOptions();

    // qwen3 sometimes ignores options.think=false and burns the whole
    // num_predict budget on its reasoning trace, returning an empty answer
    // with done_reason="length". Retry once with a bigger budget so the
    // trace finishes and the real answer still fits.
    let lastReason: string | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      const options = {
        // Disable chain-of-thought thinking (qwen3 defaults to it), which
        // roughly halves latency for chat requests. Lives inside `options` —
        // a top-level `think` field is ignored on some Ollama builds.
        think: false,
        ...(request.temperature !== undefined && {
          temperature: request.temperature,
        }),
        // 2nd attempt doubles the cap so a runaway reasoning trace can't
        // starve the actual reply.
        num_predict: (request.maxTokens ?? 300) * (attempt === 0 ? 1 : 2),
        ...baseOpts,
      };

      const body: OllamaChatRequest = {
        model: request.model,
        stream: false,
        messages: messages.map((m) => ({
          role: (m.role === "system" || m.role === "assistant" ? m.role : "user") as "system" | "user" | "assistant",
          content: m.content,
          ...(request.images && request.images.length > 0 && { images: request.images }),
        })),
        options,
        keep_alive: this.getKeepAlive(),
      };

      const tHttp = Date.now();
      const response = await this.http.post<OllamaChatResponse>(
        `${this.baseUrl}/api/chat`,
        body,
      );
      console.log(
        `[timing] ollama.complete http=${Date.now() - tHttp}ms model=${request.model} promptLen=${request.prompt.length} attempt=${attempt + 1} gpu=${baseOpts.num_gpu} threads=${baseOpts.num_thread} head=${request.prompt.slice(0, 60).replace(/\n/g, " ")}`,
      );

      lastReason = response.data.done_reason;
      const raw = response.data.message.content ?? "";
      const text = stripThinking(raw);
      if (text.length > 0) {
        return {
          text,
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
      console.log(
        `[ollama.complete] empty response (reason=${response.data.done_reason}), retrying with larger num_predict`,
      );
    }

    return {
      text: "",
      ...(lastReason !== undefined && { finishReason: lastReason }),
    };
  }

  public async completeStream(
    request: CompletionRequest,
    callbacks: StreamingCallbacks,
  ): Promise<void> {
    // Get optimal options for this platform
    const baseOpts = this.getOptimalOptions();

    const options = {
      // Disable chain-of-thought thinking (qwen3 defaults to it), which
      // roughly halves latency for chat requests. Lives inside `options` —
      // a top-level `think` field is ignored on some Ollama builds.
      think: false,
      ...(request.temperature !== undefined && {
        temperature: request.temperature,
      }),
      ...(request.maxTokens !== undefined && {
        num_predict: request.maxTokens,
      }),
      ...baseOpts,
    };

    const messages =
      request.messages && request.messages.length > 0
        ? request.messages
        : [{ role: "user", content: request.prompt }];

    const body: OllamaChatRequest = {
      model: request.model,
      stream: true,
      messages: messages.map((m) => ({
        role: (m.role === "system" || m.role === "assistant" ? m.role : "user") as "system" | "user" | "assistant",
        content: m.content,
        ...(request.images && request.images.length > 0 && { images: request.images }),
      })),
      options,
      keep_alive: this.getKeepAlive(),
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
              const stripped = stripThinking(fullText);
              console.log(
                `[ollama.stream] done fullTextLen=${fullText.length} strippedLen=${stripped.length} reason=${data.done_reason} gpu=${baseOpts.num_gpu} threads=${baseOpts.num_thread}`,
              );
              callbacks.onDone?.({
                text: stripped,
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
      console.log(
        `[ollama.stream] ERROR ${error instanceof Error ? error.message : String(error)}`,
      );
      callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

// qwen3 and other thinking models sometimes leak their reasoning trace into
// `message.content` (wrapped in <think>...</think>), even with thinking
// disabled. Strip the trace so the user only ever sees the actual answer.
function stripThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^[\s\n]*/, "")
    .trim();
}
