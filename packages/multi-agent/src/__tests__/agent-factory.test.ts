import { describe, it, expect } from "vitest";
import { AgentFactory } from "../impl/agent-factory.js";
import type { SubAgent, AgentSpec, LlmProvider } from "../interfaces/multi-agent.js";

function makeProvider(text: string): LlmProvider {
  return {
    complete: async () => ({ text }),
  };
}

describe("AgentFactory", () => {
  describe("create", () => {
    it("should create a SubAgent from a spec", () => {
      const spec: AgentSpec = {
        name: "Test Agent",
        description: "A test agent",
        role: "coder",
        domain: "backend",
        systemPrompt: "You are a test agent.",
        capabilities: ["code", "api"],
      };

      const agent = AgentFactory.create(spec, makeProvider("hello"));

      expect(agent.id).toMatch(/^agent-/);
      expect(agent.name).toBe("Test Agent");
      expect(agent.description).toBe("A test agent");
      expect(agent.role).toBe("coder");
      expect(agent.domain).toBe("backend");
      expect(agent.status).toBe("active");
      expect(agent.tasksCompleted).toBe(0);
      expect(agent.successRate).toBe(1.0);
      expect(agent.capabilities).toEqual(["code", "api"]);
      expect(agent.memory.messages).toHaveLength(0);
    });

    it("should generate unique IDs", () => {
      const spec: AgentSpec = {
        name: "Agent",
        description: "desc",
        role: "coder",
        domain: "test",
        systemPrompt: "prompt",
        capabilities: [],
      };

      const a1 = AgentFactory.create(spec, makeProvider(""));
      const a2 = AgentFactory.create(spec, makeProvider(""));
      expect(a1.id).not.toBe(a2.id);
    });

    it("canHandle should match capabilities", () => {
      const agent = AgentFactory.create(
        {
          name: "Agent",
          description: "desc",
          role: "coder",
          domain: "test",
          systemPrompt: "prompt",
          capabilities: ["api", "database", "auth"],
        },
        makeProvider(""),
      );

      expect(agent.canHandle("create an API endpoint")).toBe(true);
      expect(agent.canHandle("setup database")).toBe(true);
      expect(agent.canHandle("add authentication")).toBe(true);
      expect(agent.canHandle("write documentation")).toBe(false);
    });

    it("execute should call LLM and return response", async () => {
      const agent = AgentFactory.create(
        {
          name: "Agent",
          description: "desc",
          role: "coder",
          domain: "test",
          systemPrompt: "You are a test agent.",
          capabilities: ["code"],
        },
        makeProvider("I will write the code."),
      );

      const result = await agent.execute("write some code", {});
      expect(result).toBe("I will write the code.");
      expect(agent.tasksCompleted).toBe(1);
      expect(agent.lastUsedAt).not.toBeNull();
    });

    it("execute should update memory", async () => {
      const agent = AgentFactory.create(
        {
          name: "Agent",
          description: "desc",
          role: "coder",
          domain: "test",
          systemPrompt: "prompt",
          capabilities: [],
        },
        makeProvider("response"),
      );

      await agent.execute("test input", {});
      expect(agent.memory.messages).toHaveLength(2);
      expect(agent.memory.messages[0]!.role).toBe("user");
      expect(agent.memory.messages[0]!.content).toBe("test input");
      expect(agent.memory.messages[1]!.role).toBe("assistant");
      expect(agent.memory.messages[1]!.content).toBe("response");
    });

    it("execute should handle errors gracefully", async () => {
      const provider: LlmProvider = {
        complete: async () => {
          throw new Error("LLM failed");
        },
      };

      const agent = AgentFactory.create(
        {
          name: "Agent",
          description: "desc",
          role: "coder",
          domain: "test",
          systemPrompt: "prompt",
          capabilities: [],
        },
        provider,
      );

      const result = await agent.execute("test", {});
      expect(result).toContain("Agent error");
      expect(result).toContain("LLM failed");
      expect(agent.status).toBe("active"); // Should reset to active
    });

    it("should trim memory to maxMessages", async () => {
      const agent = AgentFactory.create(
        {
          name: "Agent",
          description: "desc",
          role: "coder",
          domain: "test",
          systemPrompt: "prompt",
          capabilities: [],
        },
        makeProvider("response"),
      );

      agent.memory.maxMessages = 4;

      await agent.execute("1", {});
      await agent.execute("2", {});
      await agent.execute("3", {});

      expect(agent.memory.messages.length).toBeLessThanOrEqual(4);
    });
  });

  describe("generateSpec", () => {
    it("should parse LLM response into AgentSpec", async () => {
      const llmResponse = JSON.stringify({
        name: "Payment Agent",
        description: "Handles payment integration",
        role: "coder",
        domain: "payments",
        systemPrompt: "You are a payment expert.",
        capabilities: ["stripe", "payment", "billing"],
      });

      const spec = await AgentFactory.generateSpec(
        "Build payment integration",
        [],
        makeProvider(llmResponse),
      );

      expect(spec.name).toBe("Payment Agent");
      expect(spec.role).toBe("coder");
      expect(spec.domain).toBe("payments");
      expect(spec.capabilities).toEqual(["stripe", "payment", "billing"]);
    });

    it("should fallback on invalid JSON", async () => {
      const spec = await AgentFactory.generateSpec(
        "Build something",
        [],
        makeProvider("not json at all"),
      );

      expect(spec.name).toBeDefined();
      expect(spec.role).toBeDefined();
      expect(spec.capabilities).toBeInstanceOf(Array);
    });

    it("should include existing agents in prompt", async () => {
      const existing: SubAgent[] = [
        {
          id: "existing-1",
          name: "Backend Agent",
          description: "...",
          role: "coder",
          domain: "backend",
          systemPrompt: "...",
          capabilities: ["api"],
          status: "active",
          createdAt: "",
          lastUsedAt: null,
          tasksCompleted: 0,
          successRate: 1,
          memory: { messages: [], maxMessages: 50 },
          canHandle: () => true,
          execute: async () => "",
        },
      ];

      const provider: LlmProvider = {
        complete: async (req) => {
          // Verify existing agents are in the prompt
          expect(req.prompt).toContain("Backend Agent");
          return {
            text: JSON.stringify({
              name: "Test",
              description: "Test",
              role: "coder",
              domain: "test",
              systemPrompt: "Test",
              capabilities: [],
            }),
          };
        },
      };

      await AgentFactory.generateSpec("test", existing, provider);
    });
  });

  describe("planGoal", () => {
    it("should parse LLM response into subtasks", async () => {
      const llmResponse = JSON.stringify([
        {
          description: "Build the API",
          role: "coder",
          dependencies: [],
          priority: "high",
        },
        {
          description: "Write documentation",
          role: "writer",
          dependencies: [0],
          priority: "medium",
        },
      ]);

      const plan = await AgentFactory.planGoal(
        "Build an API with docs",
        [],
        makeProvider(llmResponse),
      );

      expect(plan.subtasks).toHaveLength(2);
      expect(plan.subtasks[0]!.description).toBe("Build the API");
      expect(plan.subtasks[0]!.role).toBe("coder");
      expect(plan.subtasks[0]!.dependencies).toEqual([]);
      expect(plan.subtasks[1]!.dependencies).toEqual([0]);
    });

    it("should fallback to single task on invalid JSON", async () => {
      const plan = await AgentFactory.planGoal(
        "do something",
        [],
        makeProvider("invalid"),
      );

      expect(plan.subtasks).toHaveLength(1);
      expect(plan.subtasks[0]!.description).toBe("do something");
    });
  });
});
