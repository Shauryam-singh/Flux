export interface ModelMetadata {
  readonly id: string;

  readonly displayName: string;

  readonly contextWindow: number;

  readonly maxOutputTokens: number;

  readonly vision: boolean;

  readonly toolCalling: boolean;

  readonly embeddings: boolean;
}
