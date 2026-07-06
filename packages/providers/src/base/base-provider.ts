import type { HttpClient } from "../http/http-client.js";

import type { Provider } from "../interfaces/provider.js";

import type { ProviderMetadata } from "../metadata/provider-metadata.js";

import type { CompletionRequest } from "../types/completion-request.js";
import type { CompletionResponse } from "../types/completion-response.js";

import type { ProviderCapabilities }
from "../capabilities/provider-capabilities.js";

import type { ProviderModel }
from "../models/provider-model.js";

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
    this.metadata = structuredClone(metadata);
    this.http = http;
  }

  public abstract isAvailable(): Promise<boolean>;

  public abstract listModels(): Promise<
    readonly string[]
  >;

  public abstract refreshMetadata(): Promise<void>;

  public abstract complete(
    request: CompletionRequest,
  ): Promise<CompletionResponse>;

  public abstract getCapabilities():
    ProviderCapabilities;

  public abstract getModels():
      readonly ProviderModel[];
}
