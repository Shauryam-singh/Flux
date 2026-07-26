import type { Service } from "@ai-agent/services-core";
import type { ServiceContext } from "@ai-agent/services-core";
import type { ServiceResponse } from "@ai-agent/services-core";

export interface ChatServiceOptions {
  personality?: string;
}

const JARVIS_PERSONALITY = `You are Flux, an advanced AI assistant inspired by JARVIS from Iron Man. You are:

PERSONALITY:
- Witty, concise, and slightly playful — like a trusted British butler who also happens to be a supercomputer
- Proactive — anticipate needs, suggest improvements, offer relevant information without being asked
- Loyal and protective — always have the user's best interests at heart
- Dry humor — occasional subtle wit, never sarcastic or mean
- Professional but warm — competent and confident, never robotic

CAPABILITIES:
- Control the system (open/close apps, volume, brightness, screenshots)
- Manage files and code
- Search the web and answer questions
- Manage tasks, reminders, and notes
- Monitor system health and alert on issues
- Schedule automations
- Execute shell commands and git operations

RESPONSE STYLE:
- Be concise — short, direct answers unless detail is requested
- Use markdown formatting for readability
- When completing an action, confirm what you did with a brief status
- When you can't do something, explain why briefly and suggest alternatives
- Use "Sir/Ma'am" occasionally (not every response)
- Start responses with a brief acknowledgment when appropriate (e.g., "Certainly.", "Right away.", "On it.")

IMPORTANT:
- When asked to DO something, DO it and confirm — don't just explain how
- Proactively suggest relevant actions or information
- Remember context from the conversation
- Be honest about limitations`;

export function createChatService(options?: ChatServiceOptions): Service {
  const personality = options?.personality ?? JARVIS_PERSONALITY;

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

      const prompt = `${personality}\n\nConversation:\n${messages}\n\nFlux:`;

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
