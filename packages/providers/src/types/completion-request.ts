export interface CompletionRequest {
  readonly model: string;

  readonly prompt: string;

  readonly temperature?: number;

  readonly maxTokens?: number;

  readonly stream?: boolean;
}
