export interface OllamaModel {
  readonly name: string;

  readonly model?: string;

  readonly modified_at?: string;

  readonly size?: number;

  readonly digest?: string;
}

export interface OllamaTagsResponse {
  readonly models: readonly OllamaModel[];
}

export interface OllamaMessage {
  readonly role: "system" | "user" | "assistant";

  readonly content: string;

  readonly images?: readonly string[];
}

export interface OllamaChatOptions {
  temperature?: number;

  num_predict?: number;

  think?: boolean;

  // Performance optimization options
  num_ctx?: number;      // Context window size (default: model's default)
  num_gpu?: number;      // Number of layers to offload to GPU (999 = all layers)
  num_thread?: number;   // Number of CPU threads for inference
  repeat_penalty?: number; // Repetition penalty (default: 1.1)
  top_k?: number;        // Top-K sampling (default: 40)
  top_p?: number;        // Top-P sampling (default: 0.9)
  mirostat?: number;     // Mirostat sampling (0 = disabled, 1 = v1, 2 = v2)
  mirostat_tau?: number; // Mirostat target entropy
  mirostat_eta?: number; // Mirostat learning rate
}

export interface OllamaProviderConfig {
  baseUrl?: string;
  defaultModel?: string;
  num_ctx?: number;
  num_gpu?: number;
  num_thread?: number;
  keep_alive?: string;   // Model residency in memory (e.g., "5m", "10m", "-1" for infinite)
}

export interface OllamaChatRequest {
  readonly model: string;

  readonly messages: readonly OllamaMessage[];

  readonly stream: boolean;

  readonly options?: OllamaChatOptions;

  readonly think?: boolean;

  readonly keep_alive?: string; // Model residency in memory (e.g., "5m", "10m", "-1" for infinite)
}

export interface OllamaChatResponse {
  readonly model?: string;

  readonly created_at?: string;

  readonly message: {
    readonly role: string;

    readonly content: string;
  };

  readonly done?: boolean;

  readonly done_reason?: string;

  readonly total_duration?: number;

  readonly load_duration?: number;

  readonly prompt_eval_count?: number;

  readonly prompt_eval_duration?: number;

  readonly eval_count?: number;

  readonly eval_duration?: number;
}
