export interface CompletionResponse {
  readonly text: string;

  readonly inputTokens?: number;

  readonly outputTokens?: number;

  readonly finishReason?: string;
}
