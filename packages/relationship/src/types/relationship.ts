export interface CommunicationPreferences {
  readonly verbosity: "minimal" | "moderate" | "detailed";
  readonly technicalDepth: "high" | "medium" | "low";
  readonly explanationStyle: "step-by-step" | "summary" | "example-first";
  readonly preferredLanguage: string;
  readonly codeStyle: Record<string, string>;
}

export interface UserProfile {
  readonly favouriteLanguages: ReadonlyArray<string>;
  readonly favouriteTools: ReadonlyArray<string>;
  readonly commonWorkflows: ReadonlyArray<string>;
  readonly commonMistakes: ReadonlyArray<string>;
  readonly preferredCodingStyle: string;
}

export interface RelationshipMilestone {
  readonly id: string;
  readonly type: string;
  readonly description: string;
  readonly timestamp: number;
}

export interface RelationshipProfile {
  readonly trustLevel: number;
  readonly autonomyLevel: number;
  readonly humourTolerance: number;
  readonly interruptionTolerance: number;
  readonly communication: CommunicationPreferences;
  readonly user: UserProfile;
  readonly interactionCount: number;
  readonly daysActive: number;
  readonly lastInteraction: number;
  readonly milestones: ReadonlyArray<RelationshipMilestone>;
}

export const DEFAULT_COMMUNICATION: CommunicationPreferences = {
  verbosity: "moderate",
  technicalDepth: "medium",
  explanationStyle: "step-by-step",
  preferredLanguage: "en",
  codeStyle: {},
};

export const DEFAULT_USER_PROFILE: UserProfile = {
  favouriteLanguages: [],
  favouriteTools: [],
  commonWorkflows: [],
  commonMistakes: [],
  preferredCodingStyle: "",
};

export const DEFAULT_RELATIONSHIP_PROFILE: RelationshipProfile = {
  trustLevel: 30,
  autonomyLevel: 20,
  humourTolerance: 0.5,
  interruptionTolerance: 0.5,
  communication: DEFAULT_COMMUNICATION,
  user: DEFAULT_USER_PROFILE,
  interactionCount: 0,
  daysActive: 1,
  lastInteraction: 0,
  milestones: [],
};
