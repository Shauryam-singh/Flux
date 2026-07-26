import type { Service } from "@ai-agent/services-core";
import type { ServiceContext } from "@ai-agent/services-core";
import type { ServiceResponse } from "@ai-agent/services-core";
import type { ToolRegistry } from "@ai-agent/tools";

export interface CodingServiceOptions {
  toolRegistry: ToolRegistry;
}

export function createCodingService(options: CodingServiceOptions): Service {
  const { toolRegistry } = options;

  return {
    name: "coding",
    description: "Code assistant for writing, editing, reading files, running commands, and git operations",

    async canHandle(input: string): Promise<boolean> {
      const lower = input.toLowerCase();
      const keywords = [
        "code", "file", "function", "bug", "fix", "refactor",
        "write", "edit", "create file", "read file", "compile",
        "build", "test", "debug", "import", "export", "class",
        "interface", "type", "variable", "git", "commit", "branch",
        "merge", "push", "pull", "diff", "status", "repository",
        "program", "script", "module", "package", "dependency",
      ];
      return keywords.some((k) => lower.includes(k));
    },

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      await ctx.memory.add("user", input);

      const tools = toolRegistry.getAll();
      const toolList = tools.map((t) => `- ${t.name}: ${t.description}`).join("\n");

      const history = await ctx.memory.history();
      const messages = history.map((m) => `${m.role}: ${m.content}`).join("\n");

      const prompt = [
        "You are Flux, an expert coding assistant.",
        "You have access to tools for file operations, git, and shell commands.",
        "",
        "Available tools:",
        toolList,
        "",
        "When asked to do something, use the appropriate tool.",
        "Respond with a JSON tool call: {\"tool\": \"tool_name\", \"input\": {...}}",
        "For general conversation, respond with: {\"tool\": \"echo\", \"input\": {\"message\": \"your response\"}}",
        "",
        "Conversation:",
        messages,
        "",
        "assistant:",
      ].join("\n");

      if (!ctx.provider) {
        return { text: "Coding service provider not configured." };
      }

      const response = await ctx.provider.complete({
        model: "default",
        prompt,
        temperature: 0.3,
      });

      const text = response.text.trim();

      let toolCall: { tool: string; input: Record<string, unknown> } | null = null;
      try {
        const cleaned = text
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();
        const parsed = JSON.parse(cleaned) as Record<string, unknown>;
        if (typeof parsed === "object" && parsed !== null && typeof parsed.tool === "string") {
          toolCall = {
            tool: parsed.tool,
            input: (typeof parsed.input === "object" && parsed.input !== null
              ? parsed.input
              : {}) as Record<string, unknown>,
          };
        }
      } catch {
        // Not JSON — treat as echo
        toolCall = { tool: "echo", input: { message: text } };
      }

      if (!toolCall) {
        toolCall = { tool: "echo", input: { message: text } };
      }

      if (toolCall.tool === "echo") {
        const msg = (toolCall.input.message as string) ?? text;
        await ctx.memory.add("assistant", msg);
        ctx.reply(msg);
        return { text: msg };
      }

      const tool = toolRegistry.get(toolCall.tool);
      if (!tool) {
        const fallback = `Tool "${toolCall.tool}" not found.`;
        ctx.reply(fallback);
        return { text: fallback };
      }

      const result = await tool.execute(toolCall.input);
      const resultObj = result as { output?: string; success?: boolean };
      const output = resultObj.output ?? (resultObj.success ? "Done" : "Failed");

      await ctx.memory.add("assistant", output);
      ctx.reply(output);

      return { text: output };
    },
  };
}
