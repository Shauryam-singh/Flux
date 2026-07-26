import type { Memory } from "@ai-agent/agent";

export interface LlmProvider {
  complete(req: {
    model: string;
    prompt: string;
    temperature?: number;
  }): Promise<{ text: string }>;
}

export interface ServiceContext {
  sessionId: string;
  memory: Memory;
  provider: LlmProvider | null;
  reply(text: string): void;
  speak(text: string): void;
  emit(event: string, data: unknown): void;
}
