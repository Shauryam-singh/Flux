import type { LanguageModel } from "../model/language-model.js";

export interface ModelProvider {
  readonly name: string;

  listModels(): Promise<LanguageModel[]>;
}
