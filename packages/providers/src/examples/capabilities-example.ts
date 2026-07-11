import { AxiosHttpClient } from "../http/axios-http-client.js";
import { OllamaProvider } from "../providers/ollama/index.js";

async function main() {
  const provider = new OllamaProvider(new AxiosHttpClient());

  console.log(provider.getCapabilities());

  console.log(provider.getModels());
}

main();
