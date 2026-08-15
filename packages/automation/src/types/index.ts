export type ActivityMode =
  | "idle"
  | "coding"
  | "gaming"
  | "watching"
  | "browsing"
  | "communicating"
  | "studying"
  | "unknown";

export interface ActivitySnapshot {
  timestamp: number;
  mode: ActivityMode;
  activeApp: string;
  activeWindowTitle: string;
  idleSeconds: number;
  audioPlaying: boolean;
  gitDirty: boolean;
  dockerRunning: boolean;
  dayOfWeek: number;
  hourOfDay: number;
}

export interface ActionRecord {
  id: string;
  timestamp: number;
  type: "app_open" | "app_close" | "app_switch" | "command" | "file_open" | "browser_nav" | "message_sent" | "tool_use";
  detail: string;
  context: ActivityMode;
  metadata?: Record<string, unknown>;
}

export interface DiscoveredPattern {
  id: string;
  type: "time_sequence" | "app_cluster" | "daily_routine" | "trigger_action";
  description: string;
  confidence: number;
  occurrences: number;
  lastSeen: number;
  conditions: PatternCondition[];
  actions: PatternAction[];
}

export interface PatternCondition {
  field: string;
  operator: "eq" | "neq" | "gt" | "lt" | "in" | "between";
  value: unknown;
}

export interface PatternAction {
  type: string;
  detail: string;
  priority: number;
}

export interface ContextProfile {
  id: string;
  name: string;
  mode: ActivityMode;
  apps: string[];
  dndEnabled: boolean;
  volume?: number | undefined;
  autoActions: ProfileAction[];
  createdAt: number;
  updatedAt: number;
  matchCount: number;
}

export interface ProfileAction {
  id: string;
  type: "dnd" | "volume" | "open_app" | "close_app" | "focus_mode" | "notification_filter" | "custom";
  detail: string;
  enabled: boolean;
}

export interface ProactiveSuggestion {
  id: string;
  timestamp: number;
  patternId: string;
  profileId?: string | undefined;
  title: string;
  description: string;
  actions: ProfileAction[];
  confidence: number;
  status: "pending" | "accepted" | "rejected" | "auto_executed";
  ttlMs: number;
}

export interface WorkSession {
  id: string;
  startedAt: number;
  endedAt?: number | undefined;
  mode: ActivityMode;
  apps: string[];
  goals: string[];
  interruptions: number;
  focusScore: number;
  metadata?: Record<string, unknown> | undefined;
}

export interface AutomationState {
  totalObservations: number;
  totalActions: number;
  totalPatterns: number;
  totalProfiles: number;
  currentMode: ActivityMode;
  currentSession?: WorkSession | undefined;
  pendingSuggestions: ProactiveSuggestion[];
  lastClassificationAt: number | null;
  lastPatternDiscoveryAt: number | null;
}

export interface ProfileActionResult {
  success: boolean;
  action: string;
  detail: string;
  error?: string | undefined;
}
