import type { ToolResult } from "@ai-agent/tools";

export interface AgentResponse {
  success: boolean;
  result?: ToolResult;
  error?: string;
}
