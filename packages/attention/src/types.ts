/**
 * What kind of event generated this observation
 */
export type ObservationSource =
  | "screen"      // Active window changed, app switched
  | "code"        // File saved, test ran, build happened
  | "terminal"    // Command executed, output produced
  | "git"         // Commit, push, pull, branch
  | "system"      // CPU spike, disk full, memory high
  | "file"        // File created, modified, deleted
  | "process"     // Process started, stopped, crashed
  | "user"        // User explicitly asked something
  | "timer"       // Scheduled check
  | "inference";  // AI inferred something from context

/**
 * How important is this observation
 */
export type ObservationPriority =
  | "ignore"     // Drop immediately — don't even buffer
  | "background" // Buffer but never send to brain unless asked
  | "low"        // Send in batch summaries only
  | "medium"     // Send within minutes
  | "high"       // Send immediately
  | "critical";  // Send NOW, interrupt everything

/**
 * A single observation — something the AI should know about
 */
export interface Observation {
  /** Unique ID */
  id: string;

  /** What generated this */
  source: ObservationSource;

  /** Short title (e.g. "Build failed", "Window switched to VSCode") */
  title: string;

  /** Longer description with details */
  detail: string;

  /** Priority level */
  priority: ObservationPriority;

  /** Numeric score 0-100 (higher = more important) */
  score: number;

  /** When this happened */
  timestamp: number;

  /** How long this event lasts (0 = instant) */
  duration?: number;

  /** Related context (file path, app name, command, etc.) */
  context?: Record<string, string>;

  /** Can this be combined with similar observations? */
  mergeable: boolean;

  /** Has this been sent to the brain? */
  consumed: boolean;
}

/**
 * A batch of related observations compressed into one
 */
export interface ObservationSummary {
  id: string;
  observations: Observation[];
  summary: string;
  totalCount: number;
  timeRange: { start: number; end: number };
  highestPriority: ObservationPriority;
  highestScore: number;
}
