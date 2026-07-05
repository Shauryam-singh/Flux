import type { Provider } from "../interfaces/provider.js";

export abstract class BaseProvider implements Provider {
  abstract readonly name: Provider["name"];

  abstract isAvailable(): Promise<boolean>;

  abstract listModels(): Promise<readonly string[]>;

  abstract complete(
    request: Parameters<Provider["complete"]>[0],
  ): ReturnType<Provider["complete"]>;
}
