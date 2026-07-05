import type { CompletionRequest } from "../types/completion-request.js";
import type { CompletionResponse } from "../types/completion-response.js";
import type { ProviderName } from "../types/provider-name.js";

export interface Provider {
  readonly name: ProviderName;

  isAvailable(): Promise<boolean>;

  listModels(): Promise<readonly string[]>;

  complete(request: CompletionRequest): Promise<CompletionResponse>;
}
