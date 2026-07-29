import type { Memory } from "@ai-agent/agent";
import type { Service } from "../interfaces/service.js";
import type { ServiceContext, LlmProvider, SystemContext } from "../interfaces/service-context.js";
import type { ServiceRegistry } from "../interfaces/service-registry.js";
import type { ServiceResponse } from "../interfaces/service-response.js";
import { classifyIntent } from "./intent-classifier.js";

export interface OrchestratorOptions {
  fallbackService?: string;
}

export interface OrchestratorContext {
  sessionId: string;
  memory: Memory;
  provider: LlmProvider | null;
  reply(text: string): void;
  speak(text: string): void;
  emit(event: string, data: unknown): void;
  getSystemContext?: (() => Promise<SystemContext>) | undefined;
}

export class Orchestrator {
  private readonly registry: ServiceRegistry;
  private readonly fallbackName: string;

  constructor(registry: ServiceRegistry, options?: OrchestratorOptions) {
    this.registry = registry;
    this.fallbackName = options?.fallbackService ?? "chat";
  }

  async process(
    input: string,
    ctx: OrchestratorContext,
  ): Promise<ServiceResponse> {
    let service: Service | null = null;

    const intent = classifyIntent(input);
    if (intent) {
      service = this.registry.get(intent) ?? null;
    }

    if (!service) {
      service = await this.registry.findBest(input);
    }

    if (!service) {
      service = this.registry.get(this.fallbackName) ?? null;
    }

    if (!service) {
      return { text: "No service available to handle your request." };
    }

    const serviceCtx: ServiceContext = {
      sessionId: ctx.sessionId,
      memory: ctx.memory,
      provider: ctx.provider,
      reply: ctx.reply,
      speak: ctx.speak,
      emit: ctx.emit,
      getSystemContext: ctx.getSystemContext,
    };

    return service.execute(input, serviceCtx);
  }
}
