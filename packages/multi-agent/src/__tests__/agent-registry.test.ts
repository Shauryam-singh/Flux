import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { AgentRegistry } from "../impl/agent-registry.js";
import type { SubAgent } from "../interfaces/multi-agent.js";

const TEST_AGENTS_FILE = join(process.env.HOME ?? "/tmp", ".flux", "agents.json");

function makeAgent(overrides: Partial<SubAgent> = {}): SubAgent {
  return {
    id: overrides.id ?? "test-agent-1",
    name: overrides.name ?? "Test Agent",
    description: overrides.description ?? "A test agent",
    role: overrides.role ?? "coder",
    domain: overrides.domain ?? "backend",
    systemPrompt: overrides.systemPrompt ?? "You are a test agent.",
    capabilities: overrides.capabilities ?? ["code", "api", "test"],
    status: overrides.status ?? "active",
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    lastUsedAt: overrides.lastUsedAt ?? null,
    tasksCompleted: overrides.tasksCompleted ?? 0,
    successRate: overrides.successRate ?? 1.0,
    memory: overrides.memory ?? { messages: [], maxMessages: 50 },
    canHandle: (intent: string) => {
      const lower = intent.toLowerCase();
      return (overrides.capabilities ?? ["code", "api", "test"]).some((c) =>
        lower.includes(c.toLowerCase()),
      );
    },
    execute: async (intent: string) => `[${overrides.name ?? "Test Agent"}] ${intent}`,
  };
}

describe("AgentRegistry", () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    // Clean up any existing test file
    try {
      if (existsSync(TEST_AGENTS_FILE)) unlinkSync(TEST_AGENTS_FILE);
    } catch {}
    registry = new AgentRegistry();
  });

  afterEach(() => {
    registry.destroy();
    try {
      if (existsSync(TEST_AGENTS_FILE)) unlinkSync(TEST_AGENTS_FILE);
    } catch {}
  });

  it("should add and retrieve an agent", () => {
    const agent = makeAgent();
    registry.add(agent);

    expect(registry.get("test-agent-1")).toBe(agent);
    expect(registry.getAll()).toHaveLength(1);
  });

  it("should return null for unknown agent", () => {
    expect(registry.get("nonexistent")).toBeNull();
  });

  it("should list all agents", () => {
    registry.add(makeAgent({ id: "a1", name: "Agent 1" }));
    registry.add(makeAgent({ id: "a2", name: "Agent 2" }));

    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all.map((a) => a.id)).toContain("a1");
    expect(all.map((a) => a.id)).toContain("a2");
  });

  it("should delete an agent", () => {
    registry.add(makeAgent());
    expect(registry.delete("test-agent-1")).toBe(true);
    expect(registry.get("test-agent-1")).toBeNull();
    expect(registry.getAll()).toHaveLength(0);
  });

  it("should return false when deleting nonexistent agent", () => {
    expect(registry.delete("nonexistent")).toBe(false);
  });

  it("should update agent fields", () => {
    registry.add(makeAgent());

    const updated = registry.update("test-agent-1", {
      name: "Updated Agent",
      status: "inactive",
    });

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe("Updated Agent");
    expect(updated!.status).toBe("inactive");
  });

  it("should return null when updating nonexistent agent", () => {
    expect(registry.update("nonexistent", { name: "X" })).toBeNull();
  });

  it("should filter agents by role", () => {
    registry.add(makeAgent({ id: "c1", role: "coder" }));
    registry.add(makeAgent({ id: "r1", role: "researcher" }));
    registry.add(makeAgent({ id: "c2", role: "coder" }));

    const coders = registry.getByRole("coder");
    expect(coders).toHaveLength(2);
    expect(coders.every((a) => a.role === "coder")).toBe(true);
  });

  it("should find best agent for intent", () => {
    registry.add(
      makeAgent({
        id: "backend",
        name: "Backend Agent",
        capabilities: ["api", "database", "auth"],
      }),
    );
    registry.add(
      makeAgent({
        id: "frontend",
        name: "Frontend Agent",
        capabilities: ["ui", "css", "react"],
      }),
    );

    const best = registry.findBestForIntent("create a REST API endpoint");
    expect(best).not.toBeNull();
    expect(best!.id).toBe("backend");
  });

  it("should not return inactive agents for intent", () => {
    registry.add(
      makeAgent({
        id: "active",
        capabilities: ["code"],
        status: "active",
      }),
    );
    registry.add(
      makeAgent({
        id: "inactive",
        capabilities: ["code"],
        status: "inactive",
      }),
    );

    const best = registry.findBestForIntent("write code");
    expect(best?.id).toBe("active");
  });

  it("should detect duplicate agents", () => {
    registry.add(makeAgent({ name: "Backend Agent", domain: "backend" }));
    expect(registry.exists("Backend Agent", "backend")).toBe(true);
    expect(registry.exists("Different Agent", "backend")).toBe(false);
  });

  it("should find similar agents by capability overlap", () => {
    registry.add(
      makeAgent({
        id: "existing",
        name: "Existing Agent",
        domain: "backend",
        role: "coder",
        capabilities: ["api", "database"],
      }),
    );

    const similar = registry.findSimilar({
      name: "New Backend Agent",
      description: "Another backend agent",
      role: "coder",
      domain: "backend",
      systemPrompt: "...",
      capabilities: ["api", "server"],
    });

    expect(similar).not.toBeNull();
    expect(similar!.id).toBe("existing");
  });

  it("should persist and reload agents", () => {
    registry.add(makeAgent({ id: "persist-1", name: "Persist Test" }));
    registry.flush();

    // Create new registry that loads from disk
    const registry2 = new AgentRegistry();
    const loaded = registry2.get("persist-1");
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe("Persist Test");
    registry2.destroy();
  });

  it("should clear all agents", () => {
    registry.add(makeAgent({ id: "a1" }));
    registry.add(makeAgent({ id: "a2" }));
    registry.clear();

    expect(registry.getAll()).toHaveLength(0);
  });
});
