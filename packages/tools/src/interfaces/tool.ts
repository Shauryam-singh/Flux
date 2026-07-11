import type { ToolResult } from "../types/tool-result.js";

export interface Tool {
  readonly name: string;

  readonly description: string;

  execute(input: unknown): Promise<ToolResult>;
}
