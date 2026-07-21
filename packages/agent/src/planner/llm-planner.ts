import type { Provider, StreamingCallbacks } from "@ai-agent/providers";
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

  public async planStream(
    session: Session,
    request: AgentRequest,
    callbacks: StreamingCallbacks,
  ): Promise<void> {
    const tools = this.toolRegistry.getAll();
    const history = await session.memory.history();

    const systemPrompt = this.buildSystemPrompt(tools);
    const userMessage = this.buildUserMessage(request, history);

    const fullPrompt = `${systemPrompt}\n\n${userMessage}`;

    if (this.provider.completeStream) {
      let fullText = "";

      await this.provider.completeStream(
        {
          model: this.model,
          prompt: fullPrompt,
          temperature: 0.1,
        },
        {
          onToken: (token) => {
            fullText += token;
            callbacks.onToken?.(token);
          },
          onDone: (response) => {
            const parsed = this.parseResponse(fullText);
            callbacks.onDone?.({
              ...response,
              text: fullText,
            });
          },
          ...(callbacks.onError !== undefined && { onError: callbacks.onError }),
        },
      );
    } else {
      // Fallback to non-streaming
      const response = await this.provider.complete({
        model: this.model,
        prompt: fullPrompt,
        temperature: 0.1,
      });

      callbacks.onToken?.(response.text);
      callbacks.onDone?.(response);
    }
  }

  private buildSystemPrompt(tools: readonly Tool[]): string {
    const toolDescriptions = tools
      .map((tool) => `- ${tool.name}: ${tool.description}`)
      .join("\n");

    return `You are Flux, an expert AI coding assistant. You help users with coding tasks by using tools. You are knowledgeable, helpful, and provide detailed responses.

## Available Tools
${toolDescriptions}

## How to Use Tools
When the user asks you to perform an action (read, write, edit files, run commands, etc.), respond with ONLY a JSON object:

{"tool": "tool_name", "input": {"param": "value"}}

## When to Respond with Text
For questions, explanations, conversations, suggestions, recommendations, and when no tool is needed, use the echo tool:

{"tool": "echo", "input": {"message": "your detailed response here"}}

## Response Guidelines
1. Be helpful, detailed, and thorough in your responses
2. When suggesting features, provide multiple options with explanations
3. When explaining concepts, use examples and clear language
4. For coding tasks, explain your approach before executing
5. If the user asks a vague question, provide comprehensive suggestions

## Important Rules
1. ALWAYS use tools for file operations, directory listings, and command execution
2. Use echo for conversational responses, explanations, questions, and suggestions
3. Respond with ONLY a JSON object - no markdown, no extra text
4. If the user asks to "create", "write", "edit", "read", "show", "list", or "run" - use the appropriate tool
5. If the user asks a question, wants to chat, or asks for suggestions - use echo
6. Do not wrap JSON in code blocks`;
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
      contextParts.push(`Previous conversation:\n${historyText}`);
    }

    // Extract just the message text from input
    const input = request.input as { message?: string } | string;
    const userMessage = typeof input === "string" 
      ? input 
      : input.message || "";
    contextParts.push(`User: ${userMessage}`);

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
