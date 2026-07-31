import { randomUUID } from "node:crypto";
import type {
  SubAgent,
  AgentSpec,
  AgentRole,
  AgentMemory,
  LlmProvider,
} from "../interfaces/multi-agent.js";

const MODEL = "qwen2.5-coder:7b";

const ROLE_DESCRIPTIONS: Record<AgentRole, string> = {
  coder: "Write, refactor, and debug code. Create files, implement features, fix bugs.",
  researcher: "Research topics, analyze documentation, gather information, summarize findings.",
  reviewer: "Review code for quality, security, performance. Suggest improvements.",
  planner: "Decompose goals into subtasks, plan execution order, identify dependencies.",
  designer: "Design UI/UX, create mockups, plan layouts, define user flows.",
  devops: "Handle deployment, CI/CD, containerization, infrastructure, monitoring.",
  writer: "Write documentation, READMEs, API docs, technical writing, blog posts.",
  analyst: "Analyze data, metrics, logs. Generate insights and reports.",
  custom: "Specialized agent for custom tasks.",
};

export class AgentFactory {
  /**
   * Create a SubAgent from an AgentSpec.
   * The agent's execute() method calls the LLM with its system prompt.
   */
  static create(spec: AgentSpec, provider: LlmProvider): SubAgent {
    const id = `agent-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const memory: AgentMemory = {
      messages: [],
      maxMessages: 50,
    };

    const agent: SubAgent = {
      id,
      name: spec.name,
      description: spec.description,
      role: spec.role,
      domain: spec.domain,
      systemPrompt: spec.systemPrompt,
      capabilities: [...spec.capabilities],
      status: "active",
      createdAt: now,
      lastUsedAt: null,
      tasksCompleted: 0,
      successRate: 1.0,
      memory,

      canHandle(intent: string): boolean {
        const lower = intent.toLowerCase();
        return spec.capabilities.some((c) => lower.includes(c.toLowerCase()));
      },

      async execute(
        intent: string,
        context: Record<string, unknown>,
      ): Promise<string> {
        agent.status = "busy";
        agent.lastUsedAt = new Date().toISOString();

        try {
          // Build conversation context from memory
          const historyText = memory.messages
            .slice(-10)
            .map((m) => `${m.role}: ${m.content}`)
            .join("\n");

          const contextParts: string[] = [];
          if (historyText) {
            contextParts.push(`Previous conversation:\n${historyText}`);
          }
          if (Object.keys(context).length > 0) {
            contextParts.push(
              `System context:\n${JSON.stringify(context, null, 2)}`,
            );
          }
          contextParts.push(`Task: ${intent}`);

          const fullPrompt = `${spec.systemPrompt}\n\n${contextParts.join("\n\n")}`;

          const response = await provider.complete({
            model: MODEL,
            prompt: fullPrompt,
            temperature: 0.3,
          });

          const responseText = response.text;

          // Update memory
          memory.messages.push({
            role: "user",
            content: intent,
            timestamp: new Date().toISOString(),
          });
          memory.messages.push({
            role: "assistant",
            content: responseText,
            timestamp: new Date().toISOString(),
          });
          // Trim memory
          if (memory.messages.length > memory.maxMessages) {
            memory.messages = memory.messages.slice(-memory.maxMessages);
          }

          // Update stats
          agent.tasksCompleted++;
          // Running average success (assume success if non-empty response)
          const success = responseText.length > 0 ? 1 : 0;
          agent.successRate =
            (agent.successRate * (agent.tasksCompleted - 1) + success) /
            agent.tasksCompleted;

          agent.status = "active";
          return responseText;
        } catch (err) {
          agent.status = "active";
          agent.tasksCompleted++;
          agent.successRate =
            (agent.successRate * (agent.tasksCompleted - 1)) /
            agent.tasksCompleted;
          return `Agent error: ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    };

    return agent;
  }

  /**
   * Use the LLM to generate an AgentSpec from a natural language description.
   */
  static async generateSpec(
    description: string,
    existingAgents: ReadonlyArray<SubAgent>,
    provider: LlmProvider,
  ): Promise<AgentSpec> {
    const existingList = existingAgents
      .map(
        (a) =>
          `- ${a.name} (${a.role}) — domain: ${a.domain}, capabilities: ${a.capabilities.join(", ")}`,
      )
      .join("\n");

    const prompt = `You are an AI agent architect. Given a task description, generate a specification for a specialized agent.

## Existing Agents (DO NOT duplicate these)
${existingList || "(none)"}

## Task Description
${description}

## Response Format
Respond with ONLY a JSON object (no markdown, no extra text):
{
  "name": "Agent Name",
  "description": "One sentence description of what this agent does",
  "role": "coder|researcher|reviewer|planner|designer|devops|writer|analyst|custom",
  "domain": "domain name (e.g., 'backend', 'frontend', 'devops', 'documentation')",
  "systemPrompt": "Detailed system prompt for this agent. Include its expertise, how it should approach tasks, and any constraints.",
  "capabilities": ["capability1", "capability2", "capability3"]
}

## Rules
- Choose the role that best fits the task
- Capabilities should be specific keywords that can be matched against user intents
- The system prompt should make the agent an expert in its domain
- If an existing agent could handle this task, suggest modifications to that agent instead (set name to "MODIFY:<agentId>")
- Keep the agent focused — one clear responsibility`;

    const response = await provider.complete({
      model: MODEL,
      prompt,
      temperature: 0.2,
    });

    const cleaned = response.text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    try {
      const parsed = JSON.parse(cleaned) as Record<string, unknown>;
      return {
        name: String(parsed.name ?? "Unnamed Agent"),
        description: String(parsed.description ?? ""),
        role: (parsed.role as AgentRole) ?? "custom",
        domain: String(parsed.domain ?? "general"),
        systemPrompt: String(parsed.systemPrompt ?? ROLE_DESCRIPTIONS.custom),
        capabilities: Array.isArray(parsed.capabilities)
          ? (parsed.capabilities as string[])
          : [],
      };
    } catch {
      // Fallback spec
      return {
        name: "General Agent",
        description: description.slice(0, 100),
        role: "custom",
        domain: "general",
        systemPrompt: `You are a helpful AI agent. Your task: ${description}`,
        capabilities: description
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3)
          .slice(0, 5),
      };
    }
  }

  /**
   * Use the LLM to decompose a goal into subtasks.
   */
  static async planGoal(
    goal: string,
    existingAgents: ReadonlyArray<SubAgent>,
    provider: LlmProvider,
  ): Promise<{
    subtasks: Array<{
      description: string;
      role: AgentRole;
      dependencies: string[];
      priority: "low" | "medium" | "high";
    }>;
  }> {
    const agentList = existingAgents
      .map((a) => `- ${a.name} (id: ${a.id}, role: ${a.role}, capabilities: ${a.capabilities.join(", ")})`)
      .join("\n");

    const prompt = `You are a project planner. Decompose the following goal into subtasks.

## Goal
${goal}

## Available Agents
${agentList || "(no agents available — new agents will be created)"}

## Response Format
Respond with ONLY a JSON array of subtasks (no markdown):
[
  {
    "description": "Clear description of what needs to be done",
    "role": "coder|researcher|reviewer|planner|designer|devops|writer|analyst",
    "dependencies": [],
    "priority": "high|medium|low"
  }
]

## Rules
- Each subtask should be completable by a single agent
- Dependencies are subtask indices (0-based) that must complete first
- Order subtasks by execution order (independent tasks first)
- Assign the most appropriate role for each subtask
- Keep subtasks focused and actionable
- Aim for 2-6 subtasks for a complex goal`;

    const response = await provider.complete({
      model: MODEL,
      prompt,
      temperature: 0.2,
    });

    const cleaned = response.text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return {
          subtasks: parsed.map(
            (s: Record<string, unknown>) => ({
              description: String(s.description ?? ""),
              role: (s.role as AgentRole) ?? "custom",
              dependencies: Array.isArray(s.dependencies)
                ? (s.dependencies as string[])
                : [],
              priority:
                s.priority === "high" || s.priority === "medium" || s.priority === "low"
                  ? s.priority
                  : ("medium" as const),
            }),
          ),
        };
      }
    } catch {
      // Fallback — single task
    }

    return {
      subtasks: [
        {
          description: goal,
          role: "coder" as AgentRole,
          dependencies: [],
          priority: "medium" as const,
        },
      ],
    };
  }
}
