import type { ToolExecutor } from "@ai-agent/tools";

import type { Agent } from "../interfaces/agent.js";
import type { Planner } from "../planner/planner.js";
import type { Session } from "../session/session.js";
import type { AgentRequest } from "../types/agent-request.js";
import type { AgentResponse } from "../types/agent-response.js";

export class DefaultAgent implements Agent {
  constructor(
    private readonly planner: Planner,
    private readonly toolExecutor: ToolExecutor,
  ) {}

  public async run(
    session: Session,
    request: AgentRequest,
  ): Promise<AgentResponse> {
    // Save user message
    await session.memory.add(
      "user",
      JSON.stringify(request.input),
    );

    const toolCall = await this.planner.plan(session, request);

    const result = await this.toolExecutor.execute(toolCall);

    // Save assistant response
    await session.memory.add(
      "assistant",
      JSON.stringify(result),
    );

    return {
      success: true,
      result,
    };
  }
}