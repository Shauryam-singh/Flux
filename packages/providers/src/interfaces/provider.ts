import type { ProviderMetadata } from "../metadata/provider-metadata.js";
import type { CompletionRequest } from "../types/completion-request.js";
import type { CompletionResponse, StreamingCallbacks } from "../types/completion-response.js";
import type { ProviderName } from "../types/provider-name.js";

export interface Provider {
  readonly name: ProviderName;

  readonly metadata: ProviderMetadata;

  isAvailable(): Promise<boolean>;

  listModels(): Promise<readonly string[]>;

  refreshMetadata(): Promise<void>;

  complete(request: CompletionRequest): Promise<CompletionResponse>;

  completeStream?(request: CompletionRequest, callbacks: StreamingCallbacks): Promise<void>;
}
