export interface CompletionResponse {
  text: string;

  inputTokens?: number;

  outputTokens?: number;

  finishReason?: string;
}
