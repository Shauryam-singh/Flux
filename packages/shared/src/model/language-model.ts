export interface LanguageModel {
  readonly id: string;

  complete(prompt: string): Promise<string>;

  stream(prompt: string): AsyncIterable<string>;

  estimateTokens(text: string): number;
}
