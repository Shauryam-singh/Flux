export interface ToolCall {
  tool: string;

  arguments: Record<string, unknown>;
}
