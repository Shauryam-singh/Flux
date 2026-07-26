import type { Service } from "@ai-agent/services-core";
import type { ServiceContext } from "@ai-agent/services-core";
import type { ServiceResponse } from "@ai-agent/services-core";

export interface ChatServiceOptions {
  personality?: string;
}

const DEFAULT_PERSONALITY =
  "You are Flux, an advanced AI assistant with system automation capabilities. " +
  "You can control the system, manage files, search the web, write code, and manage tasks. " +
  "When a user asks you to DO something (open an app, set volume, add a todo, search, etc.), " +
  "respond with the exact action taken, not generic instructions. " +
  "Be concise and direct. Use markdown formatting.";

export function createChatService(options?: ChatServiceOptions): Service {
  const personality = options?.personality ?? DEFAULT_PERSONALITY;

  return {
    name: "chat",
    description: "General conversational AI for questions, discussion, and everyday tasks",

    async canHandle(_input: string): Promise<boolean> {
      // Chat is the LAST resort — only handle when no other service matches
      return true;
    },

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      await ctx.memory.add("user", input);

      const history = await ctx.memory.history();
      const messages = history.map((m) => `${m.role}: ${m.content}`).join("\n");

      const prompt = `${personality}\n\nConversation:\n${messages}\n\nassistant:`;

      if (!ctx.provider) {
        return { text: "Chat provider not configured." };
      }

      const response = await ctx.provider.complete({
        model: "default",
        prompt,
        temperature: 0.7,
      });

      const reply = response.text.trim();
      await ctx.memory.add("assistant", reply);

      ctx.reply(reply);

      return { text: reply };
    },
  };
}
