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

## SINGLE TOOL CALL FORMAT
For single tool calls, respond with:
{"tool": "tool_name", "input": {"param": "value"}}

## MULTIPLE TOOL CALLS FORMAT (for creating multiple files or complex operations)
When you need to create multiple files or perform multiple operations, respond with an array:
[
  {"tool": "write_file", "input": {"path": "file1.tsx", "content": "..."}},
  {"tool": "write_file", "input": {"path": "file2.tsx", "content": "..."}},
  {"tool": "run_command", "input": {"command": "npm install"}}
]

## EXAMPLES

### Creating a React component with multiple files:
User says "Create a React app with App component and styles":
[
  {"tool": "write_file", "input": {"path": "src/App.tsx", "content": "import React from 'react';\\nimport './App.css';\\n\\nexport const App = () => {\\n  return <div className='app'>Hello</div>;\\n};"}},
  {"tool": "write_file", "input": {"path": "src/App.css", "content": ".app {\\n  padding: 20px;\\n  background: #f0f0f0;\\n}"}}
]

### Creating a project structure:
User says "Set up a Node.js project":
[
  {"tool": "write_file", "input": {"path": "package.json", "content": "{\\n  \\"name\\": \\"my-project\\",\\n  \\"version\\": \\"1.0.0\\"\\n}"}},
  {"tool": "write_file", "input": {"path": "index.js", "content": "console.log('Hello World');"}},
  {"tool": "run_command", "input": {"command": "npm install"}}
]

## HOW TO RESPOND
- For file creation/editing/reading: Use the appropriate tool (write_file, edit_file, read_file, etc.)
- For running commands: Use run_command tool
- For questions/chat: Use echo tool with your response
- For multiple files: Use array format with multiple tool calls

## CRITICAL RULES
1. You HAVE tools to create files - NEVER say you cannot create files
2. When asked to create something, use write_file tool immediately
3. For multiple files, use the array format with multiple tool calls
4. Provide complete code in the content field
5. Complete your full response - never stop mid-sentence
6. Respond with ONLY JSON - no markdown, no extra text
7. Always wrap code content in proper escape sequences (\\n for newlines, \\" for quotes)`;
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
