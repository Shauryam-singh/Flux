import type {
  Service,
  ServiceContext,
  ServiceResponse,
  SystemContext,
} from "@ai-agent/services-core";
import { detectModelComplexity } from "@ai-agent/services-core";

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
  if (model.includes("0.5b")) return 300;  // 300 chars for small model
  return 600;
}

async function buildChatMessages(
  input: string,
  ctx: ServiceContext,
  personality: string,
  model: string = "default",
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

  // Get system context for the prompt (abbreviated for small models)
  let systemContextPrompt = "";
  if (ctx.getSystemContext) {
    try {
      const sysCtx = await ctx.getSystemContext();
      systemContextPrompt = buildSystemContextPrompt(sysCtx, model);
    } catch {
      // System context unavailable — continue without it
    }
  }

  // Send a proper system/user/assistant message sequence instead of a
  // flat blob. A single giant "user" message makes qwen3 dump its
  // reasoning + restate the prompt/system state, producing the
  // 10+ line garbage reply.
  const systemMessage = `${personality}${systemContextPrompt}`;
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

export function createChatService(options?: ChatServiceOptions): Service {
  const personality = options?.personality ?? JARVIS_PERSONALITY;

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
      // Parallelize memory add and context building for faster response
      const [, chatResult] = await Promise.all([
        ctx.memory.add("user", input),
        buildChatMessages(input, ctx, personality),
      ]);
      const t1 = Date.now();

      const { systemMessage, chatMessages, recentHistory } = chatResult;

      if (!ctx.provider) {
        return { text: "Chat provider not configured." };
      }

      // Use only messages array (Ollama uses this, flat prompt is ignored)
      // Include prompt for compatibility with CompletionRequest interface
      // Dynamic maxTokens based on query complexity
      const complexity = detectModelComplexity(input);
      const maxTokens = complexity === "simple" ? 80 : complexity === "medium" ? 200 : 500;

      const response = await ctx.provider.complete({
        model: "default",
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
      // Parallelize memory add and context building for faster streaming
      const [, chatResult] = await Promise.all([
        ctx.memory.add("user", input),
        buildChatMessages(input, ctx, personality),
      ]);

      const { systemMessage, chatMessages, recentHistory } = chatResult;

      if (!ctx.provider) {
        callbacks.onError?.(new Error("Chat provider not configured."));
        return;
      }

      if (!ctx.provider.completeStream) {
        // Fall back to non-streaming completion
        try {
          // Use only messages array (Ollama uses this, flat prompt is ignored)
          // Include prompt for compatibility with CompletionRequest interface
          const complexity = detectModelComplexity(input);
          const maxTokens = complexity === "simple" ? 80 : complexity === "medium" ? 200 : 500;
          const response = await ctx.provider.complete({
            model: "default",
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
      // Use only messages array (Ollama uses this, flat prompt is ignored)
      // Include prompt for compatibility with CompletionRequest interface
      const complexity = detectModelComplexity(input);
      const maxTokens = complexity === "simple" ? 80 : complexity === "medium" ? 200 : 500;
      await provider.completeStream(
        {
          model: "default",
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
                const fallbackComplexity = detectModelComplexity(input);
                const fallbackMaxTokens = fallbackComplexity === "simple" ? 80 : fallbackComplexity === "medium" ? 200 : 500;
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
