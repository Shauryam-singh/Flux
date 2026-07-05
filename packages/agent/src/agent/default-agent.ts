import type { Agent } from "../interfaces/agent.js";
import type { AgentRequest } from "../types/agent-request.js";
import type { AgentResponse } from "../types/agent-response.js";

import type { ToolRegistry } from "@ai-agent/tools";
import type { ToolExecutor } from "@ai-agent/tools";

export class DefaultAgent implements Agent {
  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly toolExecutor: ToolExecutor,
  ) {}

  public async run(request: AgentRequest): Promise<AgentResponse> {
    const { input } = request;

    const tool = this.toolRegistry.get("echo");

    if (!tool) {
        return {
        success: false,
        error: "No tool found",
        };
    }

    const toolCall = {
        name: tool.name,
        input,
    };

    const result = await this.toolExecutor.execute(toolCall);

    return {
        success: true,
        result,
    };
    }
}