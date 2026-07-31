/**
 * Time-Aware Suggestion Engine
 *
 * Provides contextual suggestions based on time of day, day of week,
 * and user patterns. Includes morning briefing, late night rest,
 * meeting prep, and end-of-day wrap-up.
 */

export interface TimeAwareSuggestion {
  readonly id: string;
  readonly type: string;
  readonly message: string;
  readonly confidence: number;
  readonly priority: "low" | "medium" | "high";
  readonly timeContext: string;
}

interface TimeWindow {
  readonly start: number; // hour (0-23)
  readonly end: number;
  readonly label: string;
}

const TIME_WINDOWS: Record<string, TimeWindow> = {
  earlyMorning: { start: 5, end: 7, label: "early morning" },
  morning: { start: 7, end: 10, label: "morning" },
  lateMorning: { start: 10, end: 12, label: "late morning" },
  afternoon: { start: 12, end: 14, label: "afternoon" },
  midAfternoon: { start: 14, end: 17, label: "mid-afternoon" },
  evening: { start: 17, end: 20, label: "evening" },
  night: { start: 20, end: 23, label: "night" },
  lateNight: { start: 23, end: 5, label: "late night" },
};

export class TimeAwareEngine {
  private lastMorningBriefing = 0;
  private lastEveningWrap = 0;
  private lastNightReminder = 0;
  private lastWeekendSuggestion = 0;

  /**
   * Generate time-aware suggestions based on current time and context.
   */
  suggest(context: {
    activeGoals: number;
    pendingTasks: number;
    gitDirty: boolean;
    cpuHigh: boolean;
    codingSessionMinutes: number;
    isWeekend: boolean;
  }): TimeAwareSuggestion[] {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    const results: TimeAwareSuggestion[] = [];
    const ts = now.getTime();

    const timeWindow = this.getTimeWindow(hour);

    // ── Morning Briefing (once per day, 7-10am) ──
    if (
      (timeWindow === "morning" || timeWindow === "earlyMorning") &&
      ts - this.lastMorningBriefing > 86400_000
    ) {
      const parts: string[] = [];
      if (context.activeGoals > 0) {
        parts.push(`${context.activeGoals} active goal${context.activeGoals > 1 ? "s" : ""}`);
      }
      if (context.pendingTasks > 0) {
        parts.push(`${context.pendingTasks} pending task${context.pendingTasks > 1 ? "s" : ""}`);
      }
      if (context.gitDirty) {
        parts.push("uncommitted changes");
      }

      if (parts.length > 0) {
        results.push({
          id: `morning_briefing_${now.toDateString()}`,
          type: "briefing",
          message: `Good morning! You have ${parts.join(", ")}. Ready to tackle the day?`,
          confidence: 0.8,
          priority: "medium",
          timeContext: "morning",
        });
      } else {
        results.push({
          id: `morning_briefing_${now.toDateString()}`,
          type: "briefing",
          message: "Good morning! Fresh start — what would you like to work on today?",
          confidence: 0.7,
          priority: "low",
          timeContext: "morning",
        });
      }
      this.lastMorningBriefing = ts;
    }

    // ── Late Night Rest Reminder (11pm-5am, once per night) ──
    if (timeWindow === "late night" && ts - this.lastNightReminder > 43200_000) {
      if (context.codingSessionMinutes > 60) {
        results.push({
          id: `night_rest_${now.toDateString()}`,
          type: "rest",
          message: `It's late and you've been coding for ${context.codingSessionMinutes} minutes. Consider resting — code will be here tomorrow.`,
          confidence: 0.85,
          priority: "high",
          timeContext: "late night",
        });
      } else {
        results.push({
          id: `night_rest_${now.toDateString()}`,
          type: "rest",
          message: "It's late — consider winding down. Good rest leads to better code.",
          confidence: 0.7,
          priority: "medium",
          timeContext: "late night",
        });
      }
      this.lastNightReminder = ts;
    }

    // ── Evening Wrap-Up (5-8pm, once per day) ──
    if (timeWindow === "evening" && ts - this.lastEveningWrap > 86400_000) {
      if (context.gitDirty) {
        results.push({
          id: `evening_wrap_${now.toDateString()}`,
          type: "wrap_up",
          message: "End of day — you have uncommitted changes. Want to commit before wrapping up?",
          confidence: 0.8,
          priority: "medium",
          timeContext: "evening",
        });
      }
      if (context.codingSessionMinutes > 120) {
        results.push({
          id: `evening_stretch_${now.toDateString()}`,
          type: "health",
          message: `You've been coding for ${context.codingSessionMinutes} minutes straight. Stretch break?`,
          confidence: 0.75,
          priority: "medium",
          timeContext: "evening",
        });
      }
      this.lastEveningWrap = ts;
    }

    // ── Weekend Suggestion (once per weekend day) ──
    if (
      (day === 0 || day === 6) &&
      ts - this.lastWeekendSuggestion > 86400_000 &&
      context.codingSessionMinutes > 30
    ) {
      results.push({
        id: `weekend_${now.toDateString()}`,
        type: "balance",
        message: "It's the weekend — consider taking a break from coding to recharge.",
        confidence: 0.6,
        priority: "low",
        timeContext: "weekend",
      });
      this.lastWeekendSuggestion = ts;
    }

    // ── Monday Morning Goal Review ──
    if (day === 1 && timeWindow === "morning" && context.activeGoals > 0) {
      results.push({
        id: `monday_goals_${now.toDateString()}`,
        type: "briefing",
        message: `Monday! You have ${context.activeGoals} active goal${context.activeGoals > 1 ? "s" : ""}. Want to review priorities for the week?`,
        confidence: 0.75,
        priority: "medium",
        timeContext: "monday morning",
      });
    }

    // ── Pre-lunch Focus (11am-12pm) ──
    if (timeWindow === "lateMorning" && context.cpuHigh && context.codingSessionMinutes > 90) {
      results.push({
        id: `pre_lunch_${now.toDateString()}`,
        type: "focus",
        message: "Almost lunch time — finish up what you're doing or save your progress?",
        confidence: 0.65,
        priority: "low",
        timeContext: "late morning",
      });
    }

    return results;
  }

  private getTimeWindow(hour: number): string {
    if (hour >= 5 && hour < 7) return "early morning";
    if (hour >= 7 && hour < 10) return "morning";
    if (hour >= 10 && hour < 12) return "late morning";
    if (hour >= 12 && hour < 14) return "afternoon";
    if (hour >= 14 && hour < 17) return "mid-afternoon";
    if (hour >= 17 && hour < 20) return "evening";
    if (hour >= 20 && hour < 23) return "night";
    return "late night";
  }
}
