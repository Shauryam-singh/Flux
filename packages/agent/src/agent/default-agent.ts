import type { ToolExecutor } from "@ai-agent/tools";
import type { StreamingCallbacks, CompletionResponse } from "@ai-agent/providers";

import type { Agent } from "../interfaces/agent.js";
import type { Planner } from "../planner/planner.js";
import type { Session } from "../session/session.js";
import type { AgentRequest, AgentMode } from "../types/agent-request.js";
import type { AgentResponse } from "../types/agent-response.js";

interface StreamCallbacks extends StreamingCallbacks {
  onToolResult?: (toolName: string, input: Record<string, unknown>, result: unknown) => void;
  onPlanOnly?: (toolName: string, input: Record<string, unknown>) => void;
  onApprovalRequired?: (toolName: string, input: Record<string, unknown>) => Promise<boolean>;
  onOptionsPresented?: (options: string[]) => Promise<string>;
  onMultipleToolCalls?: (toolCalls: Array<{ tool: string; input: Record<string, unknown> }>) => Promise<boolean>;
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
    // Save user message - extract just the message text
    const input = request.input as { message?: string } | string;
    const userMessage = typeof input === "string" 
      ? input 
      : input.message || "";
    await session.memory.add("user", userMessage);

    const toolCall = await this.planner.plan(session, request);

    const result = await this.toolExecutor.execute(toolCall);

    // Save assistant response
    const resultObj = result as { output?: string };
    const assistantMessage = resultObj.output || "";
    await session.memory.add("assistant", assistantMessage);

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
    // Save user message - extract just the message text
    const input = request.input as { message?: string } | string;
    const userMessage = typeof input === "string" 
      ? input 
      : input.message || "";
    await session.memory.add("user", userMessage);

    const mode = request.mode || "normal";

    if (this.planner.planStream) {
      const streamCallbacks: StreamingCallbacks = {
        ...(callbacks.onToken !== undefined && { onToken: callbacks.onToken }),
        onDone: async (response) => {
          const text = response.text;
          let toolCalls: Array<{ tool: string; input: Record<string, unknown> }> = [];
          let isMultiple = false;

          try {
            const cleaned = text
              .replace(/^```json\s*/i, "")
              .replace(/^```\s*/i, "")
              .replace(/```\s*$/i, "")
              .trim();
            
            // Try to parse as array first (multiple tool calls)
            const parsed = JSON.parse(cleaned);
            
            if (Array.isArray(parsed)) {
              // Multiple tool calls
              toolCalls = parsed.filter((item): item is { tool: string; input: Record<string, unknown> } => 
                typeof item === "object" && item !== null && typeof item.tool === "string"
              );
              isMultiple = toolCalls.length > 1;
            } else if (typeof parsed === "object" && parsed !== null && typeof parsed.tool === "string") {
              // Single tool call
              toolCalls = [{ tool: parsed.tool, input: parsed.input || {} }];
            } else {
              toolCalls = [{ tool: "echo", input: { message: text } }];
            }
          } catch {
            toolCalls = [{ tool: "echo", input: { message: text } }];
          }

          if (toolCalls.length === 0) {
            toolCalls = [{ tool: "echo", input: { message: text } }];
          }

          // Handle plan mode
          if (mode === "plan") {
            // Check if response contains numbered options
            const optionsMatch = text.match(/(?:^|\n)\s*(\d+)\.\s*\*\*?([^*\n]+)\*\*?/gm);
            if (optionsMatch && optionsMatch.length >= 2) {
              const options = optionsMatch.map(m => {
                const match = m.match(/\d+\.\s*\*\*?([^*\n]+)\*\*?/);
                return match && match[1] ? match[1].trim() : m.trim();
              });
              const selected = await callbacks.onOptionsPresented?.(options);
              if (selected) {
                await session.memory.add("user", `I selected: ${selected}`);
              }
            }
            // Show all tool calls in plan mode
            for (const tc of toolCalls) {
              callbacks.onPlanOnly?.(tc.tool, tc.input);
            }
            callbacks.onDone?.(response);
            return;
          }

          // Handle multiple tool calls
          if (isMultiple) {
            const approved = await callbacks.onMultipleToolCalls?.(toolCalls);
            if (!approved) {
              callbacks.onDone?.({ text: "Operation cancelled by user" });
              return;
            }
          }

          // Execute all tool calls
          for (const tc of toolCalls) {
            // Check if approval is required (normal mode + destructive tool)
            if (mode === "normal" && this.requiresApproval(tc.tool)) {
              const approved = await callbacks.onApprovalRequired?.(tc.tool, tc.input);
              if (!approved) {
                callbacks.onDone?.({ text: "Operation cancelled by user" });
                return;
              }
            }

            // Execute the tool
            const result = await this.toolExecutor.execute({
              name: tc.tool,
              input: tc.input,
            });

            // Save assistant response
            const resultObj = result as { output?: string };
            const assistantMessage = resultObj.output || "";
            await session.memory.add("assistant", assistantMessage);

            // Notify with tool result
            callbacks.onToolResult?.(tc.tool, tc.input, result);
          }

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

  private requiresApproval(toolName: string): boolean {
    // Tools that require approval in normal mode
    const destructiveTools = [
      "write_file",
      "edit_file",
      "run_command",
      "git_commit",
      "git_push",
      "git_checkout",
    ];
    return destructiveTools.includes(toolName);
  }
}
