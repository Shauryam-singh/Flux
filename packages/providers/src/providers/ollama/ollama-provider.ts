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

async function execWithTimeout(cmd: string, timeout: number): Promise<boolean> {
  try {
    const { execSync } = await import("node:child_process");
    execSync(cmd, { stdio: "ignore", timeout });
    return true;
  } catch {
    return false;
  }
}

async function detectPlatformCapabilitiesAsync(): Promise<PlatformCapabilities> {
  const cpuThreads = Math.max(1, os.cpus().length);
  let hasNvidiaGPU = false;
  let hasAMDGPU = false;
  let isArchLinux = false;

  // Detect NVIDIA GPU (async with timeout)
  if (process.platform === "win32") {
    hasNvidiaGPU = await execWithTimeout("nvidia-smi", 2000);
  } else if (process.platform === "linux") {
    hasNvidiaGPU = await execWithTimeout("nvidia-smi", 2000);
    if (!hasNvidiaGPU) {
      try {
        const { execSync } = await import("node:child_process");
        execSync("ls /proc/driver/nvidia/gpus", { stdio: "ignore", timeout: 1000 });
        hasNvidiaGPU = true;
      } catch {}
    }
  }

  // Detect AMD GPU (ROCm) - Linux only
  if (process.platform === "linux") {
    hasAMDGPU = await execWithTimeout("rocm-smi", 2000);
  }

  // Detect Arch Linux
  if (process.platform === "linux") {
    try {
      const { execSync } = await import("node:child_process");
      const osRelease = execSync("cat /etc/os-release", {
        encoding: "utf-8",
        timeout: 1000,
      });
      isArchLinux = osRelease.includes("Arch Linux");
    } catch {}
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
  private _platformCaps: PlatformCapabilities | null = null;
  private _platformCapsPromise: Promise<PlatformCapabilities> | null = null;

  public constructor(http: HttpClient, baseUrl = "http://localhost:11434", config?: OllamaProviderConfig) {
    super("ollama", DEFAULT_PROVIDER_METADATA.ollama!, http);

    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.config = config ?? {};
    // Lazy detection - don't block constructor
  }

  /**
   * Get platform capabilities with lazy detection (non-blocking).
   * First call triggers async detection; subsequent calls return cached result.
   */
  private async getPlatformCaps(): Promise<PlatformCapabilities> {
    if (this._platformCaps) return this._platformCaps;
    if (this._platformCapsPromise) return this._platformCapsPromise;

    this._platformCapsPromise = detectPlatformCapabilitiesAsync();
    this._platformCaps = await this._platformCapsPromise;
    console.log(
      `[ollama] Platform: ${process.platform}, GPU: ${this._platformCaps.gpuType}, CPU threads: ${this._platformCaps.cpuThreads}, Arch Linux: ${this._platformCaps.isArchLinux}`,
    );
    return this._platformCaps;
  }

  /**
   * Synchronous fallback for methods that can't be async.
   * Returns defaults if detection hasn't completed yet.
   */
  private getPlatformCapsSync(): PlatformCapabilities {
    if (this._platformCaps) return this._platformCaps;
    // Return safe defaults while async detection runs
    return {
      hasNvidiaGPU: false,
      hasAMDGPU: false,
      gpuType: "none",
      cpuThreads: Math.max(1, os.cpus().length),
      isArchLinux: false,
    };
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
  private async getOptimalOptions(): Promise<Record<string, unknown>> {
    const capabilities = await this.getPlatformCaps();
    const opts: Record<string, unknown> = {};

    // Context window size
    opts.num_ctx = this.config.num_ctx ?? 4096;

    // GPU layers - use all layers if GPU available
    if (this.config.num_gpu !== undefined) {
      opts.num_gpu = this.config.num_gpu;
    } else if (capabilities.hasNvidiaGPU || capabilities.hasAMDGPU) {
      opts.num_gpu = 999; // Offload all layers to GPU
    } else {
      opts.num_gpu = 0; // CPU only
    }

    // CPU threads - optimize based on platform
    if (this.config.num_thread !== undefined) {
      opts.num_thread = this.config.num_thread;
    } else if (capabilities.isArchLinux) {
      // Arch Linux: use all cores for maximum performance
      opts.num_thread = capabilities.cpuThreads;
    } else if (process.platform === "win32") {
      // Windows: limit to 8 threads max to avoid context switching overhead
      opts.num_thread = Math.min(8, capabilities.cpuThreads);
    } else {
      // Default: use all cores minus one
      opts.num_thread = Math.max(1, capabilities.cpuThreads - 1);
    }

    // Sampling parameters for better quality
    opts.repeat_penalty = 1.1;
    opts.top_k = 40;
    opts.top_p = 0.9;

    // Batch size for prompt processing — larger batches process more tokens
    // per forward pass, reducing latency for short prompts. Default 512 is
    // conservative; 1024 is safe for 4GB+ VRAM.
    if (this.config.num_batch !== undefined) {
      opts.num_batch = this.config.num_batch;
    } else if (capabilities.hasNvidiaGPU) {
      opts.num_batch = 1024;
    }

    return opts;
  }

  /**
   * Synchronous fallback for getOptimalOptions (uses cached defaults).
   */
  private getOptimalOptionsSync(): Record<string, unknown> {
    const capabilities = this.getPlatformCapsSync();
    const opts: Record<string, unknown> = {};

    opts.num_ctx = this.config.num_ctx ?? 4096;

    if (this.config.num_gpu !== undefined) {
      opts.num_gpu = this.config.num_gpu;
    } else if (capabilities.hasNvidiaGPU || capabilities.hasAMDGPU) {
      opts.num_gpu = 999;
    } else {
      opts.num_gpu = 0;
    }

    if (this.config.num_thread !== undefined) {
      opts.num_thread = this.config.num_thread;
    } else if (capabilities.isArchLinux) {
      opts.num_thread = capabilities.cpuThreads;
    } else if (process.platform === "win32") {
      opts.num_thread = Math.min(8, capabilities.cpuThreads);
    } else {
      opts.num_thread = Math.max(1, capabilities.cpuThreads - 1);
    }

    opts.repeat_penalty = 1.1;
    opts.top_k = 40;
    opts.top_p = 0.9;

    // Batch size for faster prompt processing
    if (this.config.num_batch !== undefined) {
      opts.num_batch = this.config.num_batch;
    } else if (capabilities.hasNvidiaGPU) {
      opts.num_batch = 1024;
    }

    return opts;
  }

  /**
   * Get keep_alive setting for model residency
   */
  private async getKeepAlive(): Promise<string> {
    if (this.config.keep_alive !== undefined) {
      return this.config.keep_alive;
    }
    const capabilities = await this.getPlatformCaps();
    // Arch Linux: longer keep-alive for rolling release
    if (capabilities.isArchLinux) {
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
    const baseOpts = await this.getOptimalOptions();
    const keepAlive = await this.getKeepAlive();

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
        keep_alive: keepAlive,
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
    const baseOpts = await this.getOptimalOptions();
    const keepAlive = await this.getKeepAlive();

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
      keep_alive: keepAlive,
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
