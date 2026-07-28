// Phase 4: Shared ambient intelligence types
// Used by all Phase 4 packages

// ─── Extended Observation Sources ───

export type AmbientObservationSource =
  | "vision"
  | "calendar"
  | "email"
  | "notification"
  | "presence"
  | "device"
  | "workspace"
  | "fusion"
  | "prediction"
  | "environment";

// ─── Vision Types ───

export interface ScreenRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly label?: string;
}

export interface VisualElement {
  readonly type: "text" | "button" | "icon" | "dialog" | "menu" | "tab" | "input" | "image" | "chart" | "code_block" | "error_indicator" | "notification_badge";
  readonly content: string;
  readonly region: ScreenRegion;
  readonly confidence: number;
  readonly interactive: boolean;
}

export interface VisionAnalysis {
  readonly id: string;
  readonly timestamp: number;
  readonly screenshotId: string;
  readonly application: string;
  readonly windowTitle: string;
  readonly elements: ReadonlyArray<VisualElement>;
  readonly semanticSummary: string;
  readonly hasErrors: boolean;
  readonly errorCount: number;
  readonly activeDialogs: ReadonlyArray<string>;
  readonly codeLanguage: string | null;
  readonly uiState: "normal" | "error_dialog" | "loading" | "blocked" | "input_required";
  readonly raw?: string;
}

// ─── Workspace Types ───

export interface BrowserTab {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly favIconUrl?: string;
  readonly active: boolean;
  readonly pinned: boolean;
  readonly audible: boolean;
  readonly muted: boolean;
}

export interface WorkspaceTerminal {
  readonly id: string;
  readonly pid: number | null;
  readonly title: string;
  readonly cwd: string;
  readonly lastCommand: string | null;
  readonly lastOutput: string | null;
  readonly exitCode: number | null;
}

export interface WorkspaceContainer {
  readonly id: string;
  readonly name: string;
  readonly image: string;
  readonly state: "running" | "stopped" | "paused" | "created" | "dead";
  readonly ports: ReadonlyArray<{ host: number; container: number }>;
  readonly uptime: number;
}

export interface WorkspaceSnapshot {
  readonly timestamp: number;
  readonly openApplications: ReadonlyArray<{ name: string; windowCount: number; active: boolean }>;
  readonly browserTabs: ReadonlyArray<BrowserTab>;
  readonly terminals: ReadonlyArray<WorkspaceTerminal>;
  readonly containers: ReadonlyArray<WorkspaceContainer>;
  readonly openFiles: ReadonlyArray<string>;
  readonly focusedFile: string | null;
  readonly gitBranch: string | null;
  readonly clipboardContent: string | null;
  readonly clipboardType: "text" | "image" | "file" | "unknown" | null;
  readonly recentDownloads: ReadonlyArray<{ path: string; timestamp: number }>;
  readonly mountedDrives: ReadonlyArray<{ name: string; mountPoint: string; freeSpace: number }>;
  readonly notifications: ReadonlyArray<{ app: string; title: string; timestamp: number }>;
}

// ─── Calendar Types ───

export type CalendarEventType =
  | "meeting"
  | "deadline"
  | "focus_block"
  | "reminder"
  | "travel"
  | "personal"
  | "recurring";

export interface CalendarEvent {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly type: CalendarEventType;
  readonly location: string | null;
  readonly attendees: ReadonlyArray<string>;
  readonly isAllDay: boolean;
  readonly recurring: boolean;
  readonly reminderMinutes: number;
  readonly metadata: Record<string, string>;
}

export interface CalendarState {
  readonly events: ReadonlyArray<CalendarEvent>;
  readonly nextEvent: CalendarEvent | null;
  readonly timeUntilNextEvent: number | null;
  readonly currentEvent: CalendarEvent | null;
  readonly focusBlockActive: boolean;
  readonly todayEventCount: number;
  readonly upcomingDeadlines: ReadonlyArray<CalendarEvent>;
}

// ─── Email Types ───

export type EmailPriority = "urgent" | "high" | "normal" | "low";

export interface EmailMessage {
  readonly id: string;
  readonly threadId: string;
  readonly from: string;
  readonly fromName: string;
  readonly to: ReadonlyArray<string>;
  readonly subject: string;
  readonly snippet: string;
  readonly timestamp: number;
  readonly isRead: boolean;
  readonly isStarred: boolean;
  readonly hasAttachments: boolean;
  readonly attachmentCount: number;
  readonly priority: EmailPriority;
  readonly labels: ReadonlyArray<string>;
  readonly replyDeadline: number | null;
}

export interface EmailState {
  readonly unreadCount: number;
  readonly urgentCount: number;
  readonly starredCount: number;
  readonly recentEmails: ReadonlyArray<EmailMessage>;
  readonly unreadBySender: ReadonlyArray<{ sender: string; count: number; latest: number }>;
  readonly pendingReplies: ReadonlyArray<EmailMessage>;
  readonly lastChecked: number;
}

// ─── Notification Types ───

export type NotificationClassification =
  | "critical"     // Must act now
  | "relevant"     // Important, act soon
  | "informational" // FYI, batch
  | "ignore"       // Noise
  | "batch";       // Aggregate with similar

export interface AmbientNotification {
  readonly id: string;
  readonly app: string;
  readonly title: string;
  readonly body: string;
  readonly timestamp: number;
  readonly classification: NotificationClassification;
  readonly confidence: number;
  readonly actionable: boolean;
  readonly actionLabel: string | null;
  readonly groupingKey: string | null;
  readonly relatedGoalId: string | null;
}

export interface NotificationState {
  readonly recent: ReadonlyArray<AmbientNotification>;
  readonly critical: ReadonlyArray<AmbientNotification>;
  readonly batched: ReadonlyArray<ReadonlyArray<AmbientNotification>>;
  readonly suppressionCount: number;
  readonly lastHour: number;
}

// ─── Presence Types ───

export type PresenceState =
  | "away"
  | "working"
  | "in_meeting"
  | "presenting"
  | "gaming"
  | "watching_media"
  | "sleeping"
  | "idle"
  | "coding"
  | "reading"
  | "debugging"
  | "researching"
  | "communicating";

export interface PresenceEstimate {
  readonly state: PresenceState;
  readonly confidence: number;
  readonly since: number;
  readonly factors: ReadonlyArray<string>;
  readonly inputActivity: InputActivity;
  readonly audioActivity: AudioActivity;
}

export interface InputActivity {
  readonly keyboardActive: boolean;
  readonly mouseActive: boolean;
  readonly lastInputTime: number;
  readonly typingSpeed: number;    // chars per minute
  readonly clickFrequency: number; // clicks per minute
}

export interface AudioActivity {
  readonly microphoneActive: boolean;
  readonly speakerActive: boolean;
  readonly ambientNoiseLevel: number; // 0-1
  readonly voiceDetected: boolean;
}

// ─── Multi-Device Types ───

export type DeviceType = "desktop" | "laptop" | "mobile" | "tablet" | "smartwatch" | "server" | "unknown";

export interface DeviceCapabilities {
  readonly hasCamera: boolean;
  readonly hasMicrophone: boolean;
  readonly hasGPS: boolean;
  readonly hasAccelerometer: boolean;
  readonly hasBiometrics: boolean;
  readonly hasTouchscreen: boolean;
  readonly hasKeyboard: boolean;
}

export interface DeviceState {
  readonly deviceId: string;
  readonly deviceType: DeviceType;
  readonly name: string;
  readonly platform: string;
  readonly isOnline: boolean;
  readonly lastSeen: number;
  readonly batteryLevel: number | null;
  readonly networkType: "wifi" | "cellular" | "ethernet" | "unknown";
  readonly capabilities: DeviceCapabilities;
  readonly currentActivity: string | null;
  readonly focusState: "focused" | "background" | "sleeping" | "off";
}

export interface MultiDeviceState {
  readonly devices: ReadonlyArray<DeviceState>;
  readonly primaryDevice: DeviceState | null;
  readonly allDevicesOnline: boolean;
  readonly crossDeviceContinuity: boolean;
}

// ─── Environment Timeline Types ───

export type EnvTimelineEventType =
  | "repository_cloned"
  | "meeting_joined"
  | "meeting_left"
  | "build_succeeded"
  | "build_failed"
  | "package_installed"
  | "dependency_updated"
  | "battery_low"
  | "battery_charged"
  | "usb_connected"
  | "usb_disconnected"
  | "browser_login_detected"
  | "project_switched"
  | "file_created"
  | "file_deleted"
  | "git_branch_created"
  | "git_branch_merged"
  | "docker_container_started"
  | "docker_container_stopped"
  | "ssh_connected"
  | "ssh_disconnected"
  | "vpn_connected"
  | "vpn_disconnected"
  | "screen_shared"
  | "screen_shared_stopped"
  | "focus_mode_started"
  | "focus_mode_ended"
  | "calendar_event_started"
  | "calendar_event_ended"
  | "email_received"
  | "email_replied"
  | "notification_received"
  | "notification_dismissed"
  | "app_installed"
  | "app_uninstalled"
  | "system_update_available"
  | "system_update_installed"
  | "printer_connected"
  | "bluetooth_device_connected"
  | "wifi_connected"
  | "wifi_disconnected"
  | "custom";

export interface EnvTimelineEvent {
  readonly id: string;
  readonly type: EnvTimelineEventType;
  readonly title: string;
  readonly detail: string;
  readonly timestamp: number;
  readonly source: string;
  readonly deviceId: string;
  readonly metadata: Record<string, unknown>;
  readonly relatedEventId: string | null;
}

// ─── Context Fusion Types ───

export interface FusedObservation {
  readonly id: string;
  readonly timestamp: number;
  readonly sources: ReadonlyArray<string>;
  readonly semanticSummary: string;
  readonly confidence: number;
  readonly priority: "ignore" | "background" | "low" | "medium" | "high" | "critical";
  readonly category: "error" | "progress" | "context_change" | "user_action" | "environment" | "communication" | "schedule";
  readonly actionable: boolean;
  readonly context: Record<string, unknown>;
  readonly relatedGoalIds: ReadonlyArray<string>;
  readonly deduplicationKey: string;
}

// ─── Prediction Types ───

export type PredictionType =
  | "next_action"
  | "goal_proximity"
  | "blocker_imminent"
  | "context_switch"
  | "tool_needed"
  | "information_needed"
  | "break_recommended"
  | "focus_session_ending"
  | "meeting_approaching"
  | "deadline_approaching"
  | "debugging_session"
  | "release_preparation"
  | "documentation_needed"
  | "refactoring_opportunity"
  | "dependency_issue";

export interface Prediction {
  readonly id: string;
  readonly type: PredictionType;
  readonly prediction: string;
  readonly confidence: number;
  readonly timeframe: "immediate" | "minutes" | "hours" | "days";
  readonly suggestedAction: string | null;
  readonly reasoning: string;
  readonly timestamp: number;
  readonly evidence: ReadonlyArray<string>;
  readonly relatedGoalId: string | null;
}

export interface PredictionContext {
  readonly recentEvents: ReadonlyArray<EnvTimelineEvent>;
  readonly currentPresence: PresenceEstimate;
  readonly calendarState: CalendarState;
  readonly workspaceState: WorkspaceSnapshot;
  readonly goalProgress: ReadonlyArray<{ goalId: string; progress: number }>;
  readonly recentPredictions: ReadonlyArray<Prediction>;
}

// ─── Ambient Core Types ───

export interface AmbientConfig {
  readonly enabled: boolean;
  readonly visionEnabled: boolean;
  readonly visionIntervalMs: number;
  readonly workspaceEnabled: boolean;
  readonly workspaceIntervalMs: number;
  readonly calendarEnabled: boolean;
  readonly calendarIntervalMs: number;
  readonly emailEnabled: boolean;
  readonly emailIntervalMs: number;
  readonly notificationEnabled: boolean;
  readonly presenceEnabled: boolean;
  readonly multiDeviceEnabled: boolean;
  readonly envTimelineEnabled: boolean;
  readonly contextFusionEnabled: boolean;
  readonly predictionEnabled: boolean;
  readonly predictionIntervalMs: number;
  readonly maxObservationsPerMinute: number;
}

export interface AmbientState {
  readonly vision: VisionAnalysis | null;
  readonly workspace: WorkspaceSnapshot | null;
  readonly calendar: CalendarState | null;
  readonly email: EmailState | null;
  readonly notifications: NotificationState | null;
  readonly presence: PresenceEstimate;
  readonly devices: MultiDeviceState;
  readonly recentFusions: ReadonlyArray<FusedObservation>;
  readonly recentPredictions: ReadonlyArray<Prediction>;
  readonly stats: AmbientStats;
}

export interface AmbientStats {
  readonly uptime: number;
  readonly totalObservations: number;
  readonly totalFusions: number;
  readonly totalPredictions: number;
  readonly averageConfidence: number;
  readonly lastVisionAnalysis: number;
  readonly lastPrediction: number;
  readonly sensorStatus: Record<string, "active" | "inactive" | "error">;
}
