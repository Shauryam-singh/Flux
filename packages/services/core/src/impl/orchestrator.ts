import type { Memory } from "@ai-agent/agent";
import type { Service } from "../interfaces/service.js";
import type {
  LlmProvider,
  ServiceContext,
  SystemContext,
} from "../interfaces/service-context.js";
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

// Split compound commands: "launch brave and open that link" → ["launch brave", "open that link"]
function splitCompoundCommands(input: string): string[] {
  const lower = input.toLowerCase();

  // Only split on " and " when it connects two imperative clauses
  // e.g. "launch brave and open that link" → ["launch brave", "open that link"]
  // But NOT "what is your name and how are you" (single question)
  const hasImperative = /\b(open|launch|start|run|close|set|change|create|add|send|search|find|google|take|screenshot|remind|git|commit|push|edit|write|make)\b/i;

  if (!hasImperative.test(input)) return [input];

  // Split on " and " but only keep parts that look like commands
  const parts = input.split(/\s+and\s+/i);
  if (parts.length <= 1) return [input];

  // Filter: keep parts that start with a verb or contain actionable intent
  const actionable = parts.filter((p) => hasImperative.test(p.trim()));
  return actionable.length > 0 ? actionable.map((p) => p.trim()) : [input];
}

export class Orchestrator {
  private readonly registry: ServiceRegistry;
  private readonly fallbackName: string;

  constructor(registry: ServiceRegistry, options?: OrchestratorOptions) {
    this.registry = registry;
    this.fallbackName = options?.fallbackService ?? "chat";
  }

  private async resolveService(
    input: string,
  ): Promise<Service> {
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

    return service ?? this.registry.get(this.fallbackName)!;
  }

  async process(
    input: string,
    ctx: OrchestratorContext,
  ): Promise<ServiceResponse> {
    const serviceCtx: ServiceContext = {
      sessionId: ctx.sessionId,
      memory: ctx.memory,
      provider: ctx.provider,
      reply: ctx.reply,
      speak: ctx.speak,
      emit: ctx.emit,
      getSystemContext: ctx.getSystemContext,
    };

    // Check for compound commands
    const commands = splitCompoundCommands(input);

    if (commands.length > 1) {
      // Execute each command in sequence, collect responses
      const responses: string[] = [];
      for (const cmd of commands) {
        const service = await this.resolveService(cmd);
        if (service) {
          try {
            const result = await service.execute(cmd, serviceCtx);
            if (result.text) responses.push(result.text);
          } catch {
            // Non-fatal — continue with next command
          }
        }
      }
      const combined = responses.join("\n\n");
      return { text: combined || "Done." };
    }

    // Single command — resolve and execute normally
    const service = await this.resolveService(input);

    if (!service) {
      return { text: "No service available to handle your request." };
    }

    return service.execute(input, serviceCtx);
  }
}
