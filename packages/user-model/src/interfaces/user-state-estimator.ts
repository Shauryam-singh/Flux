import type { WorldState } from "@ai-agent/world-model";
import type { Observation } from "@ai-agent/attention";
import type { UserState } from "../types/user-state.js";

export interface UserStateEstimator {
  estimate(worldState: WorldState, recentObservations: ReadonlyArray<Observation>): UserState;
  getHistory(): ReadonlyArray<UserState>;
  getTimeInState(): number;
  isAvailableForInterruption(): boolean;
}
