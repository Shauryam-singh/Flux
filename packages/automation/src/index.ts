import type {
  ActivityMode,
  ActivitySnapshot,
  ActionRecord,
  AutomationState,
  DiscoveredPattern,
  ProactiveSuggestion,
  ContextProfile,
  WorkSession,
  ProfileActionResult,
} from "./types/index.js";
import { LearningStore } from "./impl/learning-store.js";
import { ActivityClassifier } from "./impl/activity-classifier.js";
import { BehaviorLearner } from "./impl/behavior-learner.js";
import { ContextProfileManager } from "./impl/context-profiles.js";
import { ProactiveEngine, type ProactiveEngineConfig, type SuggestionCallbacks } from "./impl/proactive-engine.js";
import { WorkSessionDetector } from "./impl/work-session-detector.js";
import { ConfirmationFlow, type ConfirmationRequest } from "./impl/confirmation-flow.js";
import { SmartWake } from "./impl/smart-wake.js";

export interface AutomationEngineConfig {
  learningStoreDir?: string | undefined;
  proactiveConfig?: Partial<ProactiveEngineConfig> | undefined;
  classificationIntervalMs?: number | undefined;
  patternDiscoveryIntervalMs?: number | undefined;
}

export interface AutomationCallbacks {
  onModeChange?: ((mode: ActivityMode, profile: ContextProfile | null) => void) | undefined;
  onSuggestion?: ((suggestion: ProactiveSuggestion) => void) | undefined;
  executeAction?: ((action: { type: string; detail: string }) => Promise<ProfileActionResult>) | undefined;
}

export class AutomationEngine {
  readonly store: LearningStore;
  readonly classifier: ActivityClassifier;
  readonly learner: BehaviorLearner;
  readonly profiles: ContextProfileManager;
  readonly proactive: ProactiveEngine;
  readonly sessionDetector: WorkSessionDetector;
  readonly confirmation: ConfirmationFlow;
  readonly smartWake: SmartWake;

  private state: AutomationState;
  private lastApp = "";
  private lastMode: ActivityMode = "unknown";
  private classificationTimer: ReturnType<typeof setInterval> | null = null;
  private patternTimer: ReturnType<typeof setInterval> | null = null;
  private onModeChange: ((mode: ActivityMode, profile: ContextProfile | null) => void) | undefined;
  private onSuggestion: ((suggestion: ProactiveSuggestion) => void) | undefined;

  constructor(config?: AutomationEngineConfig, callbacks?: AutomationCallbacks) {
    this.store = new LearningStore(config?.learningStoreDir);
    this.classifier = new ActivityClassifier();
    this.learner = new BehaviorLearner(this.store);
    this.profiles = new ContextProfileManager();
    this.sessionDetector = new WorkSessionDetector();
    this.smartWake = new SmartWake();
    this.onModeChange = callbacks?.onModeChange;
    this.onSuggestion = callbacks?.onSuggestion;

    const defaultExecutor = async () => ({ success: false, action: "", detail: "No executor", error: "Not implemented" });
    const executeAction = callbacks?.executeAction ?? defaultExecutor;
    this.confirmation = new ConfirmationFlow(executeAction);

    this.proactive = new ProactiveEngine(config?.proactiveConfig, {
      onSuggestion: callbacks?.onSuggestion,
      onAutoExecute: async (s) => {
        if (s.profileId) {
          const profile = this.profiles.getAll().find(p => p.id === s.profileId);
          if (profile) {
            for (const action of profile.autoActions) {
              if (action.enabled) await executeAction(action);
            }
          }
        }
      },
    });

    this.state = {
      totalObservations: 0,
      totalActions: 0,
      totalPatterns: this.store.getPatterns().length,
      totalProfiles: this.profiles.getAll().length,
      currentMode: "unknown",
      currentSession: undefined,
      pendingSuggestions: [],
      lastClassificationAt: null,
      lastPatternDiscoveryAt: null,
    };

    const classInterval = config?.classificationIntervalMs ?? 10000;
    this.classificationTimer = setInterval(() => {}, classInterval);

    const patternInterval = config?.patternDiscoveryIntervalMs ?? 300000;
    this.patternTimer = setInterval(() => this.discoverPatterns(), patternInterval);
  }

  observe(app: string, title: string, extra?: {
    idleSeconds?: number | undefined;
    audioPlaying?: boolean | undefined;
    gitDirty?: boolean | undefined;
    dockerRunning?: number | undefined;
  }): ActivityMode {
    const now = new Date();
    const snapshot: Omit<ActivitySnapshot, "mode" | "timestamp"> = {
      activeApp: app,
      activeWindowTitle: title,
      idleSeconds: extra?.idleSeconds ?? 0,
      audioPlaying: extra?.audioPlaying ?? false,
      gitDirty: extra?.gitDirty ?? false,
      dockerRunning: (extra?.dockerRunning ?? 0) > 0,
      dayOfWeek: now.getDay(),
      hourOfDay: now.getHours(),
    };

    const result = this.classifier.classifyWithConfidence(snapshot);
    const mode = result.mode;

    this.store.recordSnapshot({ ...snapshot, mode });
    this.state.totalObservations++;
    this.state.lastClassificationAt = Date.now();

    if (app !== this.lastApp) {
      this.store.recordAction({
        type: "app_switch",
        detail: app,
        context: mode,
        metadata: { title, confidence: result.confidence },
      });
      this.state.totalActions++;
    }

    const sessionResult = this.sessionDetector.onActivityChange(app, mode, Date.now());
    if (sessionResult.sessionStarted || sessionResult.sessionEnded) {
      this.state.currentSession = this.sessionDetector.getCurrentSession() ?? undefined;
    }

    if (mode !== this.lastMode) {
      this.lastMode = mode;
      this.state.currentMode = mode;

      const profile = this.profiles.match(app, title);
      this.onModeChange?.(mode, profile);

      const patterns = this.store.getPatterns();
      const suggestions = this.proactive.evaluate(mode, profile, patterns, this.lastApp);
      this.state.pendingSuggestions = this.proactive.getPending();
    }

    this.lastApp = app;
    return mode;
  }

  recordCommand(command: string, mode?: ActivityMode): void {
    this.store.recordAction({
      type: "command",
      detail: command,
      context: mode ?? this.lastMode,
    });
    this.state.totalActions++;
  }

  recordToolUse(toolName: string, detail: string): void {
    this.store.recordAction({
      type: "tool_use",
      detail: `${toolName}: ${detail}`,
      context: this.lastMode,
    });
    this.state.totalActions++;
  }

  recordBrowserNav(url: string): void {
    this.store.recordAction({
      type: "browser_nav",
      detail: url,
      context: this.lastMode,
    });
    this.state.totalActions++;
  }

  recordFileOpen(filePath: string): void {
    this.store.recordAction({
      type: "file_open",
      detail: filePath,
      context: this.lastMode,
    });
    this.state.totalActions++;
  }

  discoverPatterns(): DiscoveredPattern[] {
    const patterns = this.learner.discoverPatterns();
    this.state.totalPatterns = this.store.getPatterns().length;
    this.state.lastPatternDiscoveryAt = Date.now();
    return patterns;
  }

  getState(): AutomationState {
    return {
      ...this.state,
      pendingSuggestions: this.proactive.getPending(),
      currentSession: this.sessionDetector.getCurrentSession() ?? undefined,
    };
  }

  getPatterns(): DiscoveredPattern[] {
    return this.store.getPatterns();
  }

  getProfiles(): ContextProfile[] {
    return this.profiles.getAll();
  }

  getSuggestions(): ProactiveSuggestion[] {
    return this.proactive.getPending();
  }

  acceptSuggestion(id: string): boolean {
    return this.proactive.accept(id);
  }

  rejectSuggestion(id: string): boolean {
    return this.proactive.reject(id);
  }

  getCurrentSession(): WorkSession | null {
    return this.sessionDetector.getCurrentSession();
  }

  getSmartWakeApps(): string[] {
    return this.smartWake.getSuggestedApps();
  }

  getSmartWakeMode(): string {
    return this.smartWake.getSuggestedMode();
  }

  recordShutdown(apps: string[], mode: string): void {
    this.smartWake.recordSession(apps, mode);
  }

  destroy(): void {
    if (this.classificationTimer) clearInterval(this.classificationTimer);
    if (this.patternTimer) clearInterval(this.patternTimer);
    this.store.destroy();
  }
}

// Re-export types
export type {
  ActivityMode,
  ActivitySnapshot,
  ActionRecord,
  AutomationState,
  DiscoveredPattern,
  ProactiveSuggestion,
  ContextProfile,
  WorkSession,
  ConfirmationRequest,
  ProfileActionResult,
};
export { LearningStore } from "./impl/learning-store.js";
export { ActivityClassifier } from "./impl/activity-classifier.js";
export { BehaviorLearner } from "./impl/behavior-learner.js";
export { ContextProfileManager } from "./impl/context-profiles.js";
export { ProactiveEngine } from "./impl/proactive-engine.js";
export { WorkSessionDetector } from "./impl/work-session-detector.js";
export { ConfirmationFlow } from "./impl/confirmation-flow.js";
export { SmartWake } from "./impl/smart-wake.js";
