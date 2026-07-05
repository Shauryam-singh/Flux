import type { ToolCall } from "../types/tool-call.js";
import type { ToolResult } from "../types/tool-result.js";

export interface ToolExecutor {
  execute(call: ToolCall): Promise<ToolResult>;
}
