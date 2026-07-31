/**
 * Tracks coding sessions — how long user has been coding,
 * which files/projects they're working on, and when to suggest breaks.
 */

export interface CodingSession {
  readonly startedAt: number;
  readonly lastActiveAt: number;
  readonly durationMs: number;
  readonly filesChanged: number;
  readonly projects: ReadonlyArray<string>;
  readonly languages: ReadonlyArray<string>;
  readonly isActive: boolean;
}

export interface CodingSessionTrackerState {
  readonly currentSession: CodingSession | null;
  readonly todayTotalMs: number;
  readonly todaySessions: number;
  readonly longestStreakMs: number;
  readonly currentStreakMs: number;
  readonly shouldSuggestBreak: boolean;
  readonly breakReason: string | null;
  readonly recentFiles: ReadonlyArray<string>;
  readonly activeProject: string | null;
}

const BREAK_THRESHOLD_MS = 90 * 60 * 1000; // 90 minutes
const LONG_BREAK_THRESHOLD_MS = 120 * 60 * 1000; // 2 hours
const INACTIVITY_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes of no file changes = session ended

export class CodingSessionTracker {
  private currentSessionStart: number | null = null;
  private lastFileChange = 0;
  private filesChanged = new Set<string>();
  private recentFiles: string[] = [];
  private projects = new Set<string>();
  private languages = new Set<string>();
  private todaySessions: Array<{ start: number; end: number; files: number }> = [];
  private sessionStartToday = Date.now();

  constructor() {
    // Reset at midnight
    this.checkDayReset();
  }

  /**
   * Call when a file change is detected by the filesystem sensor.
   */
  recordFileChange(filePath: string): void {
    const now = Date.now();

    // Start a new session if none active
    if (!this.currentSessionStart) {
      this.currentSessionStart = now;
    }

    // Detect project from path
    const projectMatch = filePath.match(
      /\/projects\/([^/]+)\/?/,
    );
    if (projectMatch?.[1]) {
      this.projects.add(projectMatch[1]);
    }

    // Detect language from extension
    const ext = filePath.split(".").pop()?.toLowerCase();
    if (ext) {
      const langMap: Record<string, string> = {
        ts: "typescript",
        tsx: "typescript",
        js: "javascript",
        jsx: "javascript",
        py: "python",
        rs: "rust",
        go: "go",
        java: "java",
        cpp: "cpp",
        c: "c",
        rb: "ruby",
        php: "php",
        swift: "swift",
        kt: "kotlin",
        vue: "vue",
        svelte: "svelte",
        html: "html",
        css: "css",
        scss: "scss",
        json: "json",
        yaml: "yaml",
        yml: "yaml",
        toml: "toml",
        md: "markdown",
        sh: "shell",
        zsh: "shell",
      };
      const lang = langMap[ext];
      if (lang) this.languages.add(lang);
    }

    // Track files
    this.filesChanged.add(filePath);
    this.recentFiles.push(filePath);
    if (this.recentFiles.length > 20) this.recentFiles.shift();
    this.lastFileChange = now;
  }

  /**
   * Call on each tick to check session state.
   */
  tick(): CodingSessionTrackerState {
    this.checkDayReset();

    const now = Date.now();
    const sessionActive =
      this.currentSessionStart !== null &&
      now - this.lastFileChange < INACTIVITY_THRESHOLD_MS;

    // If session was inactive for too long, end it
    if (this.currentSessionStart && !sessionActive) {
      this.endSession();
    }

    const currentSession = this.currentSessionStart
      ? {
          startedAt: this.currentSessionStart,
          lastActiveAt: this.lastFileChange,
          durationMs: sessionActive
            ? now - this.currentSessionStart
            : this.lastFileChange - this.currentSessionStart,
          filesChanged: this.filesChanged.size,
          projects: Array.from(this.projects),
          languages: Array.from(this.languages),
          isActive: sessionActive,
        }
      : null;

    const todayTotalMs = this.todaySessions.reduce(
      (sum, s) => sum + (s.end - s.start),
      0,
    );

    const currentStreakMs = currentSession?.isActive
      ? currentSession.durationMs
      : 0;

    const longestStreakMs = Math.max(
      ...this.todaySessions.map((s) => s.end - s.start),
      currentStreakMs,
    );

    // Break suggestion logic
    let shouldSuggestBreak = false;
    let breakReason: string | null = null;

    if (currentSession?.isActive) {
      if (currentSession.durationMs > LONG_BREAK_THRESHOLD_MS) {
        shouldSuggestBreak = true;
        breakReason = `You've been coding for ${Math.round(currentSession.durationMs / 60000)} minutes straight — consider a longer break`;
      } else if (currentSession.durationMs > BREAK_THRESHOLD_MS) {
        shouldSuggestBreak = true;
        breakReason = `You've been coding for ${Math.round(currentSession.durationMs / 60000)} minutes — take a short break`;
      }
    }

    return {
      currentSession,
      todayTotalMs,
      todaySessions: this.todaySessions.length + (currentSession?.isActive ? 1 : 0),
      longestStreakMs,
      currentStreakMs,
      shouldSuggestBreak,
      breakReason,
      recentFiles: this.recentFiles.slice(-10),
      activeProject: Array.from(this.projects).at(-1) ?? null,
    };
  }

  private endSession(): void {
    if (this.currentSessionStart) {
      this.todaySessions.push({
        start: this.currentSessionStart,
        end: this.lastFileChange,
        files: this.filesChanged.size,
      });
      this.currentSessionStart = null;
      this.filesChanged.clear();
    }
  }

  private checkDayReset(): void {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (this.sessionStartToday < dayStart) {
      this.todaySessions = [];
      this.sessionStartToday = dayStart;
      this.projects.clear();
      this.languages.clear();
    }
  }
}
