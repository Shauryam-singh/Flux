import type { CompletionRequest } from "@ai-agent/providers";

export interface RouteRequest {
  readonly provider: string;

  readonly request: CompletionRequest;
}
