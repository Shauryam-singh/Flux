import type { HttpClient } from "../http/http-client.js";
import type { Provider } from "../interfaces/provider.js";
import type { CompletionRequest } from "../types/completion-request.js";
import type { CompletionResponse } from "../types/completion-response.js";
import type { ProviderName } from "../types/provider-name.js";

export abstract class BaseProvider implements Provider {
  public readonly name: ProviderName;

  protected readonly http: HttpClient;

  protected constructor(
    name: ProviderName,
    http: HttpClient,
  ) {
    this.name = name;
    this.http = http;
  }

  public abstract isAvailable(): Promise<boolean>;

  public abstract listModels(): Promise<readonly string[]>;

  public abstract complete(
    request: CompletionRequest,
  ): Promise<CompletionResponse>;
}