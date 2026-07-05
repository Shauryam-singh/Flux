import type { AgentRequest } from "../types/agent-request.js";
import type { AgentResponse } from "../types/agent-response.js";

export interface Agent {
  run(request: AgentRequest): Promise<AgentResponse>;
}
