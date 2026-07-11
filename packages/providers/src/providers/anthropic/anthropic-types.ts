export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AnthropicChatRequest {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  temperature?: number;
  system?: string;
  stream?: boolean;
}

export interface AnthropicChatResponse {
  id: string;
  content: readonly {
    type: "text";
    text: string;
  }[];
  stop_reason?: "end_turn" | "max_tokens" | "stop_sequence";
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

export interface AnthropicModelsResponse {
  data: readonly {
    id: string;
    display_name?: string;
  }[];
}
