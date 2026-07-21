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

          // Handle based on mode
          if (mode === "plan") {
            // Plan mode: show what would be done, don't execute
            // Check if response contains numbered options for user selection
            const optionsMatch = text.match(/(?:^|\n)\s*(\d+)\.\s*\*\*?([^*\n]+)\*\*?/gm);
            if (optionsMatch && optionsMatch.length >= 2) {
              // Extract options
              const options = optionsMatch.map(m => {
                const match = m.match(/\d+\.\s*\*\*?([^*\n]+)\*\*?/);
                return match && match[1] ? match[1].trim() : m.trim();
              });
              // Present options and get user selection
              const selected = await callbacks.onOptionsPresented?.(options);
              if (selected) {
                // User selected an option, continue conversation
                await session.memory.add("user", `I selected: ${selected}`);
              }
            }
            callbacks.onPlanOnly?.(parsed.tool, parsed.input);
            callbacks.onDone?.(response);
            return;
          }

          // Check if approval is required (normal mode + destructive tool)
          if (mode === "normal" && this.requiresApproval(parsed.tool)) {
            const approved = await callbacks.onApprovalRequired?.(parsed.tool, parsed.input);
            if (!approved) {
              callbacks.onDone?.({
                text: "Operation cancelled by user",
              });
              return;
            }
          }

          // Execute the tool (auto mode or approved normal mode)
          const result = await this.toolExecutor.execute({
            name: parsed.tool,
            input: parsed.input,
          });

          // Save assistant response - extract meaningful content
          const resultObj = result as { output?: string };
          const assistantMessage = resultObj.output || "";
          await session.memory.add("assistant", assistantMessage);

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
