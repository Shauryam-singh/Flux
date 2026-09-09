import type {
  CognitiveContext,
  Service,
  ServiceContext,
  ServiceResponse,
  SystemContext,
} from "@ai-agent/services-core";
import { detectModelComplexity, classifyResponseType, getMaxTokensForResponseType } from "@ai-agent/services-core";

export interface ChatServiceOptions {
  personality?: string;
}

interface ChatMessages {
  systemMessage: string;
  chatMessages: { role: string; content: string }[];
  recentHistory: { role: string; content: string }[];
}

/**
 * Get message limit based on model size.
 * Smaller models have limited context windows.
 */
function getMessageLimit(model: string): number {
  if (model.includes("0.5b")) return 4;  // 4 messages for small model (2 turns)
  if (model.includes("3b") || model.includes("7b")) return 6;
  return 8; // Larger models can handle more
}

/**
 * Get truncation limit based on model size.
 */
function getTruncationLimit(model: string): number {
  // Override for benchmarks (Test 12: context knee experiment)
  const envLimit = process.env.FLUX_TRUNCATION_LIMIT;
  if (envLimit) return parseInt(envLimit, 10);
  if (model.includes("0.5b")) return 300;
  return 600;
}

async function buildChatMessages(
  input: string,
  ctx: ServiceContext,
  personality: string,
  model: string = "default",
  memoryBlock: string = "",
): Promise<ChatMessages> {
  const history = await ctx.memory.history();
  
  // Get model-specific limits
  const messageLimit = getMessageLimit(model) * 2; // *2 for user+assistant pairs
  const truncationLimit = getTruncationLimit(model);
  
  // Limit history based on model size
  const recentHistory = history.slice(-messageLimit).map((m) => ({
    role: m.role,
    // Truncate oversized entries based on model size
    content: m.content.length > truncationLimit ? m.content.slice(0, truncationLimit) : m.content,
  }));

  // For simple queries (greetings, yes/no), skip the full system context
  // to reduce prompt size and latency. But always include goals — they're
  // small and critical for the LLM to know what the user is working on.
  const complexity = detectModelComplexity(input);
  let systemContextPrompt = "";
  if (ctx.getSystemContext) {
    try {
      const sysCtx = await ctx.getSystemContext();
      if (complexity !== "simple") {
        systemContextPrompt = buildSystemContextPrompt(sysCtx, model);
      } else if (sysCtx.goals && sysCtx.goals.length > 0) {
        // Simple query: include only goals for context awareness
        const goalList = sysCtx.goals
          .map((g) => `${g.name} (${g.progress}% ${g.status})`)
          .join("; ");
        systemContextPrompt = `\n\nCURRENT STATE:\n- Goals: ${goalList}`;
      }
    } catch {
      // System context unavailable — continue without it
    }
  }

  // Build cognitive context prompt (active goals, recent thoughts)
  const cognitivePrompt = buildCognitivePrompt(ctx.cognitiveContext);

  // Send a proper system/user/assistant message sequence instead of a
  // flat blob. A single giant "user" message makes qwen3 dump its
  // reasoning + restate the prompt/system state, producing the
  // 10+ line garbage reply.
  const systemMessage = `${memoryBlock ? memoryBlock + "\n\n" : ""}${personality}${systemContextPrompt}${cognitivePrompt}`;
  const chatMessages: { role: string; content: string }[] = [
    { role: "system", content: systemMessage },
  ];
  for (const m of recentHistory) {
    if (m.role === "user" || m.role === "assistant") {
      chatMessages.push({ role: m.role, content: m.content });
    }
  }
  // Ensure the final message is the user's current input
  if (chatMessages[chatMessages.length - 1]?.role !== "user") {
    chatMessages.push({ role: "user", content: input });
  }

  return { systemMessage, chatMessages, recentHistory };
}

const JARVIS_PERSONALITY = `You are Flux — a witty, curious personal AI assistant and friend who knows the user's computer and can control it.

TALK: casual and conversational, like texting a smart friend. Use contractions, short messages when appropriate, emoji sparingly. Match the user's energy. Ask follow-up questions.
DO: control their system, search the web, write code, manage files, run commands. When asked to DO something, do it and confirm casually.
NEVER: say "I'm an AI" or "I'm a language model", be overly formal, give a wall of text when a sentence will do, be sycophantic or use chatbot phrases like "I'd be happy to help!" or "Great question!".

RULES:
- Keep replies under 2 sentences unless asked for detail.
- No preamble, no restating the question. Just answer.
- For action confirmations: one line max, e.g. "Done. Opened VS Code."
- For questions: direct answer first, then optionally one follow-up.`;

/**
 * Build system context prompt, abbreviated for small models.
 */
function buildSystemContextPrompt(ctx?: SystemContext, model: string = "default"): string {
  if (!ctx) return "";

  const isSmallModel = model.includes("0.5b");
  const parts: string[] = ["\n\nCURRENT STATE:"];

  // Always include time (essential for context)
  parts.push(`- Time: ${ctx.currentTime}`);

  // Skip verbose info for small models to save context window
  if (!isSmallModel) {
    parts.push(`- Platform: ${ctx.platform}`);

    // Battery — level is already 0-100
    if (ctx.battery) {
      const bat = ctx.battery;
      const pct = Math.round(bat.level);
      parts.push(
        `- Battery: ${pct}%${bat.charging ? " (charging)" : ""}${bat.timeRemaining ? `, ~${Math.round(bat.timeRemaining / 60)}min remaining` : ""}`,
      );
    }

    // Screen — the active window / application
    const screen = ctx.sensors.screen as
      | { activeWindow?: string; title?: string; focused?: boolean }
      | undefined;
    if (screen) {
      const app =
        screen.activeWindow ?? screen.title ?? "unknown";
      parts.push(`- Current application: ${app}`);
    }

    // Git — current branch and status
    const git = ctx.sensors.git as
      | { branch?: string; dirty?: boolean; ahead?: number; behind?: number }
      | undefined;
    if (git?.branch) {
      let gitStatus = git.branch;
      if (git.dirty) gitStatus += " (dirty)";
      if (git.ahead) gitStatus += ` (${git.ahead} ahead)`;
      if (git.behind) gitStatus += ` (${git.behind} behind)`;
      parts.push(`- Git: ${gitStatus}`);
    }

    // Goals
    if (ctx.goals.length > 0) {
      const goalList = ctx.goals
        .map((g) => `${g.name} (${g.progress}% ${g.status})`)
        .join("; ");
      parts.push(`- Goals: ${goalList}`);
    }

    // Coding session — active project info (from sensors)
    const coding = ctx.sensors?.codingSession as
      | { durationMs?: number; filesChanged?: number; languages?: string[]; projects?: string[] }
      | undefined;
    if (coding?.projects && coding.projects.length > 0) {
      parts.push(`- Active projects: ${coding.projects.join(", ")}`);
    }
    if (coding?.languages && coding.languages.length > 0) {
      parts.push(`- Languages: ${coding.languages.join(", ")}`);
    }

    // Browser context — active website context (from sensors)
    const browser = ctx.sensors?.browserContext as
      | { site?: string; isGitHub?: boolean; isStackOverflow?: boolean; isDocs?: boolean }
      | undefined;
    if (browser?.site) {
      parts.push(`- Browsing: ${browser.site}`);
    }
  } else {
    // Small model: only include essential info
    // Abbreviated platform
    parts.push(`- Platform: ${ctx.platform === "win32" ? "Windows" : ctx.platform === "linux" ? "Linux" : ctx.platform}`);
    
    // Battery level only (no details)
    if (ctx.battery) {
      parts.push(`- Battery: ${Math.round(ctx.battery.level)}%`);
    }
  }

  return parts.join("\n");
}

/**
 * Build cognitive context prompt from the cognitive orchestrator's state.
 * Injects active goals and recent thoughts into the system message so
 * the LLM can use the cognitive system's analysis.
 */
function buildCognitivePrompt(ctx?: CognitiveContext): string {
  if (!ctx) return "";

  const parts: string[] = [];

  if (ctx.activeGoal) {
    parts.push(`Active Goal: ${ctx.activeGoal.title} (${ctx.activeGoal.progress}% done)`);
  }

  if (ctx.recentThoughts.length > 0) {
    const thoughts = ctx.recentThoughts
      .slice(-3)
      .map((t: { type: string; content: string; confidence: number }) => `[${t.type}] ${t.content}`)
      .join("; ");
    parts.push(`Recent Analysis: ${thoughts}`);
  }

  if (parts.length === 0) return "";

  return `\n\nCOGNITIVE STATE:\n${parts.join("\n")}`;
}

export function createChatService(options?: ChatServiceOptions): Service {
  const personality = options?.personality ?? JARVIS_PERSONALITY;

  // --- Dynamic memory extraction ---
  // Automatically extracts facts from conversation and injects them into
  // the system message, solving the context-availability problem.
  const memoryStore = new Map<string, string>();

  function extractFacts(message: string): void {
    const lower = message.toLowerCase();

    // Project name: "called X", "project name is X", "My project is X"
    const nameMatch = message.match(/(?:called|project name is|my project is)\s+([A-Z][a-zA-Z0-9]+)/i);
    if (nameMatch && nameMatch[1]) memoryStore.set("project_name", nameMatch[1]);

    // Tech stack: "uses X", "built with X", "running on X", "stack is X"
    const techPatterns = [
      /(?:uses?|built with|running on|stack is)\s+(Node\.?js|Python|FastAPI|Express|Django|Flask|React|Vue|Angular|TypeScript|JavaScript)/gi,
      /(?:uses?|built with)\s+(PostgreSQL|MySQL|MongoDB|Redis|SQLite)/gi,
    ];
    for (const pt of techPatterns) {
      const m = message.match(pt);
      if (m) {
        for (const match of m) {
          const tech = match.replace(/^(?:uses?|built with|running on|stack is)\s+/i, "").trim();
          const existing = memoryStore.get("tech_stack") ?? "";
          if (!existing.includes(tech)) {
            memoryStore.set("tech_stack", existing ? `${existing}, ${tech}` : tech);
          }
        }
      }
    }

    // Database: "database is X", "using X for database", "DB is X"
    const dbMatch = message.match(/(?:database is|using|db is)\s+(PostgreSQL|MySQL|MongoDB|Redis|SQLite)/gi);
    if (dbMatch) {
      for (const m of dbMatch) {
        const db = m.replace(/^(?:database is|using|db is)\s+/i, "").trim();
        memoryStore.set("database", db);
      }
    }

    // Cache: "cache is X", "using X for caching", "Redis for caching"
    const cacheMatch = message.match(/(?:cache is|using|for caching)\s+(Redis|Memcached)/gi);
    if (cacheMatch) {
      for (const m of cacheMatch) {
        const cache = m.replace(/^(?:cache is|using|for caching)\s+/i, "").trim();
        memoryStore.set("cache", cache);
      }
    }

    // Deployment: "deployed on X", "target is X", "deployment target is X"
    const deployMatch = message.match(/(?:deployed on|target is|deployment target is)\s+(AWS|GCP|Azure|Docker|Kubernetes|ECS|Fargate)/gi);
    if (deployMatch) {
      for (const m of deployMatch) {
        const deploy = m.replace(/^(?:deployed on|target is|deployment target is)\s+/i, "").trim();
        memoryStore.set("deployment", deploy);
      }
    }

    // Purpose: "it's a X", "purpose is X", "does X"
    const purposeMatch = message.match(/(?:it's a|purpose is|it does)\s+([^.!?\n]{5,50})/i);
    if (purposeMatch && purposeMatch[1]) {
      memoryStore.set("purpose", purposeMatch[1].trim());
    }

    // Scaling requirements: "must handle X", "requires X concurrent"
    const scalingMatch = message.match(/(?:must handle|requires?|handle)\s+([\d,]+k?\s*(?:concurrent|connections?|users?))/gi);
    if (scalingMatch) {
      for (const m of scalingMatch) {
        const scaling = m.replace(/^(?:must handle|requires?|handle)\s+/i, "").trim();
        memoryStore.set("scaling", scaling);
      }
    }

    // WebSocket/real-time: "via WebSocket", "Socket.io"
    if (message.match(/websocket|socket\.io/i)) {
      memoryStore.set("websocket", "WebSocket");
    }

    // Mobile: "React Native", "iOS and Android"
    if (message.match(/react native/i)) {
      memoryStore.set("mobile", "React Native (iOS + Android)");
    }

    // ORM: "Prisma", "TypeORM", "Sequelize"
    const ormMatch = message.match(/\b(Prisma|TypeORM|Sequelize|Mongoose)\b/i);
    if (ormMatch && ormMatch[1]) {
      memoryStore.set("orm", ormMatch[1]);
    }

    // Correction: "actually using X, not Y", "Correction — I'm using X"
    const correctionMatch = message.match(/(?:actually using|correction.*?using|not\s+\w+.*?but)\s+(\w+)/i);
    if (correctionMatch && correctionMatch[1]) {
      const corrected = correctionMatch[1];
      // Remove the old technology if it's a correction
      for (const [key, value] of memoryStore) {
        if (value.toLowerCase().includes(corrected.toLowerCase())) {
          // This is a correction, update the value
          memoryStore.set(key, value.replace(new RegExp(corrected, "i"), corrected));
        }
      }
    }
  }

  function getMemoryBlock(): string {
    if (memoryStore.size === 0) return "";

    const lines = ["[PROJECT MEMORY]"];
    for (const [key, value] of memoryStore) {
      const label = key.replace(/_/g, " ");
      lines.push(`${label}: ${value}`);
    }
    return lines.join("\n");
  }

  // --- Model routing (N=5 hysteresis) ---
  // Once a complex query triggers 3B, stay on 3B for 5 turns before
  // allowing fallback to 0.5B. This amortizes cold-load costs and
  // improves context retention across multi-turn conversations.
  let currentModel: "0.5b" | "3b" = "0.5b";
  let turnsOnCurrentModel = 0;
  const HYSTERESIS_TURNS = 5;

  function resolveModel(input: string): string {
    // Force model override for benchmarks
    const forced = process.env.FLUX_FORCE_MODEL;
    if (forced) return forced;

    const complexity = detectModelComplexity(input);
    const wants3b = complexity !== "simple";

    if (wants3b) {
      currentModel = "3b";
      turnsOnCurrentModel++;
    } else {
      if (currentModel === "3b" && turnsOnCurrentModel < HYSTERESIS_TURNS) {
        turnsOnCurrentModel++;
      } else {
        currentModel = "0.5b";
        turnsOnCurrentModel = 0;
      }
    }

    return currentModel === "3b" ? "default" : "qwen2.5:0.5b";
  }

  return {
    name: "chat",
    description:
      "General conversational AI for questions, discussion, and everyday tasks",

    async canHandle(_input: string): Promise<boolean> {
      return true;
    },

    async execute(
      input: string,
      ctx: ServiceContext,
    ): Promise<ServiceResponse> {
      const t0 = Date.now();

      const model = resolveModel(input);
      // Extract facts from user message for dynamic memory
      extractFacts(input);
      // Parallelize memory add and context building for faster response
      const [, chatResult] = await Promise.all([
        ctx.memory.add("user", input),
        buildChatMessages(input, ctx, personality, model, getMemoryBlock()),
      ]);
      const t1 = Date.now();

      const { systemMessage, chatMessages, recentHistory } = chatResult;

      if (!ctx.provider) {
        return { text: "Chat provider not configured." };
      }

      // Dynamic maxTokens based on what the response needs to contain,
      // not just complexity. Factual questions get 80, coding gets 512, etc.
      const responseType = classifyResponseType(input);
      const maxTokens = getMaxTokensForResponseType(responseType);

      const response = await ctx.provider.complete({
        model,
        prompt: input,
        messages: chatMessages,
        temperature: 0.8,
        maxTokens,
      });
      const t4 = Date.now();
      console.log(
        `[timing] chat.execute total=${t4 - t0}ms parallel=${t1 - t0}ms llm=${t4 - t1}ms`,
      );

      const reply = response.text.trim();
      await ctx.memory.add("assistant", reply);

      ctx.reply(reply);

      return { text: reply };
    },

    async executeStream(
      input: string,
      ctx: ServiceContext,
      callbacks: {
        onToken?: (token: string) => void;
        onDone?: (text: string) => void;
        onError?: (error: Error) => void;
      },
    ): Promise<void> {
      const resolvedModel = resolveModel(input);
      // Extract facts from user message for dynamic memory
      extractFacts(input);
      const [, chatResult] = await Promise.all([
        ctx.memory.add("user", input),
        buildChatMessages(input, ctx, personality, resolvedModel, getMemoryBlock()),
      ]);

      const { systemMessage, chatMessages, recentHistory } = chatResult;

      if (!ctx.provider) {
        callbacks.onError?.(new Error("Chat provider not configured."));
        return;
      }

      if (!ctx.provider.completeStream) {
        // Fall back to non-streaming completion
        try {
          const responseType = classifyResponseType(input);
          const maxTokens = getMaxTokensForResponseType(responseType);
          const response = await ctx.provider.complete({
            model: resolvedModel,
            prompt: input,
            messages: chatMessages,
            temperature: 0.8,
            maxTokens,
          });
          const reply = response.text.trim();
          await ctx.memory.add("assistant", reply);
          callbacks.onToken?.(reply);
          callbacks.onDone?.(reply);
        } catch (err) {
          callbacks.onError?.(
            err instanceof Error ? err : new Error(String(err)),
          );
        }
        return;
      }

      let fullText = "";
      const provider = ctx.provider as NonNullable<typeof ctx.provider>;
      if (!provider.completeStream) {
        callbacks.onError?.(new Error("Streaming not supported."));
        return;
      }
      const t0 = Date.now();
      console.log(
        `[stream] executeStream start messages=${chatMessages.length} hasCompleteStream=${!!provider?.completeStream}`,
      );
      const streamResponseType = classifyResponseType(input);
      const maxTokens = getMaxTokensForResponseType(streamResponseType);
      await provider.completeStream(
        {
          model: resolvedModel,
          prompt: input,
          messages: chatMessages,
          temperature: 0.8,
          maxTokens,
        },
        {
          onToken: (token: string) => {
            fullText += token;
            callbacks.onToken?.(token);
          },
          onDone: async (response: { text: string }) => {
            const reply = response.text.trim() || fullText.trim();
            console.log(
              `[stream] executeStream done elapsed=${Date.now() - t0}ms responseTextLen=${response.text.length} fullTextLen=${fullText.length} reply=${reply.slice(0, 80)}`,
            );
            // qwen3 occasionally ignores think:false and streams nothing but
            // a reasoning trace (empty content, done_reason=length). Fall
            // back to a single non-streaming call (which retries internally)
            // so the user still gets an answer.
            if (reply.length === 0) {
              console.log(
                "[stream] empty stream, falling back to non-streaming complete",
              );
              try {
                // Use only messages array (Ollama uses this, flat prompt is ignored)
                // Include prompt for compatibility with CompletionRequest interface
                const fallbackResponseType = classifyResponseType(input);
                const fallbackMaxTokens = getMaxTokensForResponseType(fallbackResponseType);
                const response2 = await provider.complete({
                  model: "default",
                  prompt: input,
                  messages: chatMessages,
                  temperature: 0.8,
                  maxTokens: fallbackMaxTokens,
                });
                const fallback = response2.text.trim();
                await ctx.memory.add("assistant", fallback);
                ctx.reply(fallback);
                callbacks.onToken?.(fallback);
                callbacks.onDone?.(fallback);
                return;
              } catch (err) {
                callbacks.onError?.(
                  err instanceof Error ? err : new Error(String(err)),
                );
                return;
              }
            }
            await ctx.memory.add("assistant", reply);
            ctx.reply(reply);
            callbacks.onDone?.(reply);
          },
          onError: (error: Error) => {
            callbacks.onError?.(error);
          },
        },
      );
    },
  };
}
