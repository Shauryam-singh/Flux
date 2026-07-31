// ─── LLM Provider (minimal interface to avoid circular deps) ─────

export interface LlmProvider {
  complete(req: {
    model: string;
    prompt: string;
    temperature?: number;
  }): Promise<{ text: string }>;
}

// ─── Agent Types ─────────────────────────────────────────────────

export type AgentStatus = "active" | "inactive" | "busy";

export type AgentRole =
  | "coder"
  | "researcher"
  | "reviewer"
  | "planner"
  | "designer"
  | "devops"
  | "writer"
  | "analyst"
  | "custom";

// ─── Agent Memory ────────────────────────────────────────────────

export interface AgentMemoryMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly timestamp: string;
}

export interface AgentMemory {
  messages: AgentMemoryMessage[];
  maxMessages: number;
}

// ─── Sub-Agent ───────────────────────────────────────────────────

export interface SubAgent {
  readonly id: string;
  name: string;
  description: string;
  role: AgentRole;
  domain: string;
  systemPrompt: string;
  capabilities: ReadonlyArray<string>;
  status: AgentStatus;
  readonly createdAt: string;
  lastUsedAt: string | null;
  tasksCompleted: number;
  successRate: number;
  memory: AgentMemory;
  canHandle(intent: string): boolean;
  execute(intent: string, context: Record<string, unknown>): Promise<string>;
}

// ─── Agent Spec (for LLM-based creation) ────────────────────────

export interface AgentSpec {
  name: string;
  description: string;
  role: AgentRole;
  domain: string;
  systemPrompt: string;
  capabilities: ReadonlyArray<string>;
}

// ─── Tasks ───────────────────────────────────────────────────────

export type TaskStatus = "pending" | "running" | "completed" | "failed";

export interface AgentTask {
  id: string;
  intent: string;
  agentId: string;
  domain?: string;
  context: Record<string, unknown>;
  priority: "low" | "medium" | "high";
  status: TaskStatus;
  createdAt: string;
  completedAt: string | null;
  result?: AgentResult;
}

export interface AgentResult {
  taskId: string;
  agentId: string;
  domain: string;
  response: string;
  success: boolean;
  durationMs: number;
}

// ─── Task Planning ───────────────────────────────────────────────

export interface TaskSubtask {
  id: string;
  description: string;
  agentRole: AgentRole;
  dependencies: ReadonlyArray<string>;
  priority: "low" | "medium" | "high";
}

export interface TaskPlan {
  goal: string;
  subtasks: TaskSubtask[];
}

// ─── Coordinator Interface ──────────────────────────────────────

export interface MultiAgentCoordinator {
  /** Register a sub-agent */
  registerAgent(agent: SubAgent): void;
  /** Remove an agent by ID, returns true if removed */
  unregisterAgent(agentId: string): boolean;
  /** Update agent fields, returns updated agent or null */
  updateAgent(
    agentId: string,
    updates: Partial<
      Pick<
        SubAgent,
        | "name"
        | "description"
        | "role"
        | "domain"
        | "systemPrompt"
        | "capabilities"
        | "status"
      >
    >,
  ): SubAgent | null;
  /** Toggle agent active/inactive status */
  toggleAgent(agentId: string): SubAgent | null;
  /** Route a task to the best agent */
  route(task: AgentTask): Promise<AgentResult>;
  /** Get all registered agents */
  getAgents(): ReadonlyArray<SubAgent>;
  /** Get agent by ID */
  getAgent(agentId: string): SubAgent | null;
  /** Get agents filtered by role */
  getAgentsByRole(role: AgentRole): ReadonlyArray<SubAgent>;
  /** Find best agent for an intent without executing */
  findAgentForIntent(intent: string): SubAgent | null;
  /** Create an agent from a spec using LLM provider */
  createAgentFromLLM(spec: AgentSpec, provider: LlmProvider): Promise<SubAgent>;
  /** Have LLM generate an agent spec from a natural language description */
  generateAgentSpec(
    description: string,
    existingAgents: ReadonlyArray<SubAgent>,
    provider: LlmProvider,
  ): Promise<AgentSpec>;
  /** Decompose a complex goal into subtasks using LLM */
  planTask(goal: string, provider: LlmProvider): Promise<TaskPlan>;
  /** Full orchestration: plan → create agents → delegate → aggregate */
  orchestrate(goal: string, provider: LlmProvider): Promise<string>;
  /** Get task execution history */
  getTaskHistory(): ReadonlyArray<AgentTask>;
}
