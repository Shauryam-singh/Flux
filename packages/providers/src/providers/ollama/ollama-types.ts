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
}

export interface OllamaChatRequest {
  readonly model: string;

  readonly messages: readonly OllamaMessage[];

  readonly stream: boolean;

  readonly options?: OllamaChatOptions;
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
