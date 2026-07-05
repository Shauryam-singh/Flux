import type { LanguageModel } from "../model/language-model.js";

export interface Router {
  selectModel(task: string): Promise<LanguageModel>;
}
