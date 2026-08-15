import type { WorkSession, ActivityMode } from "../types/index.js";

export class WorkSessionDetector {
  private currentSession: WorkSession | null = null;
  private lastApp: string = "";
  private lastMode: ActivityMode = "unknown";
  private observationCount = 0;
  private readonly STABILITY_THRESHOLD = 3;
  private readonly SESSION_GAP_MS = 10 * 60 * 1000; // 10 minutes gap = new session

  constructor() {}

  onActivityChange(app: string, mode: ActivityMode, timestamp: number): {
    sessionStarted: boolean;
    sessionEnded: boolean;
    session: WorkSession | null;
  } {
    const result = { sessionStarted: false, sessionEnded: false, session: null as WorkSession | null };

    this.observationCount++;

    // Detect session boundary
    if (this.currentSession) {
      const gap = timestamp - (this.currentSession.endedAt ?? this.currentSession.startedAt);
      if (gap > this.SESSION_GAP_MS) {
        // End previous session
        this.currentSession.endedAt = timestamp;
        this.currentSession.focusScore = this.calculateFocusScore(this.currentSession);
        result.sessionEnded = true;
        result.session = { ...this.currentSession };
        this.currentSession = null;
      }
    }

    // Start new session if enough observations with stable mode
    if (!this.currentSession && this.observationCount >= this.STABILITY_THRESHOLD) {
      this.currentSession = {
        id: `session_${Date.now()}`,
        startedAt: timestamp,
        mode,
        apps: [app],
        goals: [],
        interruptions: 0,
        focusScore: 0,
      };
      result.sessionStarted = true;
    }

    // Update current session
    if (this.currentSession) {
      if (!this.currentSession.apps.includes(app)) {
        this.currentSession.apps.push(app);
      }
      if (app !== this.lastApp) {
        this.currentSession.interruptions++;
      }
    }

    this.lastApp = app;
    this.lastMode = mode;
    return result;
  }

  getCurrentSession(): WorkSession | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  endSession(): WorkSession | null {
    if (!this.currentSession) return null;
    this.currentSession.endedAt = Date.now();
    this.currentSession.focusScore = this.calculateFocusScore(this.currentSession);
    const session = { ...this.currentSession };
    this.currentSession = null;
    return session;
  }

  private calculateFocusScore(session: WorkSession): number {
    const duration = (session.endedAt ?? Date.now()) - session.startedAt;
    if (duration === 0) return 0;
    const interruptionPenalty = Math.min(0.5, session.interruptions * 0.05);
    const durationBonus = Math.min(0.3, duration / (60 * 60 * 1000) * 0.1);
    return Math.max(0, Math.min(1, 1 - interruptionPenalty + durationBonus));
  }

  getStats(): {
    totalSessions: number;
    averageFocusScore: number;
    favoriteMode: ActivityMode;
    totalFocusTime: number;
  } {
    return {
      totalSessions: this.currentSession ? 1 : 0,
      averageFocusScore: this.currentSession?.focusScore ?? 0,
      favoriteMode: this.lastMode,
      totalFocusTime: this.currentSession ? Date.now() - this.currentSession.startedAt : 0,
    };
  }
}
