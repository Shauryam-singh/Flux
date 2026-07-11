import type { ToolCall } from "@ai-agent/tools";

import type { Session } from "../session/session.js";
import type { AgentRequest } from "../types/agent-request.js";

export interface Planner {
  plan(session: Session, request: AgentRequest): Promise<ToolCall>;
}
