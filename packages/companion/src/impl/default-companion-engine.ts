import type { CompanionEngine, CompanionContext } from "../interfaces/companion-engine.js";
import type { CompanionInteraction, CompanionRule } from "../types/interaction.js";

const DEFAULT_RULES: CompanionRule[] = [
  { type: "break_suggestion", cooldown: 7200000, maxPerHour: 1, minTrustLevel: 20, conditions: ["long_session"] },
  { type: "milestone_celebration", cooldown: 600000, maxPerHour: 3, minTrustLevel: 30, conditions: ["goal_completed"] },
  { type: "work_session_recognition", cooldown: 3600000, maxPerHour: 1, minTrustLevel: 10, conditions: ["returning_from_idle"] },
  { type: "encouragement", cooldown: 1800000, maxPerHour: 1, minTrustLevel: 40, conditions: ["frustrated_user"] },
  { type: "progress_observation", cooldown: 900000, maxPerHour: 2, minTrustLevel: 25, conditions: ["goal_progress"] },
];

export class DefaultCompanionEngine implements CompanionEngine {
  private history: CompanionInteraction[] = [];
  private idCounter = 0;
  private lastByType: Map<string, number> = new Map();
  private countByTypeHour: Map<string, number> = new Map();
  private countHourStart = 0;

  evaluate(context: CompanionContext): CompanionInteraction | null {
    const now = Date.now();

    if (now - this.countHourStart > 3600000) {
      this.countByTypeHour.clear();
      this.countHourStart = now;
    }

    for (const rule of DEFAULT_RULES) {
      if (context.relationship.trustLevel < rule.minTrustLevel) continue;

      const lastTime = this.lastByType.get(rule.type) ?? 0;
      if (now - lastTime < rule.cooldown) continue;

      const hourCount = this.countByTypeHour.get(rule.type) ?? 0;
      if (hourCount >= rule.maxPerHour) continue;

      const interaction = this.matchRule(rule, context, now);
      if (interaction) {
        this.lastByType.set(rule.type, now);
        this.countByTypeHour.set(rule.type, hourCount + 1);
        this.history.push(interaction);
        return interaction;
      }
    }

    return null;
  }

  getHistory(): ReadonlyArray<CompanionInteraction> {
    return this.history;
  }

  getStats() {
    const suppressed = this.history.filter((i) => i.suppressed).length;
    return {
      totalInteractions: this.history.length,
      suppressedCount: suppressed,
      acceptedCount: this.history.length - suppressed,
      lastInteraction: this.history.length > 0 ? this.history[this.history.length - 1]!.timestamp : 0,
    };
  }

  private matchRule(rule: CompanionRule, context: CompanionContext, now: number): CompanionInteraction | null {
    const id = `ci_${++this.idCounter}`;

    switch (rule.type) {
      case "break_suggestion": {
        if (context.workSessionDuration < 7200000) return null;
        if (!context.userState || context.userState.current === "idle") return null;
        return {
          id, type: "break_suggestion",
          message: "You've been at it for a while. Take a breather?",
          confidence: 0.7, timestamp: now, suppressed: false, reason: "Long work session",
        };
      }
      case "milestone_celebration": {
        const recent = context.timeline.filter(
          (e) => e.type === "goal_completed" && now - e.timestamp < 600000,
        );
        if (recent.length === 0) return null;
        const goal = recent[0]!;
        return {
          id, type: "milestone_celebration",
          message: `Nice — ${goal.title.toLowerCase()} is done.`,
          confidence: 0.9, timestamp: now, suppressed: false, reason: "Goal completed",
        };
      }
      case "work_session_recognition": {
        if (context.workSessionDuration > 60000) return null;
        return {
          id, type: "work_session_recognition",
          message: "Welcome back.",
          confidence: 0.8, timestamp: now, suppressed: false, reason: "Returning from idle",
        };
      }
      case "encouragement": {
        if (context.userState.current !== "frustrated") return null;
        return {
          id, type: "encouragement",
          message: "Tough one — we'll get through it.",
          confidence: 0.6, timestamp: now, suppressed: false, reason: "User seems frustrated",
        };
      }
      case "progress_observation": {
        if (context.goalProgress < 50) return null;
        return {
          id, type: "progress_observation",
          message: `Making good progress — ${context.goalProgress}% done.`,
          confidence: 0.65, timestamp: now, suppressed: false, reason: "Goal progress milestone",
        };
      }
      default:
        return null;
    }
  }
}
