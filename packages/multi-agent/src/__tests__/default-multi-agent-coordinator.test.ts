import { describe, it, expect, beforeEach } from "vitest";
import { DefaultMultiAgentCoordinator } from "../impl/default-multi-agent-coordinator.js";
import { AgentFactory } from "../impl/agent-factory.js";
import type { SubAgent, AgentSpec, LlmProvider } from "../interfaces/multi-agent.js";

function makeProvider(text: string): LlmProvider {
  return {
    complete: async () => ({ text }),
  };
}

function makeAgent(id: string, name: string, caps: string[], domain = "test"): SubAgent {
  const memory = { messages: [], maxMessages: 50 };
  return {
    id,
    name,
    description: `${name} agent`,
    role: "coder" as const,
    domain,
    systemPrompt: `You are ${name}.`,
    capabilities: caps,
    status: "active" as const,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    tasksCompleted: 0,
    successRate: 1.0,
    memory,
    canHandle: (intent: string) => {
      const lower = intent.toLowerCase();
      return caps.some((c) => lower.includes(c.toLowerCase()));
    },
    execute: async (intent: string) => `[${name}] ${intent}`,
  };
}

describe("DefaultMultiAgentCoordinator", () => {
  let coord: DefaultMultiAgentCoordinator;

  beforeEach(() => {
    coord = new DefaultMultiAgentCoordinator();
    // Clear any persisted agents from disk
    coord.registry.clear();
  });

  describe("agent management", () => {
    it("should register and retrieve agents", () => {
      const agent = makeAgent("a1", "Agent 1", ["code"]);
      coord.registerAgent(agent);

      expect(coord.getAgent("a1")).toBe(agent);
      expect(coord.getAgents()).toHaveLength(1);
    });

    it("should unregister agents", () => {
      coord.registerAgent(makeAgent("a1", "Agent 1", ["code"]));
      expect(coord.unregisterAgent("a1")).toBe(true);
      expect(coord.getAgent("a1")).toBeNull();
    });

    it("should return false when unregistering nonexistent agent", () => {
      expect(coord.unregisterAgent("nonexistent")).toBe(false);
    });

    it("should update agent fields", () => {
      coord.registerAgent(makeAgent("a1", "Agent 1", ["code"]));
      const updated = coord.updateAgent("a1", { name: "Updated" });

      expect(updated).not.toBeNull();
      expect(updated!.name).toBe("Updated");
    });

    it("should toggle agent status", () => {
      coord.registerAgent(makeAgent("a1", "Agent 1", ["code"]));
      const toggled = coord.toggleAgent("a1");

      expect(toggled).not.toBeNull();
      expect(toggled!.status).toBe("inactive");

      const toggledBack = coord.toggleAgent("a1");
      expect(toggledBack!.status).toBe("active");
    });

    it("should filter agents by role", () => {
      coord.registerAgent(makeAgent("c1", "Coder", ["code"], "backend"));
      coord.registerAgent({ ...makeAgent("r1", "Researcher", ["research"], "research"), role: "researcher" });

      const coders = coord.getAgentsByRole("coder");
      expect(coders).toHaveLength(1);
      expect(coders[0]!.id).toBe("c1");
    });
  });

  describe("route", () => {
    it("should route to best matching agent", async () => {
      const backendAgent = makeAgent("backend", "Backend", ["api", "database"], "backend");
      const frontendAgent = makeAgent("frontend", "Frontend", ["ui", "css"], "frontend");
      coord.registerAgent(backendAgent);
      coord.registerAgent(frontendAgent);

      const result = await coord.route({
        id: "task-1",
        intent: "create a REST API endpoint",
        agentId: "",
        context: {},
        priority: "medium",
        status: "pending",
        createdAt: new Date().toISOString(),
        completedAt: null,
      });

      expect(result.success).toBe(true);
      expect(result.agentId).toBe(backendAgent.id);
    });

    it("should return failure when no agent found", async () => {
      const result = await coord.route({
        id: "task-1",
        intent: "do something unknown",
        agentId: "",
        context: {},
        priority: "medium",
        status: "pending",
        createdAt: new Date().toISOString(),
        completedAt: null,
      });

      expect(result.success).toBe(false);
      expect(result.agentId).toBe("none");
    });

    it("should record task history", async () => {
      coord.registerAgent(makeAgent("a1", "Agent", ["code"]));
      await coord.route({
        id: "task-1",
        intent: "write code",
        agentId: "",
        context: {},
        priority: "high",
        status: "pending",
        createdAt: new Date().toISOString(),
        completedAt: null,
      });

      const history = coord.getTaskHistory();
      expect(history).toHaveLength(1);
      expect(history[0]!.status).toBe("completed");
    });
  });

  describe("createAgentFromLLM", () => {
    it("should create a new agent from spec", async () => {
      const spec: AgentSpec = {
        name: "New Agent",
        description: "A new agent",
        role: "coder",
        domain: "backend",
        systemPrompt: "You are new.",
        capabilities: ["api"],
      };

      const agent = await coord.createAgentFromLLM(spec, makeProvider("ok"));
      expect(agent.name).toBe("New Agent");
      expect(coord.getAgent(agent.id)).not.toBeNull();
    });

    it("should merge with similar existing agent", async () => {
      const existing = makeAgent("existing", "Backend Agent", ["api", "database"], "backend");
      coord.registerAgent(existing);

      const spec: AgentSpec = {
        name: "Another Backend",
        description: "More backend stuff",
        role: "coder",
        domain: "backend",
        systemPrompt: "...",
        capabilities: ["api", "server"],
      };

      const agent = await coord.createAgentFromLLM(spec, makeProvider("ok"));
      // Should have merged into existing — the returned agent should have both "database" and "server"
      expect(agent.capabilities).toContain("database");
      expect(agent.capabilities).toContain("server");
      // Should not create a new agent
      expect(coord.getAgents()).toHaveLength(1);
    });
  });

  describe("orchestrate", () => {
    it("should plan and execute subtasks", async () => {
      const provider = makeProvider(
        JSON.stringify([
          {
            description: "Write the backend code",
            role: "coder",
            dependencies: [],
            priority: "high",
          },
        ]),
      );

      const result = await coord.orchestrate(
        "Build a REST API",
        provider,
      );

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle dependencies between subtasks", async () => {
      // First call: plan, Second call: synthesis
      let callCount = 0;
      const provider: LlmProvider = {
        complete: async (req) => {
          callCount++;
          if (callCount === 1) {
            // Planning call
            return {
              text: JSON.stringify([
                {
                  description: "Build the API",
                  role: "coder",
                  dependencies: [],
                  priority: "high",
                },
                {
                  description: "Write API docs",
                  role: "writer",
                  dependencies: [0],
                  priority: "medium",
                },
              ]),
            };
          }
          // Synthesis call
          return { text: "Combined result: API built and documented." };
        },
      };

      const result = await coord.orchestrate("Build API with docs", provider);
      expect(result).toContain("Combined result");
    });
  });

  describe("generateAgentSpec", () => {
    it("should delegate to AgentFactory.generateSpec", async () => {
      const spec = await coord.generateAgentSpec(
        "Build payments",
        [],
        makeProvider(
          JSON.stringify({
            name: "Payment Agent",
            description: "Handles payments",
            role: "coder",
            domain: "payments",
            systemPrompt: "You handle payments.",
            capabilities: ["stripe", "billing"],
          }),
        ),
      );

      expect(spec.name).toBe("Payment Agent");
      expect(spec.capabilities).toContain("stripe");
    });
  });
});
