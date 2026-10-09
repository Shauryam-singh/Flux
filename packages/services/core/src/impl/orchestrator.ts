import type { Memory } from "@ai-agent/agent";
import type { Service } from "../interfaces/service.js";
import type {
  CognitiveContext,
  LlmProvider,
  ServiceContext,
  SystemContext,
} from "../interfaces/service-context.js";
import type { ServiceRegistry } from "../interfaces/service-registry.js";
import type { ServiceResponse } from "../interfaces/service-response.js";
import type { IntentContext } from "./intent-classifier.js";
import { classifyIntent, suppressUnsafeIntent } from "./intent-classifier.js";
import { classifyIntentsWithLlm } from "./llm-intent-classifier.js";

// Action resolved for execution: a service plus the exact user words it owns.
interface ResolvedAction {
  service: Service;
  command: string;
}

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
  cognitiveContext?: CognitiveContext | undefined;
  multiAgent?:
    | {
        orchestrate(goal: string, provider: LlmProvider): Promise<string>;
        getAgents(): ReadonlyArray<{
          id: string;
          name: string;
          domain: string;
          status: string;
        }>;
      }
    | undefined;
}

// Split compound commands: "launch brave and open that link" → ["launch brave", "open that link"]
function splitCompoundCommands(input: string): string[] {
  // Only split on " and " when it connects two imperative clauses
  const hasImperative =
    /\b(open|launch|start|run|close|set|change|create|add|send|search|find|google|take|screenshot|remind|git|commit|push|edit|write|make)\b/i;

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
  if (
    /\b(plan|decompose|break\s+down|orchestrate|coordinate|multi[- ]?agent)\b/.test(
      lower,
    )
  ) {
    return true;
  }

  // Multiple domain-diverse action verbs
  const domainVerbs =
    /\b(build|create|deploy|implement|design|develop|write|test|review|document|configure|set\s*up|scaffold)\b/gi;
  const matches = lower.match(domainVerbs);
  if (matches && matches.length >= 3) return true;

  // References to multiple distinct domains
  const domains = new Set<string>();
  if (/\b(frontend|ui|client|react|vue|css|html)\b/.test(lower))
    domains.add("frontend");
  if (/\b(backend|api|server|database|db|sql|auth)\b/.test(lower))
    domains.add("backend");
  if (/\b(deploy|docker|k8s|ci\/cd|devops|infra)\b/.test(lower))
    domains.add("devops");
  if (/\b(doc|readme|documentation|wiki)\b/.test(lower)) domains.add("docs");
  if (/\b(test|spec|e2e|unit)\b/.test(lower)) domains.add("testing");
  if (/\b(design|mockup|wireframe|ui|ux)\b/.test(lower)) domains.add("design");
  if (domains.size >= 3) return true;

  // Long task with "and" connectors suggesting multiple subtasks
  if (
    input.length > 100 &&
    /\b(and|also|plus|then|after|before|including)\b/.test(lower)
  ) {
    const sentences = input.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    if (sentences.length >= 3) return true;
  }

  return false;
}

// User-facing status lines per service
const STATUS_MAP: Record<string, string> = {
  "browser-control": "Opening in browser...",
  "screen-understanding": "Analyzing screen...",
  "desktop-control": "Controlling desktop...",
  memory: "Accessing memory...",
  goals: "Managing goals...",
  chat: "Generating response...",
  search: "Searching the web...",
  reminders: "Setting reminder...",
};

function statusFor(serviceName: string): string {
  return STATUS_MAP[serviceName] || `Running ${serviceName}...`;
}

export class Orchestrator {
  private readonly registry: ServiceRegistry;
  private readonly fallbackName: string;

  constructor(registry: ServiceRegistry, options?: OrchestratorOptions) {
    this.registry = registry;
    this.fallbackName = options?.fallbackService ?? "chat";
  }

  /**
   * Resolve input to one or more actions using the LLM as the intent
   * classifier. Falls back to the legacy keyword/regex classifier only when
   * no provider is available or the model call fails/times out.
   */
  private async resolveActions(
    input: string,
    ctx?: OrchestratorContext,
  ): Promise<ResolvedAction[]> {
    // ── Primary: model-based intent (also splits multi-command input) ──
    if (ctx?.provider && !suppressUnsafeIntent(input)) {
      const services = this.registry.getAll().map((s) => s.name);
      const actions = await classifyIntentsWithLlm(input, ctx.provider, {
        services,
      });
      if (actions) {
        const resolved: ResolvedAction[] = [];
        for (const action of actions) {
          const service = this.registry.get(action.service);
          if (service) resolved.push({ service, command: action.command });
        }
        if (resolved.length > 0) return resolved;
        // Model said "just chatting" ([]), or named only unknown services —
        // route straight to chat without a second classification pass.
        const chat = this.registry.get(this.fallbackName);
        if (chat) return [{ service: chat, command: input }];
      }
      // null → LLM unavailable/unparseable, fall through to legacy path
    }

    // ── Fallback: keyword/regex classifier (no provider / LLM failed) ──

    // Build intent context from system context if available
    let intentCtx: IntentContext | undefined;
    if (ctx?.getSystemContext) {
      try {
        const sysCtx = await ctx.getSystemContext();
        const sensors = sysCtx.sensors as Record<string, unknown>;
        intentCtx = {
          isTerminal:
            (sensors.terminal as { isTerminal?: boolean })?.isTerminal === true,
          gitDirty: (sensors.git as { dirty?: boolean })?.dirty === true,
          dockerRunning:
            (sensors.docker as { running?: boolean })?.running === true,
        };
      } catch {}
    }

    const commands = splitCompoundCommands(input);
    const resolved: ResolvedAction[] = [];
    for (const cmd of commands) {
      const service = await this.resolveLegacyService(cmd, intentCtx);
      if (service) resolved.push({ service, command: cmd });
    }

    if (resolved.length > 0) return resolved;

    const fallback = this.registry.get(this.fallbackName);
    if (!fallback) return [];
    return [{ service: fallback, command: input }];
  }

  /** Legacy keyword/regex routing for a single command. */
  private async resolveLegacyService(
    input: string,
    intentCtx?: IntentContext,
  ): Promise<Service | null> {
    let service: Service | null = null;

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

    return service;
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
      cognitiveContext: ctx.cognitiveContext,
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

    // Resolve input to one or more actions (LLM splits multi-command input)
    const actions = await this.resolveActions(input, ctx);
    if (actions.length === 0) {
      return { text: "No service available to handle your request." };
    }

    // Single action — execute and return its full response
    if (actions.length === 1) {
      const action = actions[0];
      if (!action) {
        return { text: "No service available to handle your request." };
      }
      return action.service.execute(action.command, serviceCtx);
    }

    // Multiple actions — execute each in sequence, collect responses
    const responses: string[] = [];
    for (const action of actions) {
      try {
        const result = await action.service.execute(action.command, serviceCtx);
        if (result.text) responses.push(result.text);
      } catch {
        // Non-fatal — continue with next action
      }
    }
    const combined = responses.join("\n\n");
    return { text: combined || "Done." };
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
      cognitiveContext: ctx.cognitiveContext,
    };

    callbacks.onStatus?.("Classifying intent...");
    const actions = await this.resolveActions(input, ctx);
    if (actions.length === 0) {
      callbacks.onError?.(
        new Error("No service available to handle your request."),
      );
      return;
    }

    // Multiple actions (multi-command input) — run each in sequence and
    // stream every result as soon as it completes.
    if (actions.length > 1) {
      const parts: string[] = [];
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        if (!action) continue;
        callbacks.onStatus?.(
          `${statusFor(action.service.name)} (${i + 1}/${actions.length})`,
        );
        try {
          const result = await action.service.execute(
            action.command,
            serviceCtx,
          );
          if (result.text) {
            parts.push(result.text);
            callbacks.onToken?.(
              parts.length > 1 ? `\n\n${result.text}` : result.text,
            );
          }
        } catch (err) {
          callbacks.onError?.(
            err instanceof Error ? err : new Error(String(err)),
          );
        }
      }
      callbacks.onDone?.(parts.join("\n\n") || "Done.");
      return;
    }

    // Single action
    const action = actions[0];
    if (!action) {
      callbacks.onError?.(new Error("Intent resolution failed."));
      return;
    }
    const service = action.service;
    if (!service.executeStream) {
      callbacks.onStatus?.("Generating response...");
      // If the resolved service doesn't support streaming, fall back to the
      // chat service's streaming path so tokens still arrive incrementally.
      const chatService = this.registry.get(this.fallbackName);
      if (chatService?.executeStream) {
        await chatService.executeStream(action.command, serviceCtx, callbacks);
        return;
      }
      // Last resort: non-streaming (sends entire response as one token)
      try {
        const result = await service.execute(action.command, serviceCtx);
        callbacks.onToken?.(result.text);
        callbacks.onDone?.(result.text);
      } catch (err) {
        callbacks.onError?.(
          err instanceof Error ? err : new Error(String(err)),
        );
      }
      return;
    }

    callbacks.onStatus?.(statusFor(service.name || "chat"));

    await service.executeStream(action.command, serviceCtx, callbacks);
  }
}
