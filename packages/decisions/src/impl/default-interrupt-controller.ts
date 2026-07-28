import type { InterruptController } from "../interfaces/interrupt-controller.js";
import type { InterruptPolicy, InterruptResult } from "../types/interrupt-policy.js";
import type { Action } from "@ai-agent/cognitive-types";
import type { WorldState } from "@ai-agent/world-model";

export class DefaultInterruptController implements InterruptController {
  private policies: InterruptPolicy[];

  constructor(policies?: ReadonlyArray<InterruptPolicy>) {
    this.policies = policies ? [...policies] : [...DEFAULT_POLICIES];
  }

  evaluate(action: Action, worldState: WorldState, policyOverride?: ReadonlyArray<InterruptPolicy>): InterruptResult {
    const policies = policyOverride ?? this.policies;
    const sorted = [...policies].sort((a, b) => b.priority - a.priority);

    for (const p of sorted) {
      if (p.matcher(action, worldState)) {
        return {
          shouldInterrupt: p.priority >= 40,
          priority: p.priority,
          reason: `Matched policy: ${p.name}`,
        };
      }
    }

    return { shouldInterrupt: false, priority: 0, reason: "No matching policy" };
  }

  setPolicies(policies: ReadonlyArray<InterruptPolicy>): void {
    this.policies = [...policies];
  }

  getPolicies(): ReadonlyArray<InterruptPolicy> {
    return this.policies;
  }
}

const DEFAULT_POLICIES: InterruptPolicy[] = [
  {
    name: "security_issue",
    priority: 100,
    matcher: (action) =>
      action.type === "tool" &&
      typeof action.payload["command"] === "string" &&
      (action.payload["command"] as string).includes("rm -rf"),
  },
  {
    name: "battery_critical",
    priority: 95,
    matcher: (_action, worldState) =>
      worldState.system.batteryLevel !== null && worldState.system.batteryLevel < 5,
  },
  {
    name: "build_failing_repeatedly",
    priority: 80,
    matcher: (_action, worldState) => worldState.system.openErrors.length > 3,
  },
  {
    name: "goal_blocker",
    priority: 60,
    matcher: (_action, worldState) => worldState.system.openErrors.length > 0,
  },
  {
    name: "user_idle_suggestion",
    priority: 40,
    matcher: (action) => action.type === "speak" && action.confidence > 0.7,
  },
  {
    name: "minor_observation",
    priority: 20,
    matcher: (action) => action.type === "remember",
  },
];
