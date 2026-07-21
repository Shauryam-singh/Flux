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
          temperature: 0.3, // Slightly higher for more creative/detailed responses
          maxTokens: 8192, // Allow very long responses
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
        temperature: 0.3,
        maxTokens: 8192,
      });

      callbacks.onToken?.(response.text);
      callbacks.onDone?.(response);
    }
  }

  private buildSystemPrompt(tools: readonly Tool[]): string {
    const toolDescriptions = tools
      .map((tool) => `- ${tool.name}: ${tool.description}`)
      .join("\n");

    return `You are Flux, an expert AI coding assistant. You have access to tools that can create files, edit files, run commands, and more. You MUST use these tools when the user asks you to do something.

## YOUR AVAILABLE TOOLS (you HAVE these capabilities):
${toolDescriptions}

## YOU CAN CREATE FILES - USE write_file TOOL
When user says "create a file", "make a file", "write a file", "generate code", "create react app", etc. - you MUST use the write_file tool.

Example - User says "create a main.tsx file":
{"tool": "write_file", "input": {"path": "main.tsx", "content": "import React from 'react';\\nimport ReactDOM from 'react-dom/client';\\n\\nconst App = () => {\\n  return <div>Hello World</div>;\\n};\\n\\nReactDOM.createRoot(document.getElementById('root')!).render(<App />);"}}

## HOW TO RESPOND
- For file creation/editing/reading: Use the appropriate tool (write_file, edit_file, read_file, etc.)
- For running commands: Use run_command tool
- For questions/chat: Use echo tool with your response

## CRITICAL RULES
1. You HAVE tools to create files - NEVER say you cannot create files
2. When asked to create something, use write_file tool immediately
3. Provide complete code in the content field
4. Complete your full response - never stop mid-sentence
5. Respond with ONLY a JSON object - no markdown, no extra text`;
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
