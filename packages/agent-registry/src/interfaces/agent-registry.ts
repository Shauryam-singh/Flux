import type { SpecialistAgent, AgentConfig } from "@ai-agent/agent-framework";
import type { AgentMetadata, AgentHealth, Task } from "@ai-agent/exec-types";

export interface AgentRegistry {
  register(agent: SpecialistAgent): void;
  unregister(agentId: string): void;
  get(agentId: string): SpecialistAgent | null;
  getAll(): ReadonlyArray<SpecialistAgent>;
  getActive(): ReadonlyArray<SpecialistAgent>;
  getAvailable(): ReadonlyArray<SpecialistAgent>;
  findByCapability(capability: string): ReadonlyArray<SpecialistAgent>;
  findByTask(task: Task): ReadonlyArray<SpecialistAgent>;
  getBestAgent(task: Task): SpecialistAgent | null;
  enable(agentId: string): void;
  disable(agentId: string): void;
  getMetadata(agentId: string): AgentMetadata | null;
  getHealth(agentId: string): AgentHealth | null;
  onAgentRegistered(handler: (agent: SpecialistAgent) => void): () => void;
  onAgentStatusChanged(handler: (agentId: string, status: string) => void): () => void;
}

export interface RegistryConfig {
  readonly enabled: boolean;
  readonly maxAgents: number;
  readonly healthCheckIntervalMs: number;
  readonly heartbeatTimeoutMs: number;
}
