import { DefaultProviderFactory } from "../factory/default-provider-factory.js";

async function main(): Promise<void> {
  const factory = new DefaultProviderFactory();

  const provider = factory.create("ollama");

  console.log(provider.name);

  console.log(await provider.isAvailable());

  console.log(await provider.listModels());
}

main().catch(console.error);