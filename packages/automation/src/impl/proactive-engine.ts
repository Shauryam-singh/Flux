import type { ProactiveSuggestion, ContextProfile, DiscoveredPattern, ProfileAction } from "../types/index.js";

export interface ProactiveEngineConfig {
  maxPendingSuggestions: number;
  suggestionTtlMs: number;
  minConfidence: number;
  autoExecuteThreshold: number;
}

const DEFAULT_CONFIG: ProactiveEngineConfig = {
  maxPendingSuggestions: 5,
  suggestionTtlMs: 5 * 60 * 1000, // 5 minutes
  minConfidence: 0.6,
  autoExecuteThreshold: 0.9,
};

export interface SuggestionCallbacks {
  onSuggestion?: ((suggestion: ProactiveSuggestion) => void) | undefined;
  onAutoExecute?: ((suggestion: ProactiveSuggestion) => void) | undefined;
}

export class ProactiveEngine {
  private pending: ProactiveSuggestion[] = [];
  private recentIds = new Set<string>();
  private config: ProactiveEngineConfig;
  private callbacks: SuggestionCallbacks;

  constructor(config?: Partial<ProactiveEngineConfig>, callbacks?: SuggestionCallbacks) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.callbacks = callbacks ?? {};
  }

  evaluate(
    currentMode: string,
    profile: ContextProfile | null,
    patterns: DiscoveredPattern[],
    lastApp: string,
  ): ProactiveSuggestion[] {
    this.cleanupExpired();
    const suggestions: ProactiveSuggestion[] = [];

    // 1. Profile-based suggestions
    if (profile && profile.autoActions.length > 0) {
      const existing = this.pending.find(p => p.profileId === profile.id);
      if (!existing) {
        suggestions.push(this.createSuggestion({
          patternId: "profile_match",
          profileId: profile.id,
          title: `${profile.name} Detected`,
          description: `Activate ${profile.name} settings?`,
          actions: profile.autoActions,
          confidence: 0.8,
        }));
      }
    }

    // 2. Pattern-based suggestions
    for (const pattern of patterns) {
      if (pattern.confidence < this.config.minConfidence) continue;
      if (pattern.type === "trigger_action") {
        const trigger = pattern.conditions.find(c => c.field === "lastApp");
        if (trigger && trigger.value === lastApp) {
          const existing = this.pending.find(p => p.patternId === pattern.id);
          if (!existing) {
            suggestions.push(this.createSuggestion({
              patternId: pattern.id,
              title: "Next Step?",
              description: pattern.description,
              actions: pattern.actions.map(a => ({
                id: `auto_${a.type}_${a.detail}`,
                type: a.type as ProfileAction["type"],
                detail: a.detail,
                enabled: true,
              })),
              confidence: pattern.confidence,
            }));
          }
        }
      }

      if (pattern.type === "daily_routine") {
        const now = new Date();
        const dayMatch = pattern.conditions.find(c => c.field === "dayOfWeek");
        const hourMatch = pattern.conditions.find(c => c.field === "hourOfDay");
        if (dayMatch && hourMatch && dayMatch.value === now.getDay() && hourMatch.value === now.getHours()) {
          const existing = this.pending.find(p => p.patternId === pattern.id);
          if (!existing) {
            suggestions.push(this.createSuggestion({
              patternId: pattern.id,
              title: "Routine Time",
              description: pattern.description,
              actions: pattern.actions.map(a => ({
                id: `auto_${a.type}_${a.detail}`,
                type: a.type as ProfileAction["type"],
                detail: a.detail,
                enabled: true,
              })),
              confidence: pattern.confidence,
            }));
          }
        }
      }
    }

    // Add to pending
    for (const s of suggestions) {
      if (this.pending.length >= this.config.maxPendingSuggestions) {
        this.pending.shift(); // Remove oldest
      }
      this.pending.push(s);
      this.recentIds.add(s.id);
      this.callbacks.onSuggestion?.(s);
    }

    // Auto-execute high-confidence suggestions
    for (const s of suggestions) {
      if (s.confidence >= this.config.autoExecuteThreshold) {
        s.status = "auto_executed";
        this.callbacks.onAutoExecute?.(s);
      }
    }

    return suggestions;
  }

  private createSuggestion(overrides: Partial<ProactiveSuggestion> & Pick<ProactiveSuggestion, "title" | "description" | "actions" | "confidence" | "patternId">): ProactiveSuggestion {
    return {
      id: `sug_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      profileId: undefined,
      status: "pending",
      ttlMs: this.config.suggestionTtlMs,
      ...overrides,
    };
  }

  private cleanupExpired(): void {
    const now = Date.now();
    this.pending = this.pending.filter(s => now - s.timestamp < s.ttlMs);
  }

  accept(suggestionId: string): boolean {
    const s = this.pending.find(p => p.id === suggestionId);
    if (!s) return false;
    s.status = "accepted";
    return true;
  }

  reject(suggestionId: string): boolean {
    const s = this.pending.find(p => p.id === suggestionId);
    if (!s) return false;
    s.status = "rejected";
    return true;
  }

  getPending(): ProactiveSuggestion[] {
    return [...this.pending];
  }

  getRecent(count: number = 10): ProactiveSuggestion[] {
    return this.pending.slice(-count);
  }

  dismiss(suggestionId: string): boolean {
    const idx = this.pending.findIndex(s => s.id === suggestionId);
    if (idx === -1) return false;
    this.pending.splice(idx, 1);
    return true;
  }
}
