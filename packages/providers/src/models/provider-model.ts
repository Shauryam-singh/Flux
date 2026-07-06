export interface ProviderModel {
  readonly id: string;

  readonly name: string;

  readonly contextWindow: number;

  readonly maxOutputTokens: number;

  readonly supportsVision: boolean;

  readonly supportsTools: boolean;

  readonly supportsStreaming: boolean;

  readonly local: boolean;
}