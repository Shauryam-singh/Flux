import type { Provider } from "@ai-agent/providers";
import type { Tool, ToolCall, ToolRegistry } from "@ai-agent/tools";

import type { Session } from "../session/session.js";
import type { AgentRequest } from "../types/agent-request.js";
import type { Planner } from "./planner.js";

interface PlannedToolCall {
  readonly tool: string;
  readonly input: Record<string, unknown>;
}

export class LlmPlanner implements Planner {
  private readonly model: string;

  private readonly maxIterations: number;

  public constructor(
    private readonly provider: Provider,
    private readonly toolRegistry: ToolRegistry,
    options?: {
      readonly model?: string;
      readonly maxIterations?: number;
    },
  ) {
    this.model = options?.model ?? "qwen2.5:0.5b";
    this.maxIterations = options?.maxIterations ?? 5;
  }

  public async plan(
    session: Session,
    request: AgentRequest,
  ): Promise<ToolCall> {
    const tools = this.toolRegistry.getAll();
    const history = await session.memory.history();

    const systemPrompt = this.buildSystemPrompt(tools);
    const userMessage = this.buildUserMessage(request, history);

    const fullPrompt = `${systemPrompt}\n\n${userMessage}`;

    const response = await this.provider.complete({
      model: this.model,
      prompt: fullPrompt,
      temperature: 0.1,
    });

    const parsed = this.parseResponse(response.text);

    return {
      name: parsed.tool,
      input: parsed.input,
    };
  }

  private buildSystemPrompt(tools: readonly Tool[]): string {
    const toolDescriptions = tools
      .map((tool) => `- ${tool.name}: ${tool.description}`)
      .join("\n");

    return `You are a planning agent. Your job is to select the best tool for the user's request.

Available tools:
${toolDescriptions}

Respond with a JSON object containing:
- "tool": the name of the tool to use
- "input": an object with the parameters to pass to the tool

Rules:
- Select the most appropriate tool for the task
- If no tool matches, use "echo" with the user's message as input
- Respond ONLY with the JSON object, no other text
- Do not wrap in markdown code blocks`;
  }

  private buildUserMessage(
    request: AgentRequest,
    history: readonly { role: string; content: string }[],
  ): string {
    const contextParts: string[] = [];

    if (history.length > 0) {
      const recentHistory = history.slice(-10);
      const historyText = recentHistory
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join("\n");
      contextParts.push(`Conversation history:\n${historyText}`);
    }

    contextParts.push(`User request: ${JSON.stringify(request.input)}`);

    return contextParts.join("\n\n");
  }

  private parseResponse(text: string): PlannedToolCall {
    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    try {
      const parsed = JSON.parse(cleaned) as PlannedToolCall;

      if (typeof parsed.tool !== "string") {
        return { tool: "echo", input: { message: text } };
      }

      return {
        tool: parsed.tool,
        input:
          typeof parsed.input === "object" && parsed.input !== null
            ? parsed.input
            : {},
      };
    } catch {
      return { tool: "echo", input: { message: text } };
    }
  }
}
