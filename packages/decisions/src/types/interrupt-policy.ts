import type { Action } from "@ai-agent/cognitive-types";
import type { WorldState } from "@ai-agent/world-model";

export interface InterruptPolicy {
  readonly name: string;
  readonly priority: number;
  readonly matcher: (action: Action, worldState: WorldState) => boolean;
}

export interface InterruptResult {
  readonly shouldInterrupt: boolean;
  readonly priority: number;
  readonly reason: string;
}
