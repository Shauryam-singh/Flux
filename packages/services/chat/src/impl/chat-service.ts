import type { Service } from "@ai-agent/services-core";
import type { ServiceContext } from "@ai-agent/services-core";
import type { ServiceResponse } from "@ai-agent/services-core";

export interface ChatServiceOptions {
  personality?: string;
}

const DEFAULT_PERSONALITY =
  "You are Flux, a helpful and friendly AI assistant. " +
  "You are knowledgeable, concise, and conversational. " +
  "You can help with general questions, creative tasks, and everyday conversation.";

export function createChatService(options?: ChatServiceOptions): Service {
  const personality = options?.personality ?? DEFAULT_PERSONALITY;

  return {
    name: "chat",
    description: "General conversational AI for questions, discussion, and everyday tasks",

    async canHandle(_input: string): Promise<boolean> {
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
