import type { AgentMessage, MessageType } from "@ai-agent/exec-types";

export interface MessageBus {
  publish(message: AgentMessage): void;
  subscribe(agentId: string, handler: MessageHandler): () => void;
  subscribeToType(type: MessageType, handler: MessageHandler): () => void;
  getStats(): { published: number; delivered: number; dropped: number };
}

export type MessageHandler = (message: AgentMessage) => void | Promise<void>;

export interface MessageRouter {
  route(message: AgentMessage): void;
  addRoute(from: string, to: string): void;
  removeRoute(from: string, to: string): void;
}
