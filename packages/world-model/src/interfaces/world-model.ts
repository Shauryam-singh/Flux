import type { WorldState, WorldStateDelta } from "../types/domain.js";
import type { Observation } from "@ai-agent/attention";

export interface WorldModel {
  getState(): WorldState;
  update(observation: Observation): WorldStateDelta;
  getProject(): import("../types/domain.js").ProjectState | null;
  getApplication(): import("../types/domain.js").ApplicationState;
  getSystem(): import("../types/domain.js").SystemState;
  onChange(handler: (state: WorldState, delta: WorldStateDelta) => void): () => void;
  reset(): void;
}
