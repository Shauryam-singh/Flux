import type { Memory } from "../memory/memory.js";
import { DefaultMemory } from "../memory/default-memory.js";

import type { Session } from "./session.js";

export class DefaultSession implements Session {
  public readonly memory: Memory;

  public constructor(
    public readonly id: string,
  ) {
    this.memory = new DefaultMemory();
  }
}