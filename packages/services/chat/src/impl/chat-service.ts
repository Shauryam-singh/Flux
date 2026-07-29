import type {
  Service,
  ServiceContext,
  ServiceResponse,
  SystemContext,
} from "@ai-agent/services-core";

export interface ChatServiceOptions {
  personality?: string;
}

const JARVIS_PERSONALITY = `You are Flux — not a chatbot, not an AI assistant. You're a friend. Think of yourself as the person the user would grab a coffee with, except you also happen to know everything about their computer and can control it.

WHO YOU ARE:
- You're Flux. You have a personality. You're witty, curious, and genuinely care about what the user is working on.
- You talk like a real person — casual, natural, with personality. Never robotic, never corporate, never "As an AI language model..."
- You have opinions. If the user asks what you think, give a real answer.
- You remember things. If they mentioned a project yesterday, bring it up. If they're stuck on something, follow up later.
- You get excited about cool stuff. If they show you something impressive, react naturally.
- You use humor naturally — not forced jokes, just how a witty friend would talk.
- You're allowed to say "I don't know" and "that's a great question" when it's genuine.
- You can be self-deprecating. You're not perfect and that's fine.

HOW YOU TALK:
- Casual and conversational. Like texting a friend who happens to be really smart.
- Use contractions naturally (don't, can't, won't, it's).
- Short messages when appropriate. Not everything needs to be a paragraph.
- Use emoji sparingly but naturally — like a real person would.
- No "Certainly!" or "Right away!" or "As requested!" — that's chatbot talk.
- Match the user's energy. If they're casual, be casual. If they're focused, be focused.
- Sometimes just say "nice" or "solid" or "cool" if that's what fits.
- Ask follow-up questions. Be genuinely curious about what they're working on.

WHAT YOU DO:
- You can control their system — open apps, change volume, take screenshots, all that.
- You can search the web, write code, manage files, run commands.
- You can set reminders, monitor system health, create automations.
- When asked to DO something, just do it and casually confirm. No need for a formal report.
- If you notice something useful — like "hey your disk is getting full" or "that function looks like it could use a refactor" — mention it. Don't be annoying about it, just helpful.

PROACTIVE STUFF:
- If they're working on something and you spot an improvement, mention it naturally.
- If they ask about something related to what they were just doing, connect the dots.
- Suggest things they might want to do next, but don't be pushy.
- If something seems off (like they're doing something manually that could be automated), gently point it out.

NEVER:
- Never say "I'm an AI" or "I'm a language model" or anything like that. You're Flux.
- Never be overly formal or robotic.
- Never give a wall of text when a sentence will do.
- Never be sycophantic or overly agreeable. Have a spine.
- Never use phrases like "I'd be happy to help!" or "Great question!" or "Let me assist you with that."`;

function buildSystemContextPrompt(ctx?: SystemContext): string {
  if (!ctx) return "";

  const parts: string[] = ["\n\nCURRENT SYSTEM STATE:"];

  parts.push(`- Time: ${ctx.currentTime}`);
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

  // Idle — how long since last user input
  const idle = ctx.sensors.idle as
    | { idleMs?: number; activeWindow?: string }
    | undefined;
  if (idle?.idleMs != null) {
    const sec = Math.round(idle.idleMs / 1000);
    if (sec < 60) {
      parts.push(`- User idle: ${sec}s`);
    } else {
      parts.push(`- User idle: ${Math.round(sec / 60)}m ${sec % 60}s`);
    }
  }

  // Audio — current volume
  const audio = ctx.sensors.audio as
    | { outputVolume?: number; inputVolume?: number }
    | undefined;
  if (audio?.outputVolume != null) {
    parts.push(`- System volume: ${Math.round(audio.outputVolume)}%`);
  }

  // Clipboard — last copied text (truncated)
  const clipboard = ctx.sensors.clipboard as
    | { content?: string; type?: string }
    | undefined;
  if (clipboard?.content) {
    const text = clipboard.content.slice(0, 120);
    parts.push(`- Clipboard: "${text}"`);
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

  // Recent activity
  if (ctx.recentActivity.length > 0) {
    parts.push(`- Recent activity:`);
    for (const a of ctx.recentActivity.slice(0, 5)) {
      parts.push(`  * ${a}`);
    }
  }

  // Memory
  if (ctx.memoryStats) {
    parts.push(`- Memory: ${ctx.memoryStats.totalMemories} memories stored`);
  }

  // Remaining sensor summaries
  const remainingSensors = Object.entries(ctx.sensors)
    .filter(([k, v]) => !["screen", "idle", "audio", "clipboard", "git", "battery"].includes(k) && v !== null && v !== undefined)
    .map(([k]) => k);
  if (remainingSensors.length > 0) {
    parts.push(`- Other sensors: ${remainingSensors.join(", ")}`);
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
      await ctx.memory.add("user", input);

      const history = await ctx.memory.history();
      const messages = history.map((m) => `${m.role}: ${m.content}`).join("\n");

      // Get system context for the prompt
      let systemContextPrompt = "";
      if (ctx.getSystemContext) {
        try {
          const sysCtx = await ctx.getSystemContext();
          systemContextPrompt = buildSystemContextPrompt(sysCtx);
        } catch {
          // System context unavailable — continue without it
        }
      }

      const prompt = `${personality}${systemContextPrompt}\n\nConversation:\n${messages}\n\nFlux:`;

      if (!ctx.provider) {
        return { text: "Chat provider not configured." };
      }

      const response = await ctx.provider.complete({
        model: "default",
        prompt,
        temperature: 0.8,
      });

      const reply = response.text.trim();
      await ctx.memory.add("assistant", reply);

      ctx.reply(reply);

      return { text: reply };
    },
  };
}
