/**
 * Multi-agent coordinator that routes tasks to specialized sub-agents.
 *
 * Agents are specialized by domain (coding, research, system, etc.)
 * and the coordinator selects the best agent based on the task intent.
 */
export interface MultiAgentCoordinator {
  /** Register a sub-agent */
  registerAgent(agent: SubAgent): void;
  /** Route a task to the best agent */
  route(task: AgentTask): Promise<AgentResult>;
  /** Get all registered agents */
  getAgents(): ReadonlyArray<SubAgent>;
  /** Get agent by ID */
  getAgent(agentId: string): SubAgent | null;
}

export interface SubAgent {
  id: string;
  name: string;
  domain: string;
  capabilities: ReadonlyArray<string>;
  canHandle(intent: string): boolean;
  execute(intent: string, context: Record<string, unknown>): Promise<string>;
}

export interface AgentTask {
  intent: string;
  domain?: string;
  context: Record<string, unknown>;
  priority: "low" | "medium" | "high";
}

export interface AgentResult {
  agentId: string;
  domain: string;
  response: string;
  success: boolean;
  durationMs: number;
}
