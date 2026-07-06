import type { HttpClient } from "../http/http-client.js";

import type { Provider } from "../interfaces/provider.js";

import type { ProviderMetadata } from "../metadata/provider-metadata.js";

export abstract class BaseProvider
  implements Provider
{
  public readonly name: string;

  public readonly metadata: ProviderMetadata;

  protected readonly http: HttpClient;

  protected constructor(
    name: string,
    metadata: ProviderMetadata,
    http: HttpClient,
  ) {
    this.name = name;
    this.metadata = metadata;
    this.http = http;
  }

  public abstract isAvailable(): Promise<boolean>;

  public abstract listModels(): Promise<
    readonly string[]
  >;

  public abstract complete(
    request: import("../types/completion-request.js").CompletionRequest,
  ): Promise<
    import("../types/completion-response.js").CompletionResponse
  >;
}