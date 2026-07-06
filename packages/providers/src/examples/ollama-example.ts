import {
  AxiosHttpClient,
  OllamaProvider,
} from "../index.js";

async function main() {
  const provider = new OllamaProvider(
    new AxiosHttpClient(),
  );

  console.log(
    "Available:",
    await provider.isAvailable(),
  );

  console.log(
    "Models:",
    await provider.listModels(),
  );

  const response = await provider.complete({
    model: "qwen2.5:0.5b",
    prompt: "Say hello in one sentence.",
  });

  console.log(response);
}

main().catch(console.error);