import type {
  MultiAgentCoordinator,
  SubAgent,
  AgentTask,
  AgentResult,
} from "../interfaces/multi-agent.js";

export class DefaultMultiAgentCoordinator implements MultiAgentCoordinator {
  private agents: Map<string, SubAgent> = new Map();

  registerAgent(agent: SubAgent): void {
    this.agents.set(agent.id, agent);
  }

  async route(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();

    // Find best agent for this task
    const agent = this.selectAgent(task);
    if (!agent) {
      return {
        agentId: "none",
        domain: "unknown",
        response: "No suitable agent found for this task",
        success: false,
        durationMs: Date.now() - startTime,
      };
    }

    try {
      const response = await agent.execute(task.intent, task.context);
      return {
        agentId: agent.id,
        domain: agent.domain,
        response,
        success: true,
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        agentId: agent.id,
        domain: agent.domain,
        response: `Agent error: ${err instanceof Error ? err.message : String(err)}`,
        success: false,
        durationMs: Date.now() - startTime,
      };
    }
  }

  getAgents(): ReadonlyArray<SubAgent> {
    return Array.from(this.agents.values());
  }

  getAgent(agentId: string): SubAgent | null {
    return this.agents.get(agentId) ?? null;
  }

  private selectAgent(task: AgentTask): SubAgent | null {
    // If domain specified, filter by domain first
    if (task.domain) {
      const domainAgent = Array.from(this.agents.values()).find(
        (a) => a.domain === task.domain,
      );
      if (domainAgent) return domainAgent;
    }

    // Find all agents that can handle this intent
    const candidates = Array.from(this.agents.values()).filter((a) =>
      a.canHandle(task.intent),
    );

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0]!;

    // Prefer agents with more matching capabilities
    return candidates.reduce((best, current) => {
      const bestScore = this.scoreAgent(best, task);
      const currentScore = this.scoreAgent(current, task);
      return currentScore > bestScore ? current : best;
    });
  }

  private scoreAgent(agent: SubAgent, task: AgentTask): number {
    let score = 0;
    const intentLower = task.intent.toLowerCase();

    for (const cap of agent.capabilities) {
      if (intentLower.includes(cap.toLowerCase())) {
        score += 10;
      }
    }

    if (task.domain === agent.domain) score += 20;

    return score;
  }
}
