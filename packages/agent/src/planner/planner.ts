import type { ToolCall } from "@ai-agent/tools";
import type { StreamingCallbacks } from "@ai-agent/providers";

import type { Session } from "../session/session.js";
import type { AgentRequest } from "../types/agent-request.js";

export interface Planner {
  plan(session: Session, request: AgentRequest): Promise<ToolCall>;

  planStream?(session: Session, request: AgentRequest, callbacks: StreamingCallbacks): Promise<void>;
}
