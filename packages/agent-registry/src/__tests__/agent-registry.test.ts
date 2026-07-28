import { describe, it, expect, beforeEach } from "vitest";
import { DefaultAgentRegistry } from "../impl/default-agent-registry.js";
import { CodingAgent, ResearchAgent } from "@ai-agent/agent-framework";
import type { Task } from "@ai-agent/exec-types";

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "t1",
  objective: "Implement feature",
  description: "",
  status: "created",
  priority: "normal",
  progress: 0,
  assignedAgent: null,
  parentId: null,
  subtaskIds: [],
  dependencies: [],
  constraints: { maxDurationMs: null, maxRetries: 3, timeoutMs: 300000, requiredCapabilities: ["code_generation"], excludedAgents: [], preferredAgents: [], modelPreference: null, costLimit: null },
  result: null,
  artifacts: [],
  error: null,
  retryCount: 0,
  createdAt: Date.now(),
  startedAt: null,
  completedAt: null,
  updatedAt: Date.now(),
  metadata: {},
  ...overrides,
});

import type { AgentConfig } from "@ai-agent/agent-framework";

const dummyConfig: AgentConfig = {
  id: "dummy",
  name: "Dummy",
  description: "",
  version: "1.0.0",
  capabilities: [],
  supportedModels: [],
  maxConcurrentTasks: 1,
  priority: 1,
  costPerToken: 0,
  timeoutMs: 60000,
  model: "qwen2.5-coder:7b",
  systemPrompt: "",
};

describe("DefaultAgentRegistry", () => {
  let registry: DefaultAgentRegistry;

  beforeEach(() => {
    registry = new DefaultAgentRegistry();
    const coding = new CodingAgent();
    coding.initialize(dummyConfig);
    registry.register(coding);
    const research = new ResearchAgent();
    research.initialize(dummyConfig);
    registry.register(research);
  });

  it("should register agents", () => {
    expect(registry.getAll().length).toBe(2);
  });

  it("should find agents by capability", () => {
    const agents = registry.findByCapability("code_generation");
    expect(agents.length).toBe(1);
    expect(agents[0]!.metadata.id).toBe("coding");
  });

  it("should get best agent for task", () => {
    const task = makeTask();
    const agent = registry.getBestAgent(task);
    expect(agent).not.toBeNull();
    expect(agent!.metadata.id).toBe("coding");
  });

  it("should get available agents", () => {
    const available = registry.getAvailable();
    expect(available.length).toBe(2);
  });

  it("should get health", () => {
    const health = registry.getHealth("coding");
    expect(health).not.toBeNull();
    expect(health!.status).toBe("healthy");
  });
});
