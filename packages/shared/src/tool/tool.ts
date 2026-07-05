export interface Tool<TInput = unknown, TOutput = unknown> {
  readonly name: string;

  execute(input: TInput): Promise<TOutput>;
}
