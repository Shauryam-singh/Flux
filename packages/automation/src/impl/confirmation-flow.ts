import type { ContextProfile, ActivityMode, ProfileActionResult } from "../types/index.js";

export interface ConfirmationRequest {
  id: string;
  profileId: string;
  profileName: string;
  actions: { detail: string; type: string }[];
  timestamp: number;
}

export class ConfirmationFlow {
  private pendingConfirmations = new Map<string, ConfirmationRequest>();
  private confirmationTimeout = 30000; // 30 seconds

  constructor(private executeAction: (action: { type: string; detail: string }) => Promise<ProfileActionResult>) {}

  async requestConfirmation(profile: ContextProfile): Promise<ConfirmationRequest | null> {
    if (profile.autoActions.length === 0) return null;

    // Skip confirmation for safe actions
    const needsConfirmation = profile.autoActions.some(a =>
      a.type === "close_app" || a.type === "custom",
    );

    if (!needsConfirmation) {
      // Auto-execute non-dangerous actions
      const results = await this.executeProfileActions(profile);
      return null;
    }

    const request: ConfirmationRequest = {
      id: `conf_${Date.now()}`,
      profileId: profile.id,
      profileName: profile.name,
      actions: profile.autoActions.map(a => ({ detail: a.detail, type: a.type })),
      timestamp: Date.now(),
    };

    this.pendingConfirmations.set(request.id, request);
    this.scheduleTimeout(request.id);
    return request;
  }

  async confirm(requestId: string): Promise<ProfileActionResult[]> {
    const request = this.pendingConfirmations.get(requestId);
    if (!request) return [];

    this.pendingConfirmations.delete(requestId);

    // Find the profile and execute
    const profile: ContextProfile = {
      id: request.profileId,
      name: request.profileName,
      mode: "unknown" as ActivityMode,
      apps: [],
      dndEnabled: false,
      autoActions: request.actions.map(a => ({
        id: `conf_${a.type}`,
        type: a.type as "dnd" | "volume" | "open_app" | "close_app" | "focus_mode" | "notification_filter" | "custom",
        detail: a.detail,
        enabled: true,
      })),
      createdAt: 0,
      updatedAt: 0,
      matchCount: 0,
    };

    return this.executeProfileActions(profile);
  }

  reject(requestId: string): boolean {
    return this.pendingConfirmations.delete(requestId);
  }

  getPending(): ConfirmationRequest[] {
    return [...this.pendingConfirmations.values()];
  }

  private async executeProfileActions(profile: ContextProfile): Promise<ProfileActionResult[]> {
    const results: ProfileActionResult[] = [];
    for (const action of profile.autoActions) {
      if (!action.enabled) continue;
      try {
        const result = await this.executeAction(action);
        results.push(result);
      } catch (err) {
        results.push({
          success: false,
          action: action.type,
          detail: action.detail,
          error: err instanceof Error ? err.message : String(err) as string | undefined,
        });
      }
    }
    return results;
  }

  private scheduleTimeout(requestId: string): void {
    setTimeout(() => {
      const request = this.pendingConfirmations.get(requestId);
      if (request) {
        this.pendingConfirmations.delete(requestId);
      }
    }, this.confirmationTimeout);
  }
}
