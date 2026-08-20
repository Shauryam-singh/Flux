import type { Memory } from "@ai-agent/agent";
import type { Service } from "../interfaces/service.js";
import type {
  LlmProvider,
  ServiceContext,
  SystemContext,
} from "../interfaces/service-context.js";
import type { ServiceRegistry } from "../interfaces/service-registry.js";
import type { ServiceResponse } from "../interfaces/service-response.js";
import type { IntentContext } from "./intent-classifier.js";
import { classifyIntent } from "./intent-classifier.js";

// Minimal orchestration interface (avoids circular dep with @ai-agent/multi-agent)
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
  multiAgent?: {
    orchestrate(goal: string, provider: LlmProvider): Promise<string>;
    getAgents(): ReadonlyArray<{
      id: string;
      name: string;
      domain: string;
      status: string;
    }>;
  } | undefined;
}

// Split compound commands: "launch brave and open that link" → ["launch brave", "open that link"]
function splitCompoundCommands(input: string): string[] {
  const lower = input.toLowerCase();

  // Only split on " and " when it connects two imperative clauses
  const hasImperative = /\b(open|launch|start|run|close|set|change|create|add|send|search|find|google|take|screenshot|remind|git|commit|push|edit|write|make)\b/i;

  if (!hasImperative.test(input)) return [input];

  const parts = input.split(/\s+and\s+/i);
  if (parts.length <= 1) return [input];

  const actionable = parts.filter((p) => hasImperative.test(p.trim()));
  return actionable.length > 0 ? actionable.map((p) => p.trim()) : [input];
}

// Detect if a task is complex enough to warrant multi-agent orchestration
function isComplexTask(input: string): boolean {
  const lower = input.toLowerCase();

  // Explicit planning requests
  if (/\b(plan|decompose|break\s+down|orchestrate|coordinate|multi[- ]?agent)\b/.test(lower)) {
    return true;
  }

  // Multiple domain-diverse action verbs
  const domainVerbs = /\b(build|create|deploy|implement|design|develop|write|test|review|document|configure|set\s*up|scaffold)\b/gi;
  const matches = lower.match(domainVerbs);
  if (matches && matches.length >= 3) return true;

  // References to multiple distinct domains
  const domains = new Set<string>();
  if (/\b(frontend|ui|client|react|vue|css|html)\b/.test(lower)) domains.add("frontend");
  if (/\b(backend|api|server|database|db|sql|auth)\b/.test(lower)) domains.add("backend");
  if (/\b(deploy|docker|k8s|ci\/cd|devops|infra)\b/.test(lower)) domains.add("devops");
  if (/\b(doc|readme|documentation|wiki)\b/.test(lower)) domains.add("docs");
  if (/\b(test|spec|e2e|unit)\b/.test(lower)) domains.add("testing");
  if (/\b(design|mockup|wireframe|ui|ux)\b/.test(lower)) domains.add("design");
  if (domains.size >= 3) return true;

  // Long task with "and" connectors suggesting multiple subtasks
  if (input.length > 100 && /\b(and|also|plus|then|after|before|including)\b/.test(lower)) {
    const sentences = input.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    if (sentences.length >= 3) return true;
  }

  return false;
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
    ctx?: OrchestratorContext,
  ): Promise<Service> {
    let service: Service | null = null;

    // Build intent context from system context if available
    let intentCtx: IntentContext | undefined;
    if (ctx?.getSystemContext) {
      try {
        const sysCtx = await ctx.getSystemContext();
        const sensors = sysCtx.sensors as Record<string, unknown>;
        intentCtx = {
          isTerminal: (sensors.terminal as { isTerminal?: boolean })?.isTerminal === true,
          gitDirty: (sensors.git as { dirty?: boolean })?.dirty === true,
          dockerRunning: (sensors.docker as { running?: boolean })?.running === true,
        };
      } catch {}
    }

    const intent = classifyIntent(input, intentCtx);
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

    // Check for multi-agent orchestration
    if (ctx.multiAgent && ctx.provider && isComplexTask(input)) {
      try {
        const result = await ctx.multiAgent.orchestrate(input, ctx.provider);
        if (result && result.length > 0) {
          return { text: result };
        }
      } catch {
        // Fall through to service routing
      }
    }

    // Check for compound commands
    const commands = splitCompoundCommands(input);

    if (commands.length > 1) {
      // Execute each command in sequence, collect responses
      const responses: string[] = [];
      for (const cmd of commands) {
        const service = await this.resolveService(cmd, ctx);
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
    const service = await this.resolveService(input, ctx);

    if (!service) {
      return { text: "No service available to handle your request." };
    }

    return service.execute(input, serviceCtx);
  }

  async processStream(
    input: string,
    ctx: OrchestratorContext,
    callbacks: {
      onToken?: (token: string) => void;
      onDone?: (text: string) => void;
      onError?: (error: Error) => void;
      onStatus?: (status: string) => void;
    },
  ): Promise<void> {
    const serviceCtx: ServiceContext = {
      sessionId: ctx.sessionId,
      memory: ctx.memory,
      provider: ctx.provider,
      reply: ctx.reply,
      speak: ctx.speak,
      emit: ctx.emit,
      getSystemContext: ctx.getSystemContext,
    };

    callbacks.onStatus?.("Classifying intent...");
    const service = await this.resolveService(input, ctx);
    if (!service || !service.executeStream) {
      callbacks.onStatus?.("Generating response...");
      // If the resolved service doesn't support streaming, fall back to the
      // chat service's streaming path so tokens still arrive incrementally.
      const chatService = this.registry.get(this.fallbackName);
      if (chatService?.executeStream) {
        await chatService.executeStream(input, serviceCtx, callbacks);
        return;
      }
      // Last resort: non-streaming (sends entire response as one token)
      try {
        const result = await this.process(input, ctx);
        callbacks.onToken?.(result.text);
        callbacks.onDone?.(result.text);
      } catch (err) {
        callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
      return;
    }

    const serviceName = service.name || "chat";
    const statusMap: Record<string, string> = {
      "browser-control": "Opening in browser...",
      "screen-understanding": "Analyzing screen...",
      "desktop-control": "Controlling desktop...",
      "memory": "Accessing memory...",
      "goals": "Managing goals...",
      "chat": "Generating response...",
      "search": "Searching the web...",
      "reminders": "Setting reminder...",
    };
    callbacks.onStatus?.(statusMap[serviceName] || `Running ${serviceName}...`);

    await service.executeStream(input, serviceCtx, callbacks);
  }
}
