import type { ToolCall } from "@ai-agent/tools";

import type { Session } from "../session/session.js";
import type { AgentRequest } from "../types/agent-request.js";
import type { Planner } from "./planner.js";

export class DefaultPlanner implements Planner {
  public async plan(
    session: Session,
    request: AgentRequest,
  ): Promise<ToolCall> {
    // Session isn't used yet.
    void session;

    return {
      name: "echo",
      input: request.input,
    };
  }
}