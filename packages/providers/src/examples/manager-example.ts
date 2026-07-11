import { DefaultProviderFactory, DefaultProviderManager } from "../index.js";

async function main(): Promise<void> {
  const factory = new DefaultProviderFactory();

  const manager = new DefaultProviderManager(factory);

  manager.register("ollama");

  console.log(manager.has("ollama"));

  const provider = manager.get("ollama");

  console.log(provider.name);

  console.log(await provider.listModels());
}

main().catch(console.error);
