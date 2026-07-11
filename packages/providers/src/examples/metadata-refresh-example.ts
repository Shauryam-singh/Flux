import { DefaultProviderFactory } from "../factory/default-provider-factory.js";

async function main(): Promise<void> {
  const provider = new DefaultProviderFactory().create("ollama");

  console.log("Before:", provider.metadata.models);

  await provider.refreshMetadata();

  console.log("After:", provider.metadata.models);
}

main().catch(console.error);
