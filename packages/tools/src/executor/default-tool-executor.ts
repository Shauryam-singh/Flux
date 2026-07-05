import type { ToolExecutor } from "../interfaces/tool-executor.js";
import type { ToolRegistry } from "../interfaces/tool-registry.js";
import type { ToolCall } from "../types/tool-call.js";
import type { ToolResult } from "../types/tool-result.js";

export class DefaultToolExecutor implements ToolExecutor {
  public constructor(private readonly registry: ToolRegistry) {}

  public async execute(call: ToolCall): Promise<ToolResult> {
    const tool = this.registry.get(call.name);

    if (!tool) {
      throw new Error(`Tool '${call.name}' not found.`);
    }

    return tool.execute(call.input);
  }
}
