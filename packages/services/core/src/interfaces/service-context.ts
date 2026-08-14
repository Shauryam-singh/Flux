import type { Memory } from "@ai-agent/agent";

export interface LlmProvider {
  complete(req: {
    model: string;
    prompt: string;
    messages?: readonly { role: string; content: string }[];
    temperature?: number;
    maxTokens?: number;
  }): Promise<{ text: string }>;

  completeStream?(
    req: {
      model: string;
      prompt: string;
      messages?: readonly { role: string; content: string }[];
      temperature?: number;
      maxTokens?: number;
    },
    callbacks: {
      onToken?: (token: string) => void;
      onDone?: (response: { text: string }) => void;
      onError?: (error: Error) => void;
    },
  ): Promise<void>;
}

export interface SystemContext {
  battery: { level: number; charging: boolean; timeRemaining?: number } | null;
  sensors: Record<string, unknown>;
  goals: Array<{ name: string; progress: number; status: string }>;
  recentActivity: string[];
  memoryStats: { totalMemories: number } | null;
  currentTime: string;
  platform: string;
}

export interface ServiceContext {
  sessionId: string;
  memory: Memory;
  provider: LlmProvider | null;
  reply(text: string): void;
  speak(text: string): void;
  emit(event: string, data: unknown): void;
  getSystemContext?: (() => Promise<SystemContext>) | undefined;
}
