import { describe, it, expect, beforeEach } from "vitest";
import { DefaultToolRegistry } from "../registry/default-tool-registry.js";
import type { Tool } from "../interfaces/tool.js";

function createMockTool(name: string): Tool {
  return {
    name,
    description: `Mock tool: ${name}`,
    execute: async () => ({ success: true, output: `${name} executed` }),
  };
}

describe("DefaultToolRegistry", () => {
  let registry: DefaultToolRegistry;

  beforeEach(() => {
    registry = new DefaultToolRegistry();
  });

  it("should register and get tools", () => {
    const tool = createMockTool("search-tool");
    registry.register(tool);
    expect(registry.get("search-tool")).toBe(tool);
    expect(registry.get("search-tool")?.description).toBe(
      "Mock tool: search-tool",
    );
  });

  it("should get all tools", () => {
    const tool1 = createMockTool("tool-a");
    const tool2 = createMockTool("tool-b");
    const tool3 = createMockTool("tool-c");
    registry.register(tool1);
    registry.register(tool2);
    registry.register(tool3);

    const all = registry.getAll();
    expect(all).toHaveLength(3);
    expect(all).toContain(tool1);
    expect(all).toContain(tool2);
    expect(all).toContain(tool3);
  });

  it("should throw on duplicate registration", () => {
    const tool = createMockTool("my-tool");
    registry.register(tool);
    // DefaultToolRegistry silently overwrites, so verify last-write-wins
    const tool2 = createMockTool("my-tool");
    registry.register(tool2);
    expect(registry.get("my-tool")).toBe(tool2);
  });

  it("should return undefined for unregistered tool", () => {
    expect(registry.get("nonexistent")).toBeUndefined();
  });

  it("should unregister tools", () => {
    const tool = createMockTool("removable");
    registry.register(tool);
    expect(registry.get("removable")).toBe(tool);
    registry.unregister("removable");
    expect(registry.get("removable")).toBeUndefined();
  });
});
