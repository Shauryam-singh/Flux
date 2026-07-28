import type { RelationshipModel } from "../interfaces/relationship-model.js";
import type { RelationshipProfile, CommunicationPreferences, UserProfile, RelationshipMilestone } from "../types/relationship.js";
import { DEFAULT_RELATIONSHIP_PROFILE } from "../types/relationship.js";

export class DefaultRelationshipModel implements RelationshipModel {
  private profile: RelationshipProfile;
  private handlers: Array<(profile: RelationshipProfile) => void> = [];
  private milestoneCounter = 0;

  constructor(initial?: Partial<RelationshipProfile>) {
    this.profile = { ...DEFAULT_RELATIONSHIP_PROFILE, ...initial };
  }

  getProfile(): RelationshipProfile {
    return this.profile;
  }

  updateTrust(delta: number): void {
    this.profile = {
      ...this.profile,
      trustLevel: Math.max(0, Math.min(100, this.profile.trustLevel + delta)),
    };
    this.emit();
  }

  updateAutonomy(delta: number): void {
    this.profile = {
      ...this.profile,
      autonomyLevel: Math.max(0, Math.min(100, this.profile.autonomyLevel + delta)),
    };
    this.emit();
  }

  updateCommunication(prefs: Partial<CommunicationPreferences>): void {
    this.profile = {
      ...this.profile,
      communication: { ...this.profile.communication, ...prefs },
    };
    this.emit();
  }

  updateUserProfile(profile: Partial<UserProfile>): void {
    this.profile = {
      ...this.profile,
      user: { ...this.profile.user, ...profile },
    };
    this.emit();
  }

  recordMilestone(type: string, description: string): void {
    const milestone: RelationshipMilestone = {
      id: `ms_${++this.milestoneCounter}`,
      type,
      description,
      timestamp: Date.now(),
    };
    this.profile = {
      ...this.profile,
      milestones: [...this.profile.milestones, milestone],
    };
    this.emit();
  }

  getSuggestedPersonality(): string {
    if (this.profile.trustLevel > 70 && this.profile.humourTolerance > 0.6) return "companion";
    if (this.profile.trustLevel > 50) return "friday";
    if (this.profile.communication.technicalDepth === "high") return "professional";
    if (this.profile.humourTolerance > 0.7) return "humorous";
    return "jarvis";
  }

  canAutonomously(action: string): boolean {
    const thresholds: Record<string, number> = {
      "read-file": 20,
      "search": 30,
      "git-status": 40,
      "suggest": 50,
      "edit-file": 60,
      "run-command": 70,
      "commit": 80,
      "push": 90,
    };
    const threshold = thresholds[action] ?? 50;
    return this.profile.autonomyLevel >= threshold;
  }

  load(data: RelationshipProfile): void {
    this.profile = data;
    this.emit();
  }

  export(): RelationshipProfile {
    return this.profile;
  }

  onChange(handler: (profile: RelationshipProfile) => void): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  private emit(): void {
    for (const handler of this.handlers) {
      handler(this.profile);
    }
  }
}
