import type { Tool } from "../interfaces/tool.js";
import type { ToolResult } from "../types/tool-result.js";

export class DefaultTool implements Tool {
  public constructor(
    public readonly name: string,
    public readonly description: string,
    private readonly handler: (
      input: Record<string, unknown>,
    ) => Promise<ToolResult>,
  ) {}

  public async execute(input: Record<string, unknown>): Promise<ToolResult> {
    return this.handler(input);
  }
}
