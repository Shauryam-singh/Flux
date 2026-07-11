export interface ProviderCapabilities {
  readonly chat: boolean;

  readonly streaming: boolean;

  readonly toolCalling: boolean;

  readonly vision: boolean;

  readonly embeddings: boolean;

  readonly functionCalling: boolean;

  readonly jsonMode: boolean;

  readonly local: boolean;
}
