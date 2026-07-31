import type {
  MultiAgentCoordinator,
  SubAgent,
  AgentTask,
  AgentResult,
  AgentRole,
  AgentSpec,
  TaskPlan,
  LlmProvider,
} from "../interfaces/multi-agent.js";
import { AgentRegistry } from "./agent-registry.js";
import { AgentFactory } from "./agent-factory.js";

export class DefaultMultiAgentCoordinator implements MultiAgentCoordinator {
  readonly registry: AgentRegistry;
  private taskHistory: AgentTask[] = [];

  constructor(registry?: AgentRegistry) {
    this.registry = registry ?? new AgentRegistry();
  }

  // ─── Agent Management ─────────────────────────────────────────

  registerAgent(agent: SubAgent): void {
    this.registry.add(agent);
  }

  unregisterAgent(agentId: string): boolean {
    return this.registry.delete(agentId);
  }

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
  ): SubAgent | null {
    return this.registry.update(agentId, updates);
  }

  toggleAgent(agentId: string): SubAgent | null {
    const agent = this.registry.get(agentId);
    if (!agent) return null;
    const newStatus = agent.status === "active" ? "inactive" : "active";
    return this.registry.update(agentId, { status: newStatus });
  }

  getAgents(): ReadonlyArray<SubAgent> {
    return this.registry.getAll();
  }

  getAgent(agentId: string): SubAgent | null {
    return this.registry.get(agentId);
  }

  getAgentsByRole(role: AgentRole): ReadonlyArray<SubAgent> {
    return this.registry.getByRole(role);
  }

  findAgentForIntent(intent: string): SubAgent | null {
    return this.registry.findBestForIntent(intent);
  }

  // ─── LLM-Powered Creation ─────────────────────────────────────

  async createAgentFromLLM(
    spec: AgentSpec,
    provider: LlmProvider,
  ): Promise<SubAgent> {
    // Check for similar existing agent
    const existing = this.registry.findSimilar(spec);
    if (existing) {
      // Merge capabilities into existing agent
      const mergedCaps = new Set([
        ...existing.capabilities,
        ...spec.capabilities,
      ]);
      this.registry.update(existing.id, {
        capabilities: Array.from(mergedCaps),
        description: `${existing.description} | ${spec.description}`,
      });
      return this.registry.get(existing.id)!;
    }

    // Create new agent
    const agent = AgentFactory.create(spec, provider);
    this.registry.add(agent);
    return agent;
  }

  async generateAgentSpec(
    description: string,
    existingAgents: ReadonlyArray<SubAgent>,
    provider: LlmProvider,
  ): Promise<AgentSpec> {
    return AgentFactory.generateSpec(description, existingAgents, provider);
  }

  // ─── Task Routing ─────────────────────────────────────────────

  async route(task: AgentTask): Promise<AgentResult> {
    const startTime = Date.now();

    const agent = this.findAgentForIntent(task.intent);
    if (!agent) {
      return {
        taskId: task.id,
        agentId: "none",
        domain: task.domain ?? "unknown",
        response: "No suitable agent found for this task",
        success: false,
        durationMs: Date.now() - startTime,
      };
    }

    try {
      const response = await agent.execute(task.intent, task.context);
      const result: AgentResult = {
        taskId: task.id,
        agentId: agent.id,
        domain: agent.domain,
        response,
        success: true,
        durationMs: Date.now() - startTime,
      };

      this.recordTask({
        ...task,
        agentId: agent.id,
        status: "completed",
        completedAt: new Date().toISOString(),
        result,
      });

      return result;
    } catch (err) {
      const result: AgentResult = {
        taskId: task.id,
        agentId: agent.id,
        domain: agent.domain,
        response: `Agent error: ${err instanceof Error ? err.message : String(err)}`,
        success: false,
        durationMs: Date.now() - startTime,
      };

      this.recordTask({
        ...task,
        agentId: agent.id,
        status: "failed",
        completedAt: new Date().toISOString(),
        result,
      });

      return result;
    }
  }

  // ─── Task Planning ────────────────────────────────────────────

  async planTask(goal: string, provider: LlmProvider): Promise<TaskPlan> {
    const agents = this.getAgents();
    const plan = await AgentFactory.planGoal(goal, agents, provider);

    const subtasks = plan.subtasks.map((st, i) => ({
      id: `subtask-${i}`,
      description: st.description,
      agentRole: st.role,
      dependencies: st.dependencies,
      priority: st.priority,
    }));

    return { goal, subtasks };
  }

  // ─── Full Orchestration ───────────────────────────────────────

  async orchestrate(goal: string, provider: LlmProvider): Promise<string> {
    // Step 1: Plan the goal
    const plan = await this.planTask(goal, provider);

    if (plan.subtasks.length === 0) {
      return "No subtasks generated for this goal.";
    }

    // Step 2: Find or create agents for each subtask
    const agentAssignments: Array<{
      subtask: (typeof plan.subtasks)[number];
      agent: SubAgent;
    }> = [];

    for (const subtask of plan.subtasks) {
      let agent = this.findAgentForSubtask(subtask, provider);
      if (!agent) {
        // Create a new agent for this subtask
        const spec: AgentSpec = {
          name: `${subtask.agentRole} Agent`,
          description: subtask.description,
          role: subtask.agentRole,
          domain: subtask.agentRole,
          systemPrompt: this.buildSystemPrompt(subtask.agentRole, subtask.description),
          capabilities: this.inferCapabilities(subtask.description),
        };
        agent = await this.createAgentFromLLM(spec, provider);
      }
      agentAssignments.push({ subtask, agent });
    }

    // Step 3: Execute subtasks (respecting dependencies)
    const results: Map<string, string> = new Map();
    const completed = new Set<string>();

    // Simple sequential execution with dependency resolution
    let maxIterations = agentAssignments.length * 2;
    while (completed.size < agentAssignments.length && maxIterations > 0) {
      maxIterations--;
      let madeProgress = false;

      for (const { subtask, agent } of agentAssignments) {
        if (completed.has(subtask.id)) continue;

        // Check if dependencies are met
        const depsMet = subtask.dependencies.every((dep) => completed.has(dep));
        if (!depsMet) continue;

        // Build context from completed subtask results
        const context: Record<string, unknown> = {};
        for (const dep of subtask.dependencies) {
          const depResult = results.get(dep);
          if (depResult) {
            context[`dependency_${dep}`] = depResult;
          }
        }
        context.goal = goal;
        context.subtaskDescription = subtask.description;

        try {
          const response = await agent.execute(subtask.description, context);
          results.set(subtask.id, response);
          completed.add(subtask.id);
          madeProgress = true;
        } catch {
          // Mark as completed with error to unblock dependents
          results.set(subtask.id, `[Error executing ${subtask.id}]`);
          completed.add(subtask.id);
          madeProgress = true;
        }
      }

      if (!madeProgress) break;
    }

    // Step 4: Aggregate results
    const outputs: string[] = [];
    for (const { subtask, agent } of agentAssignments) {
      const result = results.get(subtask.id) ?? "[No result]";
      outputs.push(`### ${agent.name} — ${subtask.description}\n\n${result}`);
    }

    // Step 5: Synthesize final output
    const allResults = outputs.join("\n\n---\n\n");
    const synthesisPrompt = `You are Flux, the orchestrator. The following subtasks have been completed for the goal: "${goal}"

## Results from Each Agent

${allResults}

## Task
Synthesize these results into a single, coherent final response. Combine all outputs into a unified deliverable. Be concise but complete.`;

    try {
      const synthesis = await provider.complete({
        model: "qwen2.5-coder:7b",
        prompt: synthesisPrompt,
        temperature: 0.3,
      });
      return synthesis.text;
    } catch {
      // If synthesis fails, return raw results
      return allResults;
    }
  }

  // ─── Task History ─────────────────────────────────────────────

  getTaskHistory(): ReadonlyArray<AgentTask> {
    return this.taskHistory;
  }

  // ─── Private Helpers ──────────────────────────────────────────

  private findAgentForSubtask(
    subtask: { description: string; agentRole: AgentRole },
    provider: LlmProvider,
  ): SubAgent | null {
    // First try role-based lookup
    const roleAgents = this.registry.getByRole(subtask.agentRole);
    if (roleAgents.length > 0) {
      // Pick the one with best capability match
      const desc = subtask.description.toLowerCase();
      let best: SubAgent | null = null;
      let bestScore = 0;
      for (const a of roleAgents) {
        if (a.status !== "active") continue;
        let score = 0;
        for (const cap of a.capabilities) {
          if (desc.includes(cap.toLowerCase())) score += 10;
        }
        score += Math.round(a.successRate * 5);
        if (score > bestScore) {
          bestScore = score;
          best = a;
        }
      }
      if (best) return best;
    }

    // Fall back to intent-based search
    return this.registry.findBestForIntent(subtask.description);
  }

  private buildSystemPrompt(role: AgentRole, taskDescription: string): string {
    const roleContext: Record<AgentRole, string> = {
      coder: "You are an expert software engineer. Write clean, efficient, well-structured code. Follow best practices and conventions.",
      researcher: "You are a thorough researcher. Gather information, analyze sources, and provide comprehensive summaries with citations.",
      reviewer: "You are a meticulous code reviewer. Identify bugs, security issues, performance problems, and style violations.",
      planner: "You are a strategic planner. Break down complex goals, identify dependencies, and create actionable execution plans.",
      designer: "You are a UI/UX designer. Create intuitive, accessible, and visually appealing designs.",
      devops: "You are a DevOps expert. Handle deployment, CI/CD, containerization, monitoring, and infrastructure.",
      writer: "You are a technical writer. Create clear, concise, and well-organized documentation.",
      analyst: "You are a data analyst. Analyze patterns, generate insights, and present findings clearly.",
      custom: "You are a specialized AI agent.",
    };

    return `${roleContext[role]}

## Current Task
${taskDescription}

## Instructions
- Focus on your area of expertise
- Provide complete, actionable outputs
- If you need to create files or run commands, describe exactly what should be done
- Be concise but thorough`;
  }

  private inferCapabilities(description: string): string[] {
    const words = description
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    const stopWords = new Set([
      "that",
      "this",
      "with",
      "from",
      "have",
      "will",
      "been",
      "were",
      "they",
      "their",
      "what",
      "when",
      "where",
      "which",
      "about",
    ]);
    return [...new Set(words.filter((w) => !stopWords.has(w)))].slice(0, 6);
  }

  private recordTask(task: AgentTask): void {
    this.taskHistory.push(task);
    // Keep last 100 tasks
    if (this.taskHistory.length > 100) {
      this.taskHistory = this.taskHistory.slice(-100);
    }
  }
}
