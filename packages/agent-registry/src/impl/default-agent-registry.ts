import type { AgentRegistry, RegistryConfig } from "../interfaces/agent-registry.js";
import type { SpecialistAgent } from "@ai-agent/agent-framework";
import type { AgentMetadata, AgentHealth, Task } from "@ai-agent/exec-types";

const DEFAULT_CONFIG: RegistryConfig = {
  enabled: true,
  maxAgents: 50,
  healthCheckIntervalMs: 30000,
  heartbeatTimeoutMs: 60000,
};

export class DefaultAgentRegistry implements AgentRegistry {
  private agents = new Map<string, SpecialistAgent>();
  private handlers: Array<(agent: SpecialistAgent) => void> = [];
  private statusHandlers: Array<(agentId: string, status: string) => void> = [];
  private config: RegistryConfig;

  constructor(config?: Partial<RegistryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  register(agent: SpecialistAgent): void {
    if (this.agents.size >= this.config.maxAgents) {
      throw new Error(`Registry full: max ${this.config.maxAgents} agents`);
    }
    this.agents.set(agent.metadata.id, agent);
    for (const handler of this.handlers) {
      handler(agent);
    }
  }

  unregister(agentId: string): void {
    this.agents.delete(agentId);
  }

  get(agentId: string): SpecialistAgent | null {
    return this.agents.get(agentId) ?? null;
  }

  getAll(): ReadonlyArray<SpecialistAgent> {
    return Array.from(this.agents.values());
  }

  getActive(): ReadonlyArray<SpecialistAgent> {
    return this.getAll().filter((a) => a.metadata.status === "active" || a.metadata.status === "idle");
  }

  getAvailable(): ReadonlyArray<SpecialistAgent> {
    return this.getAll().filter(
      (a) =>
        a.metadata.status === "active" || a.metadata.status === "idle",
    ).filter((a) => a.metadata.currentTaskCount < a.metadata.maxConcurrentTasks);
  }

  findByCapability(capability: string): ReadonlyArray<SpecialistAgent> {
    return this.getAll().filter((a) =>
      a.metadata.capabilities.some((c) => c.name === capability),
    );
  }

  findByTask(task: Task): ReadonlyArray<SpecialistAgent> {
    return this.getAll().filter((a) => a.canHandle(task));
  }

  getBestAgent(task: Task): SpecialistAgent | null {
    const candidates = this.findByTask(task).filter(
      (a) => a.metadata.status === "active" || a.metadata.status === "idle",
    );

    if (candidates.length === 0) return null;

    return candidates.sort((a, b) => {
      const scoreA = this.scoreAgent(a, task);
      const scoreB = this.scoreAgent(b, task);
      return scoreB - scoreA;
    })[0]!;
  }

  enable(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      for (const handler of this.statusHandlers) {
        handler(agentId, "active");
      }
    }
  }

  disable(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      for (const handler of this.statusHandlers) {
        handler(agentId, "disabled");
      }
    }
  }

  getMetadata(agentId: string): AgentMetadata | null {
    return this.agents.get(agentId)?.metadata ?? null;
  }

  getHealth(agentId: string): AgentHealth | null {
    return this.agents.get(agentId)?.health() ?? null;
  }

  onAgentRegistered(handler: (agent: SpecialistAgent) => void): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  onAgentStatusChanged(handler: (agentId: string, status: string) => void): () => void {
    this.statusHandlers.push(handler);
    return () => {
      this.statusHandlers = this.statusHandlers.filter((h) => h !== handler);
    };
  }

  private scoreAgent(agent: SpecialistAgent, task: Task): number {
    let score = agent.metadata.priority;
    score += agent.metadata.successRate * 20;
    score -= agent.metadata.currentTaskCount * 5;
    if (task.constraints.preferredAgents.includes(agent.metadata.id)) score += 30;
    if (task.constraints.excludedAgents.includes(agent.metadata.id)) score -= 100;
    return score;
  }
}
