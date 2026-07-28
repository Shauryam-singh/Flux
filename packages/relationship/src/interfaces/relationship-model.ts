import type { RelationshipProfile, CommunicationPreferences, UserProfile } from "../types/relationship.js";

export interface RelationshipModel {
  getProfile(): RelationshipProfile;
  updateTrust(delta: number): void;
  updateAutonomy(delta: number): void;
  updateCommunication(prefs: Partial<CommunicationPreferences>): void;
  updateUserProfile(profile: Partial<UserProfile>): void;
  recordMilestone(type: string, description: string): void;
  getSuggestedPersonality(): string;
  canAutonomously(action: string): boolean;
  load(data: RelationshipProfile): void;
  export(): RelationshipProfile;
  onChange(handler: (profile: RelationshipProfile) => void): () => void;
}
