export interface CompletionResponse {
  text: string;

  inputTokens?: number;

  outputTokens?: number;

  finishReason?: string;

  toolCall?: {
    tool: string;
    input: Record<string, unknown>;
  };
}

export interface StreamingCallbacks {
  onToken?: (token: string) => void;
  onDone?: (response: CompletionResponse) => void;
  onError?: (error: Error) => void;
}
