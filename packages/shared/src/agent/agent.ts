export interface Agent {
  run(prompt: string): Promise<void>;
}
