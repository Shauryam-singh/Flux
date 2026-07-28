import type { AmbientConfig, AmbientState, AmbientStats } from "@ai-agent/ambient-types";
import type { VisionSensor } from "@ai-agent/vision";
import type { WorkspaceSensor } from "@ai-agent/workspace";
import type { CalendarSensor } from "@ai-agent/calendar";
import type { EmailSensor } from "@ai-agent/email";
import type { NotificationIntel } from "@ai-agent/notification-intel";
import type { PresenceSensor } from "@ai-agent/presence";
import type { MultiDeviceSensor } from "@ai-agent/multi-device";
import type { EnvTimeline } from "@ai-agent/env-timeline";
import type { ContextFusionEngine } from "@ai-agent/context-fusion";
import type { PredictionEngine } from "@ai-agent/prediction";

export interface AmbientOrchestratorDeps {
  vision?: VisionSensor;
  workspace?: WorkspaceSensor;
  calendar?: CalendarSensor;
  email?: EmailSensor;
  notificationIntel?: NotificationIntel;
  presence?: PresenceSensor;
  multiDevice?: MultiDeviceSensor;
  envTimeline?: EnvTimeline;
  contextFusion?: ContextFusionEngine;
  prediction?: PredictionEngine;
  onObservation?: (observation: { source: string; title: string; detail: string }) => void;
}

const DEFAULT_CONFIG: AmbientConfig = {
  enabled: true,
  visionEnabled: false,
  visionIntervalMs: 5000,
  workspaceEnabled: true,
  workspaceIntervalMs: 2000,
  calendarEnabled: false,
  calendarIntervalMs: 60000,
  emailEnabled: false,
  emailIntervalMs: 30000,
  notificationEnabled: true,
  presenceEnabled: true,
  multiDeviceEnabled: true,
  envTimelineEnabled: true,
  contextFusionEnabled: true,
  predictionEnabled: true,
  predictionIntervalMs: 30000,
  maxObservationsPerMinute: 60,
};

export class AmbientOrchestrator {
  private config: AmbientConfig;
  private deps: AmbientOrchestratorDeps;
  private started = false;
  private timers: NodeJS.Timeout[] = [];
  private startTime = 0;
  private observationCount = 0;
  private fusionCount = 0;
  private predictionCount = 0;

  constructor(deps: AmbientOrchestratorDeps, config?: Partial<AmbientConfig>) {
    this.deps = deps;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(): void {
    if (this.started || !this.config.enabled) return;
    this.started = true;
    this.startTime = Date.now();

    if (this.config.workspaceEnabled && this.deps.workspace) {
      this.timers.push(
        setInterval(() => this.pollWorkspace(), this.config.workspaceIntervalMs),
      );
    }

    if (this.config.calendarEnabled && this.deps.calendar) {
      this.timers.push(
        setInterval(() => this.pollCalendar(), this.config.calendarIntervalMs),
      );
    }

    if (this.config.emailEnabled && this.deps.email) {
      this.timers.push(
        setInterval(() => this.pollEmail(), this.config.emailIntervalMs),
      );
    }

    if (this.config.visionEnabled && this.deps.vision) {
      this.timers.push(
        setInterval(() => this.captureVision(), this.config.visionIntervalMs),
      );
    }

    if (this.config.predictionEnabled && this.deps.prediction) {
      this.timers.push(
        setInterval(() => this.runPredictions(), this.config.predictionIntervalMs),
      );
    }
  }

  stop(): void {
    this.started = false;
    for (const timer of this.timers) {
      clearInterval(timer);
    }
    this.timers = [];
  }

  async getState(): Promise<AmbientState> {
    const [workspace, calendar, email, devices] = await Promise.all([
      this.deps.workspace?.snapshot() ?? Promise.resolve(null),
      this.deps.calendar?.getState() ?? Promise.resolve(null),
      this.deps.email?.getState() ?? Promise.resolve(null),
      this.deps.multiDevice?.getState() ?? Promise.resolve(null),
    ]);

    const vision = this.deps.vision?.getLastAnalysis() ?? null;
    const presence = this.deps.presence?.estimate() ?? {
      state: "idle" as const,
      confidence: 0.5,
      since: Date.now(),
      factors: [],
      inputActivity: { keyboardActive: false, mouseActive: false, lastInputTime: 0, typingSpeed: 0, clickFrequency: 0 },
      audioActivity: { microphoneActive: false, speakerActive: false, ambientNoiseLevel: 0, voiceDetected: false },
    };
    const notifications = this.deps.notificationIntel?.getState() ?? null;
    const recentFusions = this.deps.contextFusion?.getRecentFusions(10) ?? [];
    const recentPredictions = this.deps.prediction?.getRecentPredictions(10) ?? [];

    return {
      vision,
      workspace,
      calendar,
      email,
      notifications,
      presence,
      devices: devices ?? { devices: [], primaryDevice: null, allDevicesOnline: true, crossDeviceContinuity: false },
      recentFusions,
      recentPredictions,
      stats: this.getStats(),
    };
  }

  getStats(): AmbientStats {
    const sensorStatus: Record<string, "active" | "inactive" | "error"> = {};
    sensorStatus.vision = this.deps.vision?.isAvailable() ? "active" : "inactive";
    sensorStatus.workspace = this.deps.workspace?.isAvailable() ? "active" : "inactive";
    sensorStatus.calendar = this.deps.calendar?.isAvailable() ? "active" : "inactive";
    sensorStatus.email = this.deps.email?.isAvailable() ? "active" : "inactive";
    sensorStatus.presence = this.deps.presence?.isAvailable() ? "active" : "inactive";
    sensorStatus.multiDevice = this.deps.multiDevice?.isAvailable() ? "active" : "inactive";

    return {
      uptime: this.started ? Date.now() - this.startTime : 0,
      totalObservations: this.observationCount,
      totalFusions: this.fusionCount,
      totalPredictions: this.predictionCount,
      averageConfidence: 0,
      lastVisionAnalysis: this.deps.vision?.getLastAnalysis()?.timestamp ?? 0,
      lastPrediction: this.deps.prediction?.getRecentPredictions(1)[0]?.timestamp ?? 0,
      sensorStatus,
    };
  }

  isRunning(): boolean {
    return this.started;
  }

  private pollWorkspace(): void {
    if (!this.deps.workspace) return;
    this.deps.workspace.snapshot().then((snapshot) => {
      this.observationCount++;
      if (this.deps.envTimeline && snapshot.openApplications.length > 0) {
        this.deps.envTimeline.record({
          type: "custom",
          title: "Workspace snapshot",
          detail: `${snapshot.openApplications.length} applications open`,
          source: "workspace",
          deviceId: "local",
          metadata: { applicationCount: snapshot.openApplications.length },
          relatedEventId: null,
        });
      }
    });
  }

  private pollCalendar(): void {
    if (!this.deps.calendar) return;
    this.deps.calendar.getState().then((state) => {
      if (state.currentEvent) {
        this.observationCount++;
        this.emit({
          source: "calendar",
          title: `In meeting: ${state.currentEvent.title}`,
          detail: state.currentEvent.description,
        });
      }
    });
  }

  private pollEmail(): void {
    if (!this.deps.email) return;
    this.deps.email.getState().then((state) => {
      if (state.urgentCount > 0) {
        this.observationCount++;
        this.emit({
          source: "email",
          title: `${state.urgentCount} urgent email(s)`,
          detail: `From: ${state.unreadBySender.map((s) => s.sender).join(", ")}`,
        });
      }
    });
  }

  private captureVision(): void {
    if (!this.deps.vision) return;
    this.deps.vision.capture().then((analysis) => {
      if (analysis) {
        this.observationCount++;
        if (analysis.hasErrors) {
          this.emit({
            source: "vision",
            title: `Visual errors detected: ${analysis.errorCount}`,
            detail: analysis.semanticSummary,
          });
        }
      }
    });
  }

  private runPredictions(): void {
    if (!this.deps.prediction || !this.deps.presence) return;

    const context: import("@ai-agent/ambient-types").PredictionContext = {
      recentEvents: this.deps.envTimeline?.getRecent(20) ?? [],
      currentPresence: this.deps.presence.estimate(),
      calendarState: { events: [], nextEvent: null, timeUntilNextEvent: null, currentEvent: null, focusBlockActive: false, todayEventCount: 0, upcomingDeadlines: [] },
      workspaceState: { timestamp: Date.now(), openApplications: [], browserTabs: [], terminals: [], containers: [], openFiles: [], focusedFile: null, gitBranch: null, clipboardContent: null, clipboardType: null, recentDownloads: [], mountedDrives: [], notifications: [] },
      goalProgress: [],
      recentPredictions: this.deps.prediction.getRecentPredictions(5),
    };

    const predictions = this.deps.prediction.predict(context);
    this.predictionCount += predictions.length;

    for (const pred of predictions) {
      if (pred.confidence > 0.7) {
        this.emit({
          source: "prediction",
          title: pred.prediction,
          detail: pred.reasoning,
        });
      }
    }
  }

  private emit(observation: { source: string; title: string; detail: string }): void {
    this.deps.onObservation?.(observation);
  }
}
