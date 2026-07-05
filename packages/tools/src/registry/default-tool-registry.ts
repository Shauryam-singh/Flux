import type { Tool } from "../interfaces/tool.js";
import type { ToolRegistry } from "../interfaces/tool-registry.js";

export class DefaultToolRegistry implements ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  public register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  public unregister(name: string): void {
    this.tools.delete(name);
  }

  public get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  public getAll(): readonly Tool[] {
    return [...this.tools.values()];
  }
}
