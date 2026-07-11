import type { Memory } from "../memory/memory.js";

export interface Session {
  readonly id: string;

  readonly memory: Memory;
}
