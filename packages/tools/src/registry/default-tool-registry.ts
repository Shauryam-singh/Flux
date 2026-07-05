import type { ToolExecutor } from "../interfaces/tool-executor.js";
import type { ToolRegistry } from "../interfaces/tool-registry.js";
import type { ToolCall } from "../types/tool-call.js";
import type { ToolContext } from "../types/tool-context.js";
import type { ToolResult } from "../types/tool-result.js";

export class DefaultToolExecutor implements ToolExecutor {
  public constructor(private readonly registry: ToolRegistry) {}

  public async execute(call: ToolCall): Promise<ToolResult> {
    const tool = this.registry.get(call.tool);

    if (!tool) {
      return {
        success: false,
        output: null,
        error: `Tool '${call.tool}' not found.`,
      };
    }

    const context: ToolContext = {
      arguments: call.arguments,
    };

    return tool.execute(context);
  }
}
