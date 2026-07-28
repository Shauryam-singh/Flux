import type { MessageBus, MessageHandler } from "../interfaces/message-bus.js";
import type { AgentMessage, MessageType } from "@ai-agent/exec-types";

export class DefaultMessageBus implements MessageBus {
  private handlers = new Map<string, MessageHandler[]>();
  private typeHandlers = new Map<string, MessageHandler[]>();
  private published = 0;
  private delivered = 0;
  private dropped = 0;

  publish(message: AgentMessage): void {
    this.published++;
    const targetHandlers = this.handlers.get(message.to) ?? [];
    const typeHandlers = this.typeHandlers.get(message.type) ?? [];
    const allHandlers = [...targetHandlers, ...typeHandlers];

    if (allHandlers.length === 0) {
      this.dropped++;
      return;
    }

    for (const handler of allHandlers) {
      try {
        handler(message);
        this.delivered++;
      } catch {
        this.dropped++;
      }
    }
  }

  subscribe(agentId: string, handler: MessageHandler): () => void {
    const existing = this.handlers.get(agentId) ?? [];
    existing.push(handler);
    this.handlers.set(agentId, existing);
    return () => {
      const list = this.handlers.get(agentId);
      if (list) {
        const idx = list.indexOf(handler);
        if (idx >= 0) list.splice(idx, 1);
      }
    };
  }

  subscribeToType(type: MessageType, handler: MessageHandler): () => void {
    const existing = this.typeHandlers.get(type) ?? [];
    existing.push(handler);
    this.typeHandlers.set(type, existing);
    return () => {
      const list = this.typeHandlers.get(type);
      if (list) {
        const idx = list.indexOf(handler);
        if (idx >= 0) list.splice(idx, 1);
      }
    };
  }

  getStats() {
    return { published: this.published, delivered: this.delivered, dropped: this.dropped };
  }
}
