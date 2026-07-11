import { AxiosHttpClient } from "../http/axios-http-client.js";

import type { Provider } from "../interfaces/provider.js";
import type { ProviderFactory } from "../interfaces/provider-factory.js";
import { OllamaProvider } from "../providers/ollama/ollama-provider.js";
import type { ProviderName } from "../types/provider-name.js";

export class DefaultProviderFactory implements ProviderFactory {
  private readonly http = new AxiosHttpClient();

  public create(name: ProviderName): Provider {
    switch (name.toLowerCase()) {
      case "ollama":
        return new OllamaProvider(this.http);

      default:
        throw new Error(`Unknown provider: ${name}`);
    }
  }
}
