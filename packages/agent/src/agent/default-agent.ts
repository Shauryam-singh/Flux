import type { ToolExecutor } from "@ai-agent/tools";
import type { StreamingCallbacks, CompletionResponse } from "@ai-agent/providers";

import type { Agent } from "../interfaces/agent.js";
import type { Planner } from "../planner/planner.js";
import type { Session } from "../session/session.js";
import type { AgentRequest } from "../types/agent-request.js";
import type { AgentResponse } from "../types/agent-response.js";

interface StreamCallbacks extends StreamingCallbacks {
  onToolResult?: (toolName: string, input: Record<string, unknown>, result: unknown) => void;
}

export class DefaultAgent implements Agent {
  constructor(
    private readonly planner: Planner,
    private readonly toolExecutor: ToolExecutor,
  ) {}

  public async run(
    session: Session,
    request: AgentRequest,
  ): Promise<AgentResponse> {
    // Save user message
    await session.memory.add("user", JSON.stringify(request.input));

    const toolCall = await this.planner.plan(session, request);

    const result = await this.toolExecutor.execute(toolCall);

    // Save assistant response
    await session.memory.add("assistant", JSON.stringify(result));

    return {
      success: true,
      result,
    };
  }

  public async runStream(
    session: Session,
    request: AgentRequest,
    callbacks: StreamCallbacks,
  ): Promise<void> {
    // Save user message
    await session.memory.add("user", JSON.stringify(request.input));

    if (this.planner.planStream) {
      const streamCallbacks: StreamingCallbacks = {
        ...(callbacks.onToken !== undefined && { onToken: callbacks.onToken }),
        onDone: async (response) => {
          const text = response.text;
          let parsed: { tool: string; input: Record<string, unknown> };

          try {
            const cleaned = text
              .replace(/^```json\s*/i, "")
              .replace(/^```\s*/i, "")
              .replace(/```\s*$/i, "")
              .trim();
            parsed = JSON.parse(cleaned) as { tool: string; input: Record<string, unknown> };
            if (typeof parsed.tool !== "string") {
              parsed = { tool: "echo", input: { message: text } };
            }
          } catch {
            parsed = { tool: "echo", input: { message: text } };
          }

          // Execute the tool
          const result = await this.toolExecutor.execute({
            name: parsed.tool,
            input: parsed.input,
          });

          // Save assistant response
          await session.memory.add("assistant", JSON.stringify(result));

          // Notify with tool result
          callbacks.onToolResult?.(parsed.tool, parsed.input, result);
          callbacks.onDone?.(response);
        },
        ...(callbacks.onError !== undefined && { onError: callbacks.onError }),
      };

      await this.planner.planStream(session, request, streamCallbacks);
    } else {
      // Fallback to non-streaming
      const response = await this.run(session, request);
      callbacks.onDone?.({
        text: response.result?.output as string || "",
      });
    }
  }
}
