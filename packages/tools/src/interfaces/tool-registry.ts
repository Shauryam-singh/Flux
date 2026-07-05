import type { Tool } from "./tool.js";

export interface ToolRegistry {
  register(tool: Tool): void;

  unregister(name: string): void;

  get(name: string): Tool | undefined;

  getAll(): readonly Tool[];
}
