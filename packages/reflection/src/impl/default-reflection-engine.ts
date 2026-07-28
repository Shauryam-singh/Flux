import type { ReflectionEngine } from "../interfaces/reflection-engine.js";
import type { Reflection, ReflectionRequest } from "../types/reflection.js";
import type { Timeline, TimelineEvent } from "@ai-agent/timeline";
import type { GoalManager } from "@ai-agent/goals";

export class DefaultReflectionEngine implements ReflectionEngine {
  private reflections: Reflection[] = [];
  private timeline: Timeline;
  private goalManager: GoalManager;
  private idCounter = 0;

  constructor(timeline: Timeline, goalManager: GoalManager) {
    this.timeline = timeline;
    this.goalManager = goalManager;
  }

  async generate(request: ReflectionRequest): Promise<Reflection> {
    const events = this.timeline.getRange(request.dateRange.start, request.dateRange.end);
    const goals = this.goalManager.getAll();

    const accomplishments = this.extractAccomplishments(events, goals);
    const blockers = this.extractBlockers(events, goals);
    const patterns = this.extractPatterns(events);
    const goalsProgressed = this.extractGoalProgress(goals);
    const suggestedPriorities = this.suggestPriorities(goals, blockers);
    const mood = this.estimateMood(events);

    const summary = this.generateSummary(accomplishments, blockers, patterns, mood);

    const reflection: Reflection = {
      id: `ref_${++this.idCounter}`,
      date: new Date(request.dateRange.start).toISOString().split("T")[0]!,
      timestamp: Date.now(),
      accomplishments,
      blockers,
      patterns,
      goalsProgressed,
      suggestedPriorities,
      mood,
      summary,
    };

    this.reflections.push(reflection);
    return reflection;
  }

  getById(id: string): Reflection | null {
    return this.reflections.find((r) => r.id === id) ?? null;
  }

  getRange(start: string, end: string): ReadonlyArray<Reflection> {
    return this.reflections.filter((r) => r.date >= start && r.date <= end);
  }

  getLatest(): Reflection | null {
    return this.reflections[this.reflections.length - 1] ?? null;
  }

  private extractAccomplishments(events: ReadonlyArray<TimelineEvent>, goals: ReadonlyArray<import("@ai-agent/goals").Goal>): string[] {
    const accs: string[] = [];
    const completed = events.filter((e) => e.type === "goal_completed" || e.type === "milestone");
    for (const c of completed) accs.push(c.title);
    const commits = events.filter((e) => e.type === "commit");
    if (commits.length > 0) accs.push(`${commits.length} commit(s) made`);
    const testPasses = events.filter((e) => e.type === "test_pass");
    if (testPasses.length > 0) accs.push(`${testPasses.length} test(s) passed`);
    const buildSuccesses = events.filter((e) => e.type === "build_success");
    if (buildSuccesses.length > 0) accs.push(`${buildSuccesses.length} build(s) succeeded`);
    return accs;
  }

  private extractBlockers(events: ReadonlyArray<TimelineEvent>, goals: ReadonlyArray<import("@ai-agent/goals").Goal>): string[] {
    const blockers: string[] = [];
    const blockedGoals = goals.filter((g) => g.status === "blocked");
    for (const g of blockedGoals) blockers.push(`Goal blocked: ${g.title}`);
    const errors = events.filter((e) => e.type === "build_failure" || e.type === "test_fail");
    if (errors.length > 3) blockers.push(`${errors.length} build/test failures`);
    return blockers;
  }

  private extractPatterns(events: ReadonlyArray<TimelineEvent>): string[] {
    const patterns: string[] = [];
    const sessions = events.filter((e) => e.type === "work_session_start");
    if (sessions.length > 0) {
      const avgDuration = sessions.reduce((sum, s) => sum + (s.duration ?? 0), 0) / sessions.length;
      if (avgDuration > 7200000) patterns.push("Long work sessions detected");
    }
    const errors = events.filter((e) => e.type === "build_failure");
    if (errors.length > 2) patterns.push("Recurring build failures");
    return patterns;
  }

  private extractGoalProgress(goals: ReadonlyArray<import("@ai-agent/goals").Goal>): Array<{ goalId: string; progress: number }> {
    return goals
      .filter((g) => g.status === "in_progress" || g.status === "completed")
      .map((g) => ({ goalId: g.id, progress: g.progress }));
  }

  private suggestPriorities(goals: ReadonlyArray<import("@ai-agent/goals").Goal>, blockers: string[]): string[] {
    const priorities: string[] = [];
    if (blockers.length > 0) priorities.push("Resolve blockers");
    const active = goals.filter((g) => g.status === "active" || g.status === "in_progress");
    if (active.length > 0) priorities.push(`Continue: ${active[0]!.title}`);
    if (priorities.length === 0) priorities.push("Plan next milestone");
    return priorities;
  }

  private estimateMood(events: ReadonlyArray<TimelineEvent>): string {
    const errors = events.filter((e) => e.type === "build_failure" || e.type === "error_occurred").length;
    const successes = events.filter((e) => e.type === "build_success" || e.type === "test_pass" || e.type === "commit").length;
    if (errors > successes * 2) return "frustrated";
    if (successes > errors * 3) return "productive";
    if (events.length < 5) return "quiet";
    return "neutral";
  }

  private generateSummary(accomplishments: string[], blockers: string[], patterns: string[], mood: string): string {
    const parts: string[] = [];
    if (accomplishments.length > 0) parts.push(`Accomplished: ${accomplishments.join(", ")}`);
    if (blockers.length > 0) parts.push(`Blockers: ${blockers.join(", ")}`);
    if (patterns.length > 0) parts.push(`Patterns: ${patterns.join(", ")}`);
    parts.push(`Overall mood: ${mood}`);
    return parts.join(". ");
  }
}
