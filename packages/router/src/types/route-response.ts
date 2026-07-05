import type { CompletionResponse } from "@ai-agent/providers";

export interface RouteResponse {
  readonly provider: string;

  readonly response: CompletionResponse;
}
