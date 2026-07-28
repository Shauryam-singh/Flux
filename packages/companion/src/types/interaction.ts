export type CompanionInteractionType =
  | "milestone_celebration"
  | "break_suggestion"
  | "progress_observation"
  | "light_humour"
  | "work_session_recognition"
  | "encouragement"
  | "observation_share";

export interface CompanionInteraction {
  readonly id: string;
  readonly type: CompanionInteractionType;
  readonly message: string;
  readonly confidence: number;
  readonly timestamp: number;
  readonly suppressed: boolean;
  readonly reason: string;
}

export interface CompanionRule {
  readonly type: CompanionInteractionType;
  readonly cooldown: number;
  readonly maxPerHour: number;
  readonly minTrustLevel: number;
  readonly conditions: ReadonlyArray<string>;
}
