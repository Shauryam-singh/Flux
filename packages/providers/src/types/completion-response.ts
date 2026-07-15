export interface CompletionResponse {
  text: string;

  inputTokens?: number;

  outputTokens?: number;

  finishReason?: string;
}

export interface StreamingCallbacks {
  onToken?: (token: string) => void;
  onDone?: (response: CompletionResponse) => void;
  onError?: (error: Error) => void;
}
