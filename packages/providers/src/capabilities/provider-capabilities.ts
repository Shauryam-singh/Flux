export interface ProviderCapabilities {
  readonly chat: boolean;

  readonly completion: boolean;

  readonly streaming: boolean;

  readonly tools: boolean;

  readonly vision: boolean;

  readonly embeddings: boolean;

  readonly local: boolean;
}