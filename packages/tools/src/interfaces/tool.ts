import type { ToolContext } from "../types/tool-context.js";
import type { ToolResult } from "../types/tool-result.js";

export interface Tool {
  readonly name: string;

  execute(context: ToolContext): Promise<ToolResult>;
}
