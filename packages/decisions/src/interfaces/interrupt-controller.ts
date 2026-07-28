import type { InterruptPolicy, InterruptResult } from "../types/interrupt-policy.js";
import type { Action } from "@ai-agent/cognitive-types";
import type { WorldState } from "@ai-agent/world-model";

export interface InterruptController {
  evaluate(action: Action, worldState: WorldState, policy: ReadonlyArray<InterruptPolicy>): InterruptResult;
  setPolicies(policies: ReadonlyArray<InterruptPolicy>): void;
  getPolicies(): ReadonlyArray<InterruptPolicy>;
}
