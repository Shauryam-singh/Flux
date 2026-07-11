import type { Session } from "../session/session.js";
import type { AgentRequest } from "../types/agent-request.js";
import type { AgentResponse } from "../types/agent-response.js";

export interface Agent {
  run(session: Session, request: AgentRequest): Promise<AgentResponse>;
}
