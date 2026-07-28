import type { WorldState } from "@ai-agent/world-model";
import type { TimelineEvent } from "@ai-agent/timeline";
import type { RelationshipProfile } from "@ai-agent/relationship";
import type { UserState } from "@ai-agent/user-model";
import type { CompanionInteraction } from "../types/interaction.js";

export interface CompanionContext {
  readonly worldState: WorldState;
  readonly timeline: ReadonlyArray<TimelineEvent>;
  readonly goalProgress: number;
  readonly workSessionDuration: number;
  readonly lastInteractionTime: number;
  readonly userState: UserState;
  readonly relationship: RelationshipProfile;
}

export interface CompanionEngine {
  evaluate(context: CompanionContext): CompanionInteraction | null;
  getHistory(): ReadonlyArray<CompanionInteraction>;
  getStats(): {
    totalInteractions: number;
    suppressedCount: number;
    acceptedCount: number;
    lastInteraction: number;
  };
}
