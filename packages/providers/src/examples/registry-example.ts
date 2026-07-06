import { AxiosHttpClient } from "../http/axios-http-client.js";
import { OllamaProvider } from "../providers/ollama/index.js";
import { DefaultProviderRegistry } from "../registry/index.js";

async function main(): Promise<void> {
  const registry = new DefaultProviderRegistry();

  registry.register(
    new OllamaProvider(new AxiosHttpClient()),
  );

  console.log(
    "Registered:",
    registry.list().map((p) => p.name),
  );

  console.log(
    "Has Ollama:",
    registry.has("ollama"),
  );

  const provider = registry.get("ollama");

  if (!provider) {
    throw new Error("Provider not found.");
  }

  console.log(
    "Models:",
    await provider.listModels(),
  );
}

main().catch(console.error);