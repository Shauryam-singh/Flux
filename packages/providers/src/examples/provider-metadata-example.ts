import { DefaultProviderFactory } from "../factory/default-provider-factory.js";

async function main(): Promise<void> {
  const factory = new DefaultProviderFactory();

  const provider = factory.create("ollama");

  console.log(provider.metadata);

  console.log(provider.metadata.capabilities);

  console.log(provider.metadata.displayName);
}

main().catch(console.error);
