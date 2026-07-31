import { execSync } from "node:child_process";
import { DefaultSession } from "@ai-agent/agent";
import { AttentionManager, type ObservationSource } from "@ai-agent/attention";
import {
  type CognitiveOrchestrator,
  DefaultCognitiveOrchestrator,
} from "@ai-agent/cognitive";
import { DefaultMemoryManager } from "@ai-agent/cognitive-memory";
import { DefaultConfidenceCalibration } from "@ai-agent/confidence-calibration";
import {
  DefaultDecisionEngine,
  DefaultInterruptController,
} from "@ai-agent/decisions";
import { DefaultExperienceDatabase } from "@ai-agent/experience-db";
import { DefaultGoalManager } from "@ai-agent/goals";
import { DefaultHabitDiscovery } from "@ai-agent/habit-discovery";
import { DefaultKnowledgeConsolidation } from "@ai-agent/knowledge-consolidation";
import { DefaultMetaCognitionEngine } from "@ai-agent/meta-cognition";
import { DefaultProviderFactory, type Provider } from "@ai-agent/providers";
import {
  DefaultReasoningEngine,
  LlmThoughtGenerator,
} from "@ai-agent/reasoning";
import {
  AudioSensor,
  BatterySensor,
  ClipboardSensor,
  DefaultSensorManager,
  DockerSensor,
  FileSystemSensor,
  GitSensor,
  IdleSensor,
  KubernetesSensor,
  NotificationSensor,
  SpotifySensor,
  SSHSensor,
  SystemHealthSensor,
  WindowTracker,
  BrowserContextSensor,
  CodingSessionTracker,
} from "@ai-agent/sensors";
import { createAutomationService } from "@ai-agent/services-automations";
import { createChatService } from "@ai-agent/services-chat";
import { createCodingService } from "@ai-agent/services-coding";
import { createContextService } from "@ai-agent/services-context";
import {
  DefaultServiceRegistry,
  type LlmProvider,
  type SystemContext,
  Orchestrator,
} from "@ai-agent/services-core";
import { createFilesService } from "@ai-agent/services-files";
import { createMonitorService } from "@ai-agent/services-monitor";
import { createNotificationService } from "@ai-agent/services-notifications";
import { createProactiveService } from "@ai-agent/services-proactive";
import { createRemindersService } from "@ai-agent/services-reminders";
import { createSearchService } from "@ai-agent/services-search";
import { createSystemService } from "@ai-agent/services-system";
import { createScheduledNotificationsService } from "@ai-agent/services-scheduled-notifications";
import { createGameUpdaterService } from "@ai-agent/services-game-updater";
import { createFileProcessorService } from "@ai-agent/services-file-processor";
import { createBrowserControlService } from "@ai-agent/services-browser-control";
import { createSendMessageService } from "@ai-agent/services-send-message";
import { DefaultPluginLoader, type FluxPlugin } from "@ai-agent/plugins";
import { DefaultKnowledgeBase } from "@ai-agent/knowledge-base";
import { DefaultMultiAgentCoordinator, AgentFactory } from "@ai-agent/multi-agent";
import { BootBriefingGenerator, type BootBriefing } from "./boot-briefing.js";
import { SessionSummaryStore, type SessionSummary } from "./session-summary-store.js";
import { DefaultCrossDeviceSync } from "@ai-agent/cross-device";
import { DefaultStrategyLibrary } from "@ai-agent/strategy-library";
import {
  type CognitionResult,
  DefaultThoughtGraph,
} from "@ai-agent/thought-graph";
import {
  createCronTool,
  createDockerTool,
  createEditFileTool,
  createGitAddTool,
  createGitBranchTool,
  createGitCheckoutTool,
  createGitCommitTool,
  createGitDiffTool,
  createGitLogTool,
  createGitPullTool,
  createGitPushTool,
  createGitStatusTool,
  createHttpRequestTool,
  createListDirectoryTool,
  createProcessMonitorTool,
  createReadFileTool,
  createRunCommandTool,
  createScreenMonitorTool,
  createSystemInfoTool,
  createWriteFileTool,
  DefaultToolRegistry,
  echoTool,
} from "@ai-agent/tools";
import { DefaultWorkingMemory } from "@ai-agent/working-memory";
import { DefaultWorldModel } from "@ai-agent/world-model";
import type {
  FluxRuntime,
  FluxRuntimeConfig,
  FluxRuntimeMessage,
  FluxRuntimeResult,
  FluxRuntimeState,
  TickEvent,
} from "../interfaces/flux-runtime.js";
import { CognitionPipeline } from "./cognition-pipeline.js";
import { SensorCorrelator } from "./sensor-correlator.js";
import { DismissalTracker } from "./dismissal-tracker.js";
import { TimeAwareEngine } from "./time-aware-engine.js";
import { WorkflowAutomationEngine } from "./workflow-automation.js";

export class DefaultFluxRuntime implements FluxRuntime {
  private readonly config: FluxRuntimeConfig;
  private readonly startTime: number;
  private readonly history: FluxRuntimeMessage[] = [];
  private readonly tickHandlers: Array<(event: TickEvent) => void> = [];

  readonly session: InstanceType<typeof DefaultSession>;
  readonly provider: Provider;
  readonly llmProvider: LlmProvider;
  readonly orchestrator: InstanceType<typeof Orchestrator>;
  readonly attention: InstanceType<typeof AttentionManager>;
  readonly cognitive: CognitiveOrchestrator;
  readonly worldModel: InstanceType<typeof DefaultWorldModel>;
  readonly workingMemory: InstanceType<typeof DefaultWorkingMemory>;
  readonly goalManager: InstanceType<typeof DefaultGoalManager>;
  readonly experienceDb: InstanceType<typeof DefaultExperienceDatabase>;
  readonly metaCognition: InstanceType<typeof DefaultMetaCognitionEngine>;
  readonly strategyLibrary: InstanceType<typeof DefaultStrategyLibrary>;
  readonly confidenceCalibration: InstanceType<
    typeof DefaultConfidenceCalibration
  >;
  readonly knowledge: InstanceType<typeof DefaultKnowledgeConsolidation>;
  readonly habits: InstanceType<typeof DefaultHabitDiscovery>;
  readonly thoughtGraph: DefaultThoughtGraph;
  readonly sensors: DefaultSensorManager;
  readonly memory: DefaultMemoryManager;
  readonly pluginLoader: DefaultPluginLoader;
  readonly knowledgeBase: DefaultKnowledgeBase;
  readonly multiAgent: DefaultMultiAgentCoordinator;
  readonly crossDevice: DefaultCrossDeviceSync;
  private loadedPlugins: FluxPlugin[] = [];
  private readonly pipeline: CognitionPipeline;

  private totalInteractions = 0;
  private cognitiveReady = false;
  private running = false;
  private backgroundTimer: ReturnType<typeof setInterval> | null = null;
  private lastTickAt: number | null = null;
  private tickCount = 0;
  private lastScreenApp = "";
  private lastScreenTitle = "";
  private lastPipelineDurationMs: number | null = null;
  private lastPipelineResult: CognitionResult | null = null;
  private recentThoughts: Array<{
    type: string;
    content: string;
    confidence: number;
    timestamp: number;
  }> = [];
  private recentActions: Array<{
    type: string;
    reasoning: string;
    confidence: number;
    timestamp: number;
  }> = [];
  private recentSensorEvents: Array<{
    sensorId: string;
    type: string;
    timestamp: number;
    priority: string;
  }> = [];
  private proactiveSuggestions: Array<{
    id: string;
    type: string;
    message: string;
    timestamp: number;
    priority: string;
  }> = [];
  private lastSuggestionCheck = 0;
  private lastScreenAppForSuggestions = "";
  private appVisitCount: Map<string, number> = new Map();
  // Proactive awareness — new trackers
  private windowTracker: InstanceType<typeof WindowTracker>;
  private browserContext: InstanceType<typeof BrowserContextSensor>;
  private codingSession: InstanceType<typeof CodingSessionTracker>;
  private lastCodingSessionSuggestion = 0;
  private lastSystemHealthSuggestion = 0;
  // Proactive messaging
  private proactiveMessages: Array<{
    id: string;
    content: string;
    type: "suggestion" | "alert" | "info";
    priority: "low" | "medium" | "high";
    timestamp: number;
    spoken: boolean;
    actionLabel?: string;
    actionPayload?: string;
  }> = [];
  private proactiveMessageListeners: Array<(msg: string) => void> = [];
  private proactiveSpeakListeners: Array<(text: string) => void> = [];
  private lastProactiveSpeak = 0;
  // Tier 2: Health trend tracking
  private cpuHistory: number[] = [];
  private memoryHistory: number[] = [];
  private lastAudioSuggestion = 0;
  private lastSpotifySuggestion = 0;
  private lastDockerSuggestion = 0;
  private lastK8sSuggestion = 0;
  private lastSSHSessionSuggestion = 0;
  private lastClipboardAnalysisSuggestion = 0;
  private lastNotificationSuggestion = 0;
  // Tier 3: Intelligence
  private readonly sensorCorrelator: SensorCorrelator;
  private readonly dismissalTracker: DismissalTracker;
  private readonly timeAwareEngine: TimeAwareEngine;
  // Tier 4: Automation
  private readonly workflowAutomation: WorkflowAutomationEngine;
  // Boot briefing
  private readonly bootBriefing: BootBriefingGenerator;
  // Session summaries
  private readonly sessionSummaries: SessionSummaryStore;
  private userMessageCount = 0;
  private lastCorrelationCheck = 0;
  private lastTimeAwareCheck = 0;
  private lastAutomationCheck = 0;

  constructor(config: FluxRuntimeConfig) {
    this.config = config;
    this.startTime = Date.now();

    // --- Layer 1: Tools ---
    const toolRegistry = new DefaultToolRegistry();
    const tools = [
      echoTool,
      createReadFileTool(),
      createWriteFileTool(),
      createEditFileTool(),
      createListDirectoryTool(),
      createRunCommandTool(),
      createGitStatusTool(),
      createGitDiffTool(),
      createGitLogTool(),
      createGitAddTool(),
      createGitCommitTool(),
      createGitBranchTool(),
      createGitCheckoutTool(),
      createGitPushTool(),
      createGitPullTool(),
      createHttpRequestTool(),
      createProcessMonitorTool(),
      createCronTool(),
      createSystemInfoTool(),
      createDockerTool(),
      createScreenMonitorTool(),
    ];
    for (const tool of tools) {
      toolRegistry.register(tool);
    }

    // --- Layer 2: LLM Provider ---
    const factory = new DefaultProviderFactory(config.providerConfigs);
    this.provider = factory.create(config.provider);

    this.llmProvider = {
      complete: (req) =>
        this.provider.complete({
          model: req.model === "default" ? config.model : req.model,
          prompt: req.prompt,
          temperature: req.temperature ?? 0.7,
        }),
    };

    // --- Layer 3: Services ---
    const serviceRegistry = new DefaultServiceRegistry();
    serviceRegistry.register(createChatService());
    serviceRegistry.register(createCodingService({ toolRegistry }));
    serviceRegistry.register(createSearchService());
    serviceRegistry.register(createSystemService());
    serviceRegistry.register(createRemindersService());
    serviceRegistry.register(createFilesService());
    serviceRegistry.register(createNotificationService());
    serviceRegistry.register(createMonitorService());
    serviceRegistry.register(createAutomationService());
    serviceRegistry.register(createContextService());
    serviceRegistry.register(createProactiveService());
    serviceRegistry.register(createScheduledNotificationsService());
    serviceRegistry.register(createGameUpdaterService());
    serviceRegistry.register(createFileProcessorService());
    serviceRegistry.register(createBrowserControlService());
    serviceRegistry.register(createSendMessageService());

    this.orchestrator = new Orchestrator(serviceRegistry);

    // --- Layer 4: Session & Memory ---
    this.session = new DefaultSession("flux-runtime-session");

    // --- Layer 5: Cognitive System (Phase 2) ---
    this.worldModel = new DefaultWorldModel();
    this.workingMemory = new DefaultWorkingMemory({
      capacity: config.maxMemoryCapacity ?? 50,
    });
    this.goalManager = new DefaultGoalManager();
    const thoughtGenerator = new LlmThoughtGenerator(this.llmProvider);
    const reasoningEngine = new DefaultReasoningEngine(thoughtGenerator);
    const decisionEngine = new DefaultDecisionEngine();
    const interruptController = new DefaultInterruptController();

    this.cognitive = new DefaultCognitiveOrchestrator(
      this.worldModel,
      this.workingMemory,
      this.goalManager,
      reasoningEngine,
      decisionEngine,
      interruptController,
      {
        llmProvider: this.llmProvider,
        onAction: (decision) => {
          this.recentActions.push({
            type: decision.action.type,
            reasoning: decision.reasoning,
            confidence: decision.action.confidence,
            timestamp: decision.timestamp,
          });
          if (this.recentActions.length > 50) this.recentActions.shift();
        },
        onThought: (thought) => {
          this.recentThoughts.push({
            type: thought.type,
            content: thought.content,
            confidence: thought.confidence,
            timestamp: thought.timestamp,
          });
          if (this.recentThoughts.length > 50) this.recentThoughts.shift();
        },
      },
    );

    // --- Layer 6: Attention System (Phase 1) ---
    this.attention = new AttentionManager({
      minBrainScore: config.attentionMinBrainScore ?? 40,
      onSummary: () => {},
      onObservation: (observation) => {
        if (this.cognitiveReady) {
          // Feed to both legacy cognitive system and new pipeline
          this.cognitive.observe(observation);
          this.pipeline.feedObservation(observation);
        }
      },
    });

    // --- Layer 7: Self-Evolution (Phase 6) ---
    this.experienceDb = new DefaultExperienceDatabase();
    this.metaCognition = new DefaultMetaCognitionEngine();
    this.strategyLibrary = new DefaultStrategyLibrary();
    this.confidenceCalibration = new DefaultConfidenceCalibration();
    this.knowledge = new DefaultKnowledgeConsolidation();
    this.habits = new DefaultHabitDiscovery();

    // --- Layer 8: Thought Graph + Cognition Pipeline ---
    this.thoughtGraph = new DefaultThoughtGraph();
    this.pipeline = new CognitionPipeline(
      this.thoughtGraph,
      this.worldModel,
      this.workingMemory,
      this.goalManager,
      this.llmProvider,
      this.attention,
    );

    // --- Layer 9: Real-World Sensors ---
    this.sensors = new DefaultSensorManager();

    // Register all sensors
    this.sensors.register(new GitSensor(process.cwd()));
    this.sensors.register(new FileSystemSensor([process.cwd()]));
    this.sensors.register(new ClipboardSensor());
    this.sensors.register(new BatterySensor());
    this.sensors.register(new IdleSensor());
    this.sensors.register(new NotificationSensor());
    this.sensors.register(new DockerSensor());
    this.sensors.register(new SpotifySensor());
    this.sensors.register(new KubernetesSensor());
    this.sensors.register(new SSHSensor());
    this.sensors.register(new AudioSensor());
    this.sensors.register(new SystemHealthSensor());

    // --- Layer 9.5: Plugin System ---
    this.pluginLoader = new DefaultPluginLoader(this.sensors);
    this.knowledgeBase = new DefaultKnowledgeBase();
    this.multiAgent = new DefaultMultiAgentCoordinator();
    this.crossDevice = new DefaultCrossDeviceSync();

    // Register default agents
    this.registerDefaultAgents();

    // Initialize proactive awareness trackers
    this.windowTracker = new WindowTracker();
    this.browserContext = new BrowserContextSensor();
    this.codingSession = new CodingSessionTracker();

    // Tier 3: Intelligence
    this.sensorCorrelator = new SensorCorrelator();
    this.dismissalTracker = new DismissalTracker();
    this.timeAwareEngine = new TimeAwareEngine();
    // Tier 4: Automation
    this.workflowAutomation = new WorkflowAutomationEngine();
    // Boot briefing
    this.bootBriefing = new BootBriefingGenerator();
    // Session summaries
    this.sessionSummaries = new SessionSummaryStore();

    // Wire sensor events to attention system
    this.sensors.onEvent((event) => {
      // Track recent sensor events for streaming
      this.recentSensorEvents.push({
        sensorId: event.sensorId,
        type: event.type,
        timestamp: event.timestamp,
        priority: event.priority,
      });
      if (this.recentSensorEvents.length > 100) this.recentSensorEvents.shift();

      if (this.cognitiveReady && this.running) {
        const observation = {
          id: `${event.sensorId}_${event.timestamp}`,
          source: event.source,
          title: `[${event.sensorId}] ${event.type}`,
          detail: JSON.stringify(event.data).slice(0, 500),
          priority: event.priority,
          score:
            event.priority === "critical"
              ? 95
              : event.priority === "high"
                ? 80
                : event.priority === "medium"
                  ? 50
                  : 20,
          timestamp: event.timestamp,
          mergeable: true,
          consumed: false,
        };
        this.attention.process(observation);
      }
    });

    // --- Layer 10: Cognitive Memory System ---
    this.memory = new DefaultMemoryManager(2000); // 2000 max memories

    this.cognitiveReady = true;

    // Auto-start if configured
    if (config.autoStart) {
      this.start();
    }
  }

  // ─── Background Cognition Loop ───────────────────────────────────

  start(): void {
    if (this.running) return;
    this.running = true;

    // Load plugins from ~/.flux/plugins/
    void this.pluginLoader.loadAll().then((plugins) => {
      this.loadedPlugins = plugins as FluxPlugin[];
    });

    // Index project files into knowledge base
    void this.knowledgeBase.indexDirectory(process.cwd(), {
      extensions: [".ts", ".js", ".json", ".md", ".py"],
      excludeDirs: ["node_modules", ".git", "dist", ".turbo", "__pycache__", "target"],
      maxFileSize: 50_000,
      chunkSize: 30,
    });

    // Start the cognitive system's internal timers (5s think cycle, 30min reflection)
    this.cognitive.start();

    // Start real-world sensors
    if (this.config.enableSensors !== false) {
      void this.sensors.startAll();
    }

    // Start our observation gathering loop
    const tickMs = this.config.backgroundTickMs ?? 5000;
    this.backgroundTimer = setInterval(() => {
      void this.runTick();
    }, tickMs);

    // Run first tick immediately
    void this.runTick();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;

    // Stop cognitive system timers
    this.cognitive.stop();

    // Stop sensors
    void this.sensors.stopAll();

    // Unload plugins
    for (const plugin of this.loadedPlugins) {
      if (plugin.destroy) {
        void plugin.destroy();
      }
    }
    this.loadedPlugins = [];

    // Stop our background loop
    if (this.backgroundTimer) {
      clearInterval(this.backgroundTimer);
      this.backgroundTimer = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  onTick(handler: (event: TickEvent) => void): () => void {
    this.tickHandlers.push(handler);
    return () => {
      const idx = this.tickHandlers.indexOf(handler);
      if (idx >= 0) this.tickHandlers.splice(idx, 1);
    };
  }

  explainThought(thoughtId: string) {
    return this.thoughtGraph.explain(thoughtId);
  }

  getRecentThoughts(limit = 10) {
    return this.thoughtGraph.getRecentThoughts(limit);
  }

  getStrongestThoughts(limit = 10) {
    return this.thoughtGraph.getStrongestThoughts(limit);
  }

  private async generateProactiveSuggestions(): Promise<void> {
    const now = Date.now();
    // Check every 15 seconds
    if (now - this.lastSuggestionCheck < 15000) return;
    this.lastSuggestionCheck = now;

    try {
      // ── 1. System Health + Trends ───────────────────────────────
      if (now - this.lastSystemHealthSuggestion > 120_000) {
        const healthSnap = await this.sensors.get("system-health")?.snapshot() as {
          cpuUsagePercent?: number;
          memoryUsagePercent?: number;
          diskUsagePercent?: number;
          networkOnline?: boolean;
          topCpuProcesses?: ReadonlyArray<{ name: string; cpuPercent: number }>;
        } | null;

        if (healthSnap) {
          if (healthSnap.cpuUsagePercent != null && healthSnap.cpuUsagePercent > 85) {
            const topProc = healthSnap.topCpuProcesses?.[0];
            const detail = topProc ? ` (${topProc.name} at ${topProc.cpuPercent}%)` : "";
            this.addSuggestion("cpu_high", "warning", `CPU at ${healthSnap.cpuUsagePercent}%${detail} — may slow down`, "high");
            this.lastSystemHealthSuggestion = now;
          }
          if (healthSnap.memoryUsagePercent != null && healthSnap.memoryUsagePercent > 85) {
            this.addSuggestion("memory_high", "warning", `Memory at ${healthSnap.memoryUsagePercent}% — consider closing heavy apps`, "high");
            this.lastSystemHealthSuggestion = now;
          }
          if (healthSnap.diskUsagePercent != null && healthSnap.diskUsagePercent > 90) {
            this.addSuggestion("disk_high", "warning", `Disk at ${healthSnap.diskUsagePercent}% — running low on space`, "high");
            this.lastSystemHealthSuggestion = now;
          }
          if (healthSnap.networkOnline === false) {
            this.addSuggestion("network_offline", "warning", "Network is offline — check your connection", "high");
            this.lastSystemHealthSuggestion = now;
          }

          // Health trends — detect rising CPU/memory over time
          if (healthSnap.cpuUsagePercent != null) {
            this.cpuHistory.push(healthSnap.cpuUsagePercent);
            if (this.cpuHistory.length > 12) this.cpuHistory.shift(); // Keep last ~2min
          }
          if (healthSnap.memoryUsagePercent != null) {
            this.memoryHistory.push(healthSnap.memoryUsagePercent);
            if (this.memoryHistory.length > 12) this.memoryHistory.shift();
          }

          // Detect sustained high CPU (6+ consecutive readings > 70%)
          if (this.cpuHistory.length >= 6) {
            const recent = this.cpuHistory.slice(-6);
            const allHigh = recent.every((v) => v > 70);
            if (allHigh) {
              this.addSuggestion("cpu_sustained", "warning", `CPU has been >70% for over a minute — consider closing heavy apps`, "medium");
              this.cpuHistory = []; // Reset to avoid repeat
            }
          }

          // Detect rising memory trend (3 consecutive increases ending > 80%)
          if (this.memoryHistory.length >= 3) {
            const last3 = this.memoryHistory.slice(-3);
            if (last3[0]! < last3[1]! && last3[1]! < last3[2]! && last3[2]! > 80) {
              this.addSuggestion("memory_rising", "warning", `Memory trending up (${last3[0]}% → ${last3[1]}% → ${last3[2]}%) — may need attention`, "medium");
              this.memoryHistory = [];
            }
          }
        }
      }

      // ── 2. Battery ──────────────────────────────────────────────
      const batterySnap = await this.sensors.get("battery")?.snapshot() as { level?: number; isCharging?: boolean } | null;
      if (batterySnap?.level != null && batterySnap.level < 20 && !batterySnap.isCharging) {
        this.addSuggestion("battery_low", "warning", `Battery is low at ${batterySnap.level}% — consider plugging in`, "high");
      }

      // ── 3. Window Tracking ──────────────────────────────────────
      const windowInfo = this.windowTracker.poll();
      if (windowInfo) {
        const app = windowInfo.app;
        const title = windowInfo.title;
        const count = (this.appVisitCount.get(app) ?? 0) + 1;
        this.appVisitCount.set(app, count);

        const isIDE =
          app.includes("code") || app.includes("vscode") || app.includes("visual studio") ||
          app.includes("idea") || app.includes("intellij") || app.includes("pycharm") ||
          app.includes("webstorm") || app.includes("zed") || app.includes("cursor") || app.includes("helix");

        if (isIDE && this.lastScreenAppForSuggestions !== app) {
          const parts = title.split(" — ");
          const projectName = parts.length > 1 && parts[parts.length - 1] != null ? parts[parts.length - 1]!.trim() : null;
          if (projectName) {
            this.addSuggestion("ide_project", "info", `Working on "${projectName}" — need help with code, debugging, or git?`, "low");
          } else {
            this.addSuggestion("ide_help", "info", "IDE is open — need help with code, debugging, or git?", "low");
          }
        }

        const browserCtx = this.browserContext.detectFromWindowTitle(title, app);
        if (browserCtx && this.lastScreenAppForSuggestions !== app) {
          if (browserCtx.isGitHub) {
            const subtype = browserCtx.isPRPage ? "PR" : browserCtx.isIssuePage ? "issue" : browserCtx.isCodeReview ? "code review" : "repo";
            this.addSuggestion("github", "info", `Browsing GitHub ${subtype} — need help?`, "low");
          }
          if (browserCtx.isStackOverflow) this.addSuggestion("stackoverflow", "info", "Looking at Stack Overflow — want me to help solve this?", "low");
          if (browserCtx.isDocs) this.addSuggestion("docs", "info", "Reading documentation — want me to summarize or explain this?", "low");
          if (browserCtx.isAIChat) this.addSuggestion("ai_chat", "info", "Using AI chat — want me to help with something else?", "low");
          if (browserCtx.isSearchEngine) this.addSuggestion("search", "info", "Searching the web — want me to look that up for you?", "low");
        }

        const isTerminal = app.includes("kitty") || app.includes("alacritty") || app.includes("wezterm") ||
          app.includes("foot") || app.includes("ghostty") || app.includes("konsole") ||
          app.includes("gnome-terminal") || app.includes("windows terminal") || app.includes("cmd") ||
          app.includes("powershell") || app.includes("wt");

        if (isTerminal && this.lastScreenAppForSuggestions !== app) {
          this.addSuggestion("terminal_help", "info", "Terminal open — need help running commands or monitoring processes?", "low");
        }

        if (count === 10) {
          this.addSuggestion("app_pattern", "info", `You've been using ${windowInfo.className} a lot — want me to set up automation?`, "low");
        }
        this.lastScreenAppForSuggestions = app;
      }

      // ── 4. Coding Session ───────────────────────────────────────
      const fsSnap = await this.sensors.get("filesystem")?.snapshot() as { recentChanges?: ReadonlyArray<{ path: string }> } | null;
      if (fsSnap?.recentChanges) {
        for (const change of fsSnap.recentChanges.slice(-3)) {
          if (change.path) this.codingSession.recordFileChange(change.path);
        }
      }
      const codingState = this.codingSession.tick();
      if (codingState.shouldSuggestBreak && codingState.breakReason && now - this.lastCodingSessionSuggestion > 600_000) {
        this.addSuggestion("coding_break", "info", codingState.breakReason, "medium");
        this.lastCodingSessionSuggestion = now;
      }

      // ── 5. Git Status ───────────────────────────────────────────
      const gitSnap = await this.sensors.get("git")?.snapshot() as {
        branch?: string; isDirty?: boolean; stagedCount?: number;
        ahead?: number; behind?: number; merging?: boolean; rebasing?: boolean;
      } | null;
      if (gitSnap) {
        if (gitSnap.isDirty && gitSnap.branch) this.addSuggestion("git_dirty", "info", `Git branch "${gitSnap.branch}" has uncommitted changes`, "medium");
        if (gitSnap.merging) this.addSuggestion("git_merge", "info", "You're in a merge — need help resolving conflicts?", "high");
        if (gitSnap.rebasing) this.addSuggestion("git_rebase", "info", "You're in a rebase — need help resolving conflicts?", "high");
        if (gitSnap.ahead != null && gitSnap.ahead > 3) this.addSuggestion("git_ahead", "info", `You're ${gitSnap.ahead} commits ahead of remote — consider pushing`, "low");
        if (gitSnap.behind != null && gitSnap.behind > 3) this.addSuggestion("git_behind", "info", `You're ${gitSnap.behind} commits behind remote — consider pulling`, "low");
      }

      // ── 6. Filesystem Changes ───────────────────────────────────
      if (fsSnap?.recentChanges && fsSnap.recentChanges.length > 15) {
        this.addSuggestion("fs_many_changes", "info", `${fsSnap.recentChanges.length} recent file changes — consider committing`, "medium");
      }

      // ══════════════════════════════════════════════════════════════
      // TIER 2: DEEPER AWARENESS
      // ══════════════════════════════════════════════════════════════

      // ── 7. Audio Awareness ──────────────────────────────────────
      if (now - this.lastAudioSuggestion > 300_000) {
        const audioSnap = await this.sensors.get("audio")?.snapshot() as {
          outputVolume?: number; inputVolume?: number; isMuted?: boolean;
          activeSink?: string | null; activeSource?: string | null;
        } | null;
        if (audioSnap) {
          if (audioSnap.isMuted) {
            this.addSuggestion("audio_muted", "info", "Audio is muted — might miss notifications or calls", "low");
            this.lastAudioSuggestion = now;
          }
          if (audioSnap.outputVolume != null && audioSnap.outputVolume > 85) {
            this.addSuggestion("volume_high", "info", `Volume is at ${audioSnap.outputVolume}% — hearing damage risk at sustained levels`, "low");
            this.lastAudioSuggestion = now;
          }
          if (audioSnap.inputVolume != null && audioSnap.inputVolume > 80) {
            this.addSuggestion("mic_sensitivity", "info", `Mic input at ${audioSnap.inputVolume}% — might pick up background noise`, "low");
            this.lastAudioSuggestion = now;
          }
        }
      }

      // ── 8. Spotify / Flow State ─────────────────────────────────
      if (now - this.lastSpotifySuggestion > 600_000) {
        const spotifySnap = await this.sensors.get("spotify")?.snapshot() as {
          isPlaying?: boolean; track?: string | null; artist?: string | null;
        } | null;
        if (spotifySnap?.isPlaying && spotifySnap.track) {
          const windowState = this.windowTracker.getState();
          if (windowState.isCoding) {
            this.addSuggestion("flow_state", "info", `Music playing (${spotifySnap.track} by ${spotifySnap.artist}) + coding = flow state — I'll stay quiet`, "low");
            this.lastSpotifySuggestion = now;
          }
        }
      }

      // ── 9. Docker Crash Detection ───────────────────────────────
      if (now - this.lastDockerSuggestion > 120_000) {
        const dockerSnap = await this.sensors.get("docker")?.snapshot() as {
          recentEvents?: ReadonlyArray<{ type: string; containerName: string; image: string; timestamp: number }>;
          stoppedCount?: number;
        } | null;
        if (dockerSnap?.recentEvents) {
          const dieEvents = dockerSnap.recentEvents.filter((e) => e.type === "die" || e.type === "restart");
          for (const evt of dieEvents.slice(0, 2)) {
            this.addSuggestion("docker_die", "warning", `Docker container "${evt.containerName}" (${evt.image}) ${evt.type === "die" ? "died" : "restarted"} — want me to check logs?`, "high");
            this.lastDockerSuggestion = now;
          }
          if (dockerSnap.stoppedCount != null && dockerSnap.stoppedCount > 3) {
            this.addSuggestion("docker_stopped", "info", `${dockerSnap.stoppedCount} containers stopped — want me to investigate?`, "medium");
            this.lastDockerSuggestion = now;
          }
        }
      }

      // ── 10. Kubernetes Failure Detection ─────────────────────────
      if (now - this.lastK8sSuggestion > 120_000) {
        const k8sSnap = await this.sensors.get("kubernetes")?.snapshot() as {
          failedCount?: number; pendingCount?: number;
          recentEvents?: ReadonlyArray<{ type: string; podName: string }>;
          pods?: ReadonlyArray<{ name: string; status: string; restarts: number }>;
        } | null;
        if (k8sSnap) {
          if (k8sSnap.failedCount != null && k8sSnap.failedCount > 0) {
            this.addSuggestion("k8s_failed", "warning", `${k8sSnap.failedCount} pod(s) in Failed state — want me to investigate?`, "high");
            this.lastK8sSuggestion = now;
          }
          if (k8sSnap.pendingCount != null && k8sSnap.pendingCount > 0) {
            this.addSuggestion("k8s_pending", "info", `${k8sSnap.pendingCount} pod(s) pending — might be resource pressure`, "medium");
            this.lastK8sSuggestion = now;
          }
          // Detect crash-looping pods (restarts > 5)
          const crashLoop = k8sSnap.pods?.filter((p) => p.restarts > 5) ?? [];
          for (const pod of crashLoop.slice(0, 2)) {
            this.addSuggestion("k8s_crashloop", "warning", `Pod "${pod.name}" has ${pod.restarts} restarts — likely crash-looping`, "high");
            this.lastK8sSuggestion = now;
          }
        }
      }

      // ── 11. SSH Session Tracking ─────────────────────────────────
      if (now - this.lastSSHSessionSuggestion > 300_000) {
        const sshSnap = await this.sensors.get("ssh")?.snapshot() as {
          activeSessions?: ReadonlyArray<{ pid: number; user: string; host: string; connectedAt: number }>;
          sessionCount?: number;
        } | null;
        if (sshSnap?.activeSessions && sshSnap.activeSessions.length > 0) {
          // Check for stale sessions (> 1 hour)
          const staleThreshold = now - 3600_000;
          const staleSessions = sshSnap.activeSessions.filter((s) => s.connectedAt < staleThreshold);
          if (staleSessions.length > 0) {
            const hosts = staleSessions.map((s) => s.host).join(", ");
            this.addSuggestion("ssh_stale", "info", `SSH session(s) to ${hosts} open for >1 hour — want me to check status?`, "low");
            this.lastSSHSessionSuggestion = now;
          } else if (sshSnap.sessionCount != null && sshSnap.sessionCount > 0) {
            this.addSuggestion("ssh_active", "info", `${sshSnap.sessionCount} active SSH session(s) — need help with remote work?`, "low");
            this.lastSSHSessionSuggestion = now;
          }
        }
      }

      // ── 12. Clipboard Content Analysis ──────────────────────────
      if (now - this.lastClipboardAnalysisSuggestion > 300_000) {
        const clipSnap = await this.sensors.get("clipboard")?.snapshot() as { text?: string; length?: number } | null;
        if (clipSnap?.text && clipSnap.length != null && clipSnap.length > 10) {
          const text = clipSnap.text;

          // Detect error messages
          if (/(error|exception|traceback|panic|fatal|segfault)/i.test(text)) {
            this.addSuggestion("clip_error", "info", "Clipboard contains an error message — want me to help debug?", "medium");
            this.lastClipboardAnalysisSuggestion = now;
          }
          // Detect URLs
          else if (/^https?:\/\//.test(text.trim())) {
            this.addSuggestion("clip_url", "info", "Clipboard contains a URL — want me to open or analyze it?", "low");
            this.lastClipboardAnalysisSuggestion = now;
          }
          // Detect JSON/config
          else if ((text.trim().startsWith("{") && text.trim().endsWith("}")) || (text.trim().startsWith("[") && text.trim().endsWith("]"))) {
            this.addSuggestion("clip_json", "info", "Clipboard contains JSON — want me to validate or format it?", "low");
            this.lastClipboardAnalysisSuggestion = now;
          }
          // Detect IP addresses or connection strings
          else if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(text) || /@.*:\d+/.test(text)) {
            this.addSuggestion("clip_connection", "info", "Clipboard contains a connection string or IP — need help with networking?", "low");
            this.lastClipboardAnalysisSuggestion = now;
          }
        }
      }

      // ── 13. Notification Urgency Routing ─────────────────────────
      if (now - this.lastNotificationSuggestion > 60_000) {
        const notifSnap = await this.sensors.get("notifications")?.snapshot() as {
          recentNotifications?: ReadonlyArray<{ app: string; summary: string; body: string; urgency: "low" | "normal" | "critical" }>;
        } | null;
        if (notifSnap?.recentNotifications) {
          for (const notif of notifSnap.recentNotifications.slice(0, 3)) {
            // Critical urgency
            if (notif.urgency === "critical") {
              this.addSuggestion("notif_critical", "warning", `Critical notification from ${notif.app}: "${notif.summary}"`, "high");
              this.lastNotificationSuggestion = now;
            }
            // Error/failure keywords (regardless of urgency)
            else {
              const text = `${notif.summary} ${notif.body}`.toLowerCase();
              if (/(error|fail|crash|timeout|denied|unauthorized)/i.test(text)) {
                this.addSuggestion("notif_error", "warning", `Notification from ${notif.app}: "${notif.summary}" — want me to help?`, "medium");
                this.lastNotificationSuggestion = now;
              }
            }
          }
        }
      }

      // ── 14. Idle Detection ───────────────────────────────────────
      const idleSnap = await this.sensors.get("idle")?.snapshot() as { isIdle?: boolean; idleSeconds?: number } | null;
      if (idleSnap?.isIdle && idleSnap.idleSeconds && idleSnap.idleSeconds > 600) {
        const mins = Math.round(idleSnap.idleSeconds / 60);
        this.addSuggestion("idle_long", "info", `Idle for ${mins} minutes — want me to pause background tasks?`, "low");
      }

      // ── 15. Context Switching Detection ──────────────────────────
      const windowState = this.windowTracker.getState();
      if (windowState.switchesLast5Min > 15) {
        this.addSuggestion("context_switching", "info", "You've switched apps 15+ times in 5 minutes — want me to focus mode?", "low");
      }

      // ══════════════════════════════════════════════════════════════
      // TIER 3: INTELLIGENCE
      // ══════════════════════════════════════════════════════════════

      // ── 16. Cross-Sensor Correlation (every 30s) ────────────────
      if (now - this.lastCorrelationCheck > 30_000) {
        this.lastCorrelationCheck = now;
        try {
          const allSnapshots: Record<string, unknown> = {};
          for (const sid of ["git", "docker", "kubernetes", "system-health", "spotify", "audio", "battery", "clipboard", "ssh", "idle", "notifications"] as const) {
            const snap = await this.sensors.get(sid)?.snapshot();
            if (snap) allSnapshots[sid] = snap;
          }
          const windowInf = this.windowTracker.poll();
          const wState = this.windowTracker.getState();
          if (wState.current) {
            allSnapshots.window = { app: wState.current.className, title: wState.current.title, isCoding: wState.isCoding };
          }
          const browserCtx = this.browserContext.getLastContext();
          if (browserCtx) {
            allSnapshots.browser = browserCtx;
          }

          const correlations = this.sensorCorrelator.analyze(allSnapshots);
          for (const corr of correlations) {
            // Check dismissal suppression
            if (!this.dismissalTracker.shouldSuppress(corr.id)) {
              this.addSuggestion(corr.id, corr.type, `${corr.insight} — ${corr.suggestedAction}`, corr.priority);
            }
          }
        } catch {
          // Best-effort
        }
      }

      // ── 17. Time-Aware Suggestions (every 5 minutes) ────────────
      if (now - this.lastTimeAwareCheck > 300_000) {
        this.lastTimeAwareCheck = now;
        try {
          const gitSnap2 = await this.sensors.get("git")?.snapshot() as { isDirty?: boolean } | null;
          const healthSnap2 = await this.sensors.get("system-health")?.snapshot() as { cpuUsagePercent?: number } | null;
          const codingState2 = this.codingSession.tick();
          const goals2 = this.goalManager.getAll().filter((g) => g.status === "active" || g.status === "in_progress");
          const now2 = new Date();
          const isWeekend = now2.getDay() === 0 || now2.getDay() === 6;

          const timeSuggestions = this.timeAwareEngine.suggest({
            activeGoals: goals2.length,
            pendingTasks: 0, // Could wire to reminders count
            gitDirty: gitSnap2?.isDirty === true,
            cpuHigh: (healthSnap2?.cpuUsagePercent ?? 0) > 70,
            codingSessionMinutes: codingState2.currentSession
              ? Math.round(codingState2.currentSession.durationMs / 60_000)
              : 0,
            isWeekend,
          });

          for (const ts of timeSuggestions) {
            if (!this.dismissalTracker.shouldSuppress(ts.id)) {
              this.addSuggestion(ts.id, ts.type, ts.message, ts.priority);
            }
          }
        } catch {
          // Best-effort
        }
      }

      // ══════════════════════════════════════════════════════════════
      // TIER 4: AUTOMATION
      // ══════════════════════════════════════════════════════════════

      // ── 18. Workflow Automation (every 2 minutes) ───────────────
      if (now - this.lastAutomationCheck > 120_000) {
        this.lastAutomationCheck = now;
        try {
          const automationActions = this.workflowAutomation.analyze();
          for (const action of automationActions) {
            if (!this.dismissalTracker.shouldSuppress(action.id)) {
              this.addSuggestion(action.id, action.type, `${action.title} — ${action.description}`, action.priority);
            }
          }
        } catch {
          // Best-effort
        }
      }
    } catch {
      // Best-effort
    }
  }

  private addSuggestion(id: string, type: string, message: string, priority: string): void {
    // Check dismissal suppression (Tier 3)
    if (this.dismissalTracker.shouldSuppress(id)) return;

    // Deduplicate — don't add the same suggestion within 5 minutes
    const recent = this.proactiveSuggestions.find(
      (s) => s.id === id && Date.now() - s.timestamp < 300000,
    );
    if (recent) return;

    this.proactiveSuggestions.push({ id, type, message, timestamp: Date.now(), priority });
    // Keep only last 20 suggestions
    if (this.proactiveSuggestions.length > 20) {
      this.proactiveSuggestions = this.proactiveSuggestions.slice(-20);
    }

    // For high-priority suggestions, also emit a proactive message
    // that can be spoken and shown in the conversation thread
    if (priority === "high" || type === "warning") {
      this.emitProactiveMessage({
        content: message,
        type: type === "warning" ? "alert" : "suggestion",
        priority: priority as "low" | "medium" | "high",
        actionLabel: "Help me with this",
        actionPayload: message,
      });
    }
  }

  // ─── Proactive Messaging ────────────────────────────────────────

  /**
   * Emit a proactive message that can be spoken and shown in conversation.
   * This is how the runtime "speaks" to the user without user interaction.
   */
  emitProactiveMessage(opts: {
    content: string;
    type?: "suggestion" | "alert" | "info";
    priority?: "low" | "medium" | "high";
    actionLabel?: string;
    actionPayload?: string;
  }): void {
    const now = Date.now();
    const msgType: "suggestion" | "alert" | "info" = opts.type ?? "info";
    const msgPriority: "low" | "medium" | "high" = opts.priority ?? "medium";
    const msg: {
      id: string;
      content: string;
      type: "suggestion" | "alert" | "info";
      priority: "low" | "medium" | "high";
      timestamp: number;
      spoken: boolean;
      actionLabel?: string;
      actionPayload?: string;
    } = {
      id: `pm_${now}_${Math.random().toString(36).slice(2, 6)}`,
      content: opts.content,
      type: msgType,
      priority: msgPriority,
      timestamp: now,
      spoken: false,
    };
    if (opts.actionLabel != null) msg.actionLabel = opts.actionLabel;
    if (opts.actionPayload != null) msg.actionPayload = opts.actionPayload;

    this.proactiveMessages.push(msg);
    // Keep last 50
    if (this.proactiveMessages.length > 50) {
      this.proactiveMessages = this.proactiveMessages.slice(-50);
    }

    // Notify listeners (API server will forward via SSE)
    for (const listener of this.proactiveMessageListeners) {
      try {
        listener(JSON.stringify(msg));
      } catch {
        // Best-effort
      }
    }

    // Auto-speak high-priority messages (throttled: max once per 10s)
    if (
      (opts.priority === "high" || opts.type === "alert") &&
      now - this.lastProactiveSpeak > 10000
    ) {
      this.lastProactiveSpeak = now;
      msg.spoken = true;
      for (const listener of this.proactiveSpeakListeners) {
        try {
          listener(opts.content);
        } catch {
          // Best-effort
        }
      }
    }
  }

  /**
   * Register a listener for proactive messages (API server uses this).
   */
  onProactiveMessage(listener: (msgJson: string) => void): () => void {
    this.proactiveMessageListeners.push(listener);
    return () => {
      const idx = this.proactiveMessageListeners.indexOf(listener);
      if (idx >= 0) this.proactiveMessageListeners.splice(idx, 1);
    };
  }

  /**
   * Register a listener for proactive speech (API server uses this).
   */
  onProactiveSpeak(listener: (text: string) => void): () => void {
    this.proactiveSpeakListeners.push(listener);
    return () => {
      const idx = this.proactiveSpeakListeners.indexOf(listener);
      if (idx >= 0) this.proactiveSpeakListeners.splice(idx, 1);
    };
  }

  /**
   * Get proactive message history.
   */
  getProactiveMessages(limit: number = 20): ReadonlyArray<{
    id: string;
    content: string;
    type: string;
    priority: string;
    timestamp: number;
    spoken: boolean;
    actionLabel?: string;
    actionPayload?: string;
  }> {
    return this.proactiveMessages.slice(-limit);
  }

  /**
   * Record that a suggestion was dismissed by the user.
   * The dismissal tracker will learn to suppress similar suggestions.
   */
  recordSuggestionDismissal(suggestionId: string, message: string): void {
    this.dismissalTracker.recordDismissal(suggestionId, message);
  }

  /**
   * Get dismissal tracker stats.
   */
  getDismissalStats(): {
    readonly totalDismissals: number;
    readonly activeSuppressions: number;
    readonly suppressedPatterns: ReadonlyArray<string>;
  } {
    return this.dismissalTracker.getStats();
  }

  /**
   * Get recent cross-sensor correlations.
   */
  getCorrelations(limit = 10): ReadonlyArray<import("./sensor-correlator.js").Correlation> {
    return this.sensorCorrelator.getRecent(limit);
  }

  /**
   * Record a command execution for workflow automation pattern detection.
   */
  recordCommand(command: string, exitCode: number): void {
    this.workflowAutomation.recordCommand(command, exitCode);
  }

  /**
   * Record an error for auto-fix analysis.
   */
  recordError(error: string, context: string): void {
    this.workflowAutomation.recordError(error, context);
  }

  /**
   * Get recent automation actions.
   */
  getAutomationActions(limit = 10): ReadonlyArray<import("./workflow-automation.js").AutomationAction> {
    return this.workflowAutomation.getRecent(limit);
  }

  /**
   * Get detected workflow patterns.
   */
  getAutomationPatterns(): ReadonlyArray<import("./workflow-automation.js").WorkflowPattern> {
    return this.workflowAutomation.getPatterns();
  }

  // ─── Session Summaries ──────────────────────────────────────────

  getSessionSummaries(): ReadonlyArray<{ id: string; summary: string; timestamp: number }> {
    return this.sessionSummaries.getUnconsumed().map((s) => ({
      id: s.id,
      summary: s.summary,
      timestamp: s.timestamp,
    }));
  }

  pruneSessionSummaries(maxAgeMs: number): number {
    return this.sessionSummaries.prune(maxAgeMs);
  }

  /**
   * Trigger an auto-response: the runtime investigates a sensor event
   * and generates a proactive message with context.
   */
  async triggerAutoResponse(trigger: {
    source: string;
    event: string;
    context?: Record<string, unknown>;
  }): Promise<void> {
    const prompt = `A ${trigger.event} event occurred from ${trigger.source}. ${
      trigger.context ? `Context: ${JSON.stringify(trigger.context)}` : ""
    }. Investigate this and provide a brief, actionable assessment.`;

    try {
      const result = await this.process(prompt);
      this.emitProactiveMessage({
        content: result.text,
        type: "info",
        priority: "medium",
      });
    } catch {
      // Best-effort — don't let auto-response failures crash the system
    }
  }

  private async runTick(): Promise<void> {
    if (!this.running) return;

    const tickStart = Date.now();
    this.tickCount++;
    let observationsGathered = 0;

    try {
      // Gather observations from available sources
      observationsGathered = await this.gatherObservations();
    } catch {
      // Observation gathering is best-effort
    }

    // Generate proactive suggestions from sensor data
    try {
      await this.generateProactiveSuggestions();
    } catch {
      // Best-effort
    }

    // Run the 14-stage cognition pipeline
    let pipelineResult: CognitionResult | undefined;
    try {
      pipelineResult = await this.pipeline.runTick();
      this.lastPipelineDurationMs = pipelineResult.durationMs;
      this.lastPipelineResult = pipelineResult;

      // Extract thoughts from pipeline result for streaming
      for (const thought of pipelineResult.thoughts) {
        this.recentThoughts.push({
          type: thought.type,
          content: thought.content,
          confidence: thought.confidence.value,
          timestamp: thought.timestamp,
        });
      }
      if (this.recentThoughts.length > 50) {
        this.recentThoughts = this.recentThoughts.slice(-50);
      }

      // Extract selected action
      if (pipelineResult.selectedAction) {
        this.recentActions.push({
          type: pipelineResult.selectedAction.type,
          reasoning: pipelineResult.selectedAction.reasoning,
          confidence: pipelineResult.selectedAction.confidence,
          timestamp: Date.now(),
        });
        if (this.recentActions.length > 50) this.recentActions.shift();
      }
    } catch {
      // Pipeline errors are non-fatal
    }

    this.lastTickAt = Date.now();

    const event: TickEvent = {
      tickNumber: this.tickCount,
      timestamp: this.lastTickAt,
      observations: observationsGathered,
      cognitiveCycleRan: true,
      duration: Date.now() - tickStart,
      pipelineResult,
    };

    // Notify tick handlers
    for (const handler of this.tickHandlers) {
      try {
        handler(event);
      } catch {
        // Handler errors are non-fatal
      }
    }
  }

  private async gatherObservations(): Promise<number> {
    let count = 0;

    // Source 1: Screen activity (if xdotool/osascript available)
    const screenObs = this.gatherScreenObservation();
    if (screenObs) {
      this.attention.process(screenObs);
      count++;
    }

    // Source 2: System health (periodic, every 3rd tick to reduce noise)
    if (this.tickCount % 3 === 0) {
      const sysObs = this.gatherSystemObservation();
      if (sysObs) {
        this.attention.process(sysObs);
        count++;
      }
    }

    // Source 3: Timer heartbeat (keeps the system alive)
    this.attention.process({
      source: "timer",
      title: "cognition_tick",
      detail: `Tick #${this.tickCount}`,
    });
    count++;

    // Source 4: Cheap sensors every tick (idle, filesystem)
    const idleSensor =
      this.sensors.get<import("@ai-agent/sensors").IdleState>("idle");
    if (idleSensor) {
      try {
        const state = await idleSensor.snapshot();
        if (state) {
          this.attention.process({
            source: "system",
            title: state.isIdle ? `idle: ${state.idleSeconds}s` : "user_active",
            detail: `idle: ${state.isIdle}, seconds: ${state.idleSeconds}`,
          });
          count++;
        }
      } catch {
        /* best-effort */
      }
    }

    const fsSensor =
      this.sensors.get<import("@ai-agent/sensors").FileSystemState>(
        "filesystem",
      );
    if (fsSensor) {
      try {
        const state = await fsSensor.snapshot();
        if (state) {
          this.attention.process({
            source: "file",
            title: `files: ${state.recentChanges?.length ?? 0} changes`,
            detail: `watched: ${state.watchedPaths?.length ?? 0} paths, total: ${state.totalChanges ?? 0}`,
          });
          count++;
        }
      } catch {
        /* best-effort */
      }
    }

    // Source 4b: Window tracking (every tick — cheap on Hyprland)
    try {
      const windowInfo = this.windowTracker.poll();
      if (windowInfo) {
        this.attention.process({
          source: "screen",
          title: `focus: ${windowInfo.className}`,
          detail: `${windowInfo.title} (${windowInfo.app})`,
        });
        count++;
      }
    } catch {
      /* best-effort */
    }

    // Source 4c: System health (every tick — lightweight reads from /proc)
    if (this.tickCount % 3 === 0) {
      const healthSensor = this.sensors.get<import("@ai-agent/sensors").SystemHealthState>("system-health");
      if (healthSensor) {
        try {
          const state = await healthSensor.snapshot();
          if (state) {
            this.attention.process({
              source: "system",
              title: `health: cpu=${state.cpuUsagePercent}% mem=${state.memoryUsagePercent}%`,
              detail: `cpu: ${state.cpuUsagePercent}%, mem: ${state.memoryUsagePercent}%, disk: ${state.diskUsagePercent}%, net: ${state.networkOnline}`,
            });
            count++;
          }
        } catch {
          /* best-effort */
        }
      }
    }

    // Source 5: Heavier sensors every 5th tick (git, docker, battery, clipboard)
    if (this.tickCount % 5 === 0) {
      count += await this.gatherSensorObservations();
    }

    return count;
  }

  private async gatherSensorObservations(): Promise<number> {
    let count = 0;

    // Get git state
    const gitSensor =
      this.sensors.get<import("@ai-agent/sensors").GitState>("git");
    if (gitSensor) {
      try {
        const state = await gitSensor.snapshot();
        if (state) {
          this.attention.process({
            source: "git",
            title: `branch: ${state.branch}`,
            detail: `dirty: ${state.isDirty}, staged: ${state.stagedCount}, ahead: ${state.ahead}`,
          });
          count++;
        }
      } catch {
        /* best-effort */
      }
    }

    // Get Docker state
    const dockerSensor =
      this.sensors.get<import("@ai-agent/sensors").DockerState>("docker");
    if (dockerSensor) {
      try {
        const state = await dockerSensor.snapshot();
        if (state) {
          this.attention.process({
            source: "process",
            title: `docker: ${state.runningCount} running`,
            detail: `${state.totalContainers} total, ${state.stoppedCount} stopped`,
          });
          count++;
        }
      } catch {
        /* best-effort */
      }
    }

    // Get battery state
    const batterySensor =
      this.sensors.get<import("@ai-agent/sensors").BatteryState>("battery");
    if (batterySensor) {
      try {
        const state = await batterySensor.snapshot();
        if (state) {
          this.attention.process({
            source: "system",
            title: `battery: ${state.level}%`,
            detail: `charging: ${state.isCharging}, status: ${state.status}`,
          });
          count++;
        }
      } catch {
        /* best-effort */
      }
    }

    // Get clipboard state
    const clipSensor =
      this.sensors.get<import("@ai-agent/sensors").ClipboardState>("clipboard");
    if (clipSensor) {
      try {
        const state = await clipSensor.snapshot();
        if (state && state.text) {
          this.attention.process({
            source: "system",
            title: `clipboard: ${state.text.slice(0, 50)}`,
            detail: `length: ${state.text.length}`,
          });
          count++;
        }
      } catch {
        /* best-effort */
      }
    }

    return count;
  }

  private gatherScreenObservation(): {
    source: ObservationSource;
    title: string;
    detail: string;
  } | null {
    try {
      const platform = process.platform;
      let app = "";
      let title = "";

      if (platform === "linux") {
        // Try Hyprland first (Wayland)
        try {
          const hyprOutput = execSync("hyprctl activewindow -j 2>/dev/null", {
            encoding: "utf-8",
            timeout: 2000,
          }).trim();
          if (hyprOutput) {
            const data = JSON.parse(hyprOutput) as {
              title?: string;
              class?: string;
              address?: string;
            };
            app = data.class ?? "";
            title = data.title ?? "";
          }
        } catch {
          // Not on Hyprland, try xdotool (X11)
        }

        // Fallback to xdotool for X11
        if (!app) {
          try {
            const activeWindow = execSync(
              "xdotool getactivewindow getwindowname 2>/dev/null",
              { encoding: "utf-8", timeout: 2000 },
            ).trim();
            const parts = activeWindow.split(" — ");
            app = parts[0]?.trim() ?? activeWindow;
            title = parts.slice(1).join(" — ").trim();
          } catch {
            // xdotool not available
          }
        }

        // Fallback to wlr-randr or /proc for other Wayland
        if (!app) {
          try {
            const focused = execSync(
              "cat /proc/$(cat /sys/class/tty/tty0/active 2>/dev/null | cut -d' ' -f2)/comm 2>/dev/null || echo ''",
              { encoding: "utf-8", timeout: 1000 },
            ).trim();
            if (focused) app = focused;
          } catch {
            // ignore
          }
        }
      } else if (platform === "darwin") {
        const script = `tell application "System Events" to get {name of first application process whose frontmost is true, name of front window of first application process whose frontmost is true}`;
        const output = execSync(`osascript -e '${script}' 2>/dev/null`, {
          encoding: "utf-8",
          timeout: 2000,
        }).trim();
        const parts = output.split(", ");
        app = parts[0]?.trim() ?? "";
        title = parts.slice(1).join(", ").trim();
      }

      if (!app) return null;

      // Only emit if something changed (dedup)
      if (app === this.lastScreenApp && title === this.lastScreenTitle)
        return null;
      this.lastScreenApp = app;
      this.lastScreenTitle = title;

      return {
        source: "screen",
        title: `active_window: ${app}`,
        detail: title || app,
      };
    } catch {
      return null;
    }
  }

  private gatherSystemObservation(): {
    source: ObservationSource;
    title: string;
    detail: string;
  } | null {
    try {
      const loadavg = execSync(
        "cat /proc/loadavg 2>/dev/null || sysctl -n vm.loadavg 2>/dev/null",
        { encoding: "utf-8", timeout: 2000 },
      ).trim();
      const parts = loadavg.split(" ");
      const load1 = parseFloat(parts[0] ?? "0");
      const cpus = parseInt(
        execSync(
          "nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4",
          { encoding: "utf-8", timeout: 2000 },
        ).trim(),
        10,
      );
      const ratio = load1 / cpus;

      let detail = `load: ${load1} (${ratio.toFixed(2)}x ${cpus} cores)`;
      let title = "system_load_normal";

      if (ratio > 0.9) {
        title = "system_load_critical";
        detail += " [CRITICAL]";
      } else if (ratio > 0.7) {
        title = "system_load_high";
        detail += " [HIGH]";
      }

      return { source: "system", title, detail };
    } catch {
      return null;
    }
  }

  // ─── Default Agent Registration ────────────────────────────────────

  private registerDefaultAgents(): void {
    const defaults: Array<{
      name: string;
      description: string;
      role: "coder" | "researcher" | "reviewer" | "planner" | "designer" | "devops" | "writer" | "analyst";
      domain: string;
      capabilities: string[];
      systemPrompt: string;
    }> = [
      {
        name: "Backend Engineer",
        description: "Builds and maintains server-side logic, APIs, databases, and authentication systems.",
        role: "coder",
        domain: "backend",
        capabilities: ["api", "server", "database", "auth", "rest", "graphql", "orm", "migration", "endpoint", "middleware"],
        systemPrompt: "You are an expert backend engineer. Design and implement robust server-side systems, RESTful/GraphQL APIs, database schemas, authentication/authorization, middleware, and business logic. Use best practices for security, performance, and maintainability. Write clean, well-structured code with proper error handling.",
      },
      {
        name: "Frontend Engineer",
        description: "Builds user interfaces, components, styling, and client-side logic.",
        role: "coder",
        domain: "frontend",
        capabilities: ["ui", "component", "react", "vue", "css", "html", "style", "layout", "responsive", "animation"],
        systemPrompt: "You are an expert frontend engineer. Create modern, responsive, accessible user interfaces using HTML, CSS, and JavaScript frameworks. Focus on component architecture, state management, performance optimization, and pixel-perfect implementations. Follow UI/UX best practices.",
      },
      {
        name: "UI/UX Designer",
        description: "Designs user interfaces, wireframes, mockups, and user experience flows.",
        role: "designer",
        domain: "design",
        capabilities: ["design", "wireframe", "mockup", "ui", "ux", "layout", "color", "typography", "spacing", "prototype"],
        systemPrompt: "You are an expert UI/UX designer. Create intuitive, visually appealing, and accessible designs. Define color palettes, typography, spacing systems, component patterns, and user flows. Provide detailed design specifications including CSS values, dimensions, and layout instructions.",
      },
      {
        name: "DevOps Engineer",
        description: "Handles deployment, CI/CD, containerization, infrastructure, and monitoring.",
        role: "devops",
        domain: "devops",
        capabilities: ["deploy", "docker", "k8s", "ci", "cd", "pipeline", "container", "infra", "monitoring", "nginx", "aws", "cloud"],
        systemPrompt: "You are an expert DevOps engineer. Design and implement deployment pipelines, Docker configurations, Kubernetes manifests, CI/CD workflows, monitoring setups, and infrastructure-as-code. Focus on reliability, scalability, security, and automation. Write production-ready configurations.",
      },
      {
        name: "Documentation Writer",
        description: "Writes technical documentation, READMEs, API docs, and guides.",
        role: "writer",
        domain: "documentation",
        capabilities: ["doc", "readme", "documentation", "guide", "tutorial", "api doc", "changelog", "wiki", "comment"],
        systemPrompt: "You are an expert technical writer. Create clear, comprehensive documentation including READMEs, API references, tutorials, guides, and inline code comments. Use proper formatting, code examples, and structured explanations. Make complex topics accessible.",
      },
      {
        name: "Code Reviewer",
        description: "Reviews code for quality, security, performance, and best practices.",
        role: "reviewer",
        domain: "review",
        capabilities: ["review", "audit", "security", "performance", "lint", "refactor", "quality", "test coverage", "bug"],
        systemPrompt: "You are an expert code reviewer. Analyze code for bugs, security vulnerabilities, performance issues, and style violations. Provide specific, actionable feedback with code examples. Check for proper error handling, input validation, test coverage, and adherence to best practices.",
      },
      {
        name: "Research Analyst",
        description: "Researches topics, analyzes documentation, gathers information, and provides summaries.",
        role: "researcher",
        domain: "research",
        capabilities: ["research", "analyze", "investigate", "compare", "evaluate", "summarize", "report", "data", "metrics"],
        systemPrompt: "You are a thorough research analyst. Investigate topics deeply, analyze multiple sources, compare options, and provide comprehensive summaries. Structure findings clearly with evidence, pros/cons, and actionable recommendations. Be thorough but concise.",
      },
      {
        name: "Task Planner",
        description: "Decomposes complex goals into subtasks, plans execution order, and identifies dependencies.",
        role: "planner",
        domain: "planning",
        capabilities: ["plan", "decompose", "break down", "organize", "schedule", "prioritize", "dependency", "roadmap", "milestone"],
        systemPrompt: "You are a strategic task planner. Break down complex goals into clear, actionable subtasks. Identify dependencies, execution order, and potential risks. Create realistic timelines and milestones. Consider resource constraints and optimize for parallel execution where possible.",
      },
    ];

    for (const def of defaults) {
      // Don't re-register if already exists (from persistence)
      const existing = this.multiAgent.getAgents().find((a) => a.name === def.name);
      if (!existing) {
        const agent = AgentFactory.create(def, this.llmProvider);
        this.multiAgent.registerAgent(agent);
      }
    }
  }

  // ─── Agent Management ────────────────────────────────────────────

  getAgents(): ReadonlyArray<import("@ai-agent/multi-agent").SubAgent> {
    return this.multiAgent.getAgents();
  }

  getAgent(agentId: string): import("@ai-agent/multi-agent").SubAgent | null {
    return this.multiAgent.getAgent(agentId);
  }

  async createAgent(
    spec: import("@ai-agent/multi-agent").AgentSpec,
  ): Promise<import("@ai-agent/multi-agent").SubAgent> {
    return this.multiAgent.createAgentFromLLM(spec, this.llmProvider);
  }

  async generateAgentSpec(
    description: string,
  ): Promise<import("@ai-agent/multi-agent").AgentSpec> {
    return this.multiAgent.generateAgentSpec(
      description,
      this.multiAgent.getAgents(),
      this.llmProvider,
    );
  }

  updateAgent(
    agentId: string,
    updates: Partial<Pick<import("@ai-agent/multi-agent").SubAgent, "name" | "description" | "role" | "domain" | "systemPrompt" | "capabilities" | "status">>,
  ): import("@ai-agent/multi-agent").SubAgent | null {
    return this.multiAgent.updateAgent(agentId, updates);
  }

  toggleAgent(agentId: string): import("@ai-agent/multi-agent").SubAgent | null {
    return this.multiAgent.toggleAgent(agentId);
  }

  deleteAgent(agentId: string): boolean {
    return this.multiAgent.unregisterAgent(agentId);
  }

  async orchestrate(goal: string): Promise<string> {
    return this.multiAgent.orchestrate(goal, this.llmProvider);
  }

  async generateBootBriefing(): Promise<BootBriefing> {
    // Gather context from sensors and systems
    const goals = this.goalManager
      .getAll()
      .filter((g) => g.status === "active" || g.status === "in_progress")
      .map((g) => ({
        name: g.title,
        progress: g.progress,
        status: g.status,
      }));

    const recentActivity: string[] = [];
    for (const event of this.recentSensorEvents.slice(0, 5)) {
      recentActivity.push(`[${event.sensorId}] ${event.type}`);
    }
    for (const thought of this.recentThoughts.slice(-3)) {
      recentActivity.push(`Thought: ${thought.content.slice(0, 80)}`);
    }

    const oneDayMs = 24 * 60 * 60 * 1000;
    const episodicResult = this.memory.query({
      types: ["episodic"],
      maxAge: oneDayMs,
      sortBy: "recency",
      limit: 10,
    });
    const reflectionResult = this.memory.query({
      types: ["reflection"],
      maxAge: oneDayMs,
      sortBy: "recency",
      limit: 5,
    });

    const episodicMemories = episodicResult.memories.map(
      (m) => m.content || "",
    );
    const reflections = reflectionResult.memories.map((m) => m.content || "") as string[];

    // Sensor snapshots
    let batteryLevel: number | null = null;
    let batteryCharging = false;
    let gitBranch = "";
    let gitDirty = false;
    let cpuUsage = 0;
    let memoryUsage = 0;

    try {
      const batterySnap = await this.sensors.get("battery")?.snapshot();
      if (batterySnap) {
        const b = batterySnap as { level?: number; isCharging?: boolean };
        batteryLevel = b.level ?? null;
        batteryCharging = b.isCharging ?? false;
      }
    } catch {}

    try {
      const gitSnap = await this.sensors.get("git")?.snapshot();
      if (gitSnap) {
        const g = gitSnap as { branch?: string; dirty?: boolean };
        gitBranch = g.branch ?? "";
        gitDirty = g.dirty ?? false;
      }
    } catch {}

    try {
      const healthSnap = await this.sensors.get("system-health")?.snapshot();
      if (healthSnap) {
        const h = healthSnap as { cpuUsagePercent?: number; memoryUsagePercent?: number };
        cpuUsage = h.cpuUsagePercent ?? 0;
        memoryUsage = h.memoryUsagePercent ?? 0;
      }
    } catch {}

    const uptimeMs = Date.now() - this.startTime;
    const memoryCount = this.memory.getStats().totalMemories;

    // Unconsumed session summaries from previous conversations
    const unconsumedSummaries = this.sessionSummaries.getUnconsumed();
    const sessionSummaryTexts = unconsumedSummaries.map((s) => s.summary);

    const briefing = await this.bootBriefing.generate(
      {
        activeGoals: goals,
        recentActivity,
        reflections,
        episodicMemories,
        sessionSummaries: sessionSummaryTexts,
        batteryLevel,
        batteryCharging,
        gitBranch,
        gitDirty,
        cpuUsage,
        memoryUsage,
        uptimeMs,
        memoryCount,
      },
      this.llmProvider,
    );

    // Mark summaries as consumed after successful briefing
    if (unconsumedSummaries.length > 0) {
      this.sessionSummaries.markAllConsumed();
    }

    return briefing;
  }

  // ─── Core Processing ─────────────────────────────────────────────

  async process(input: string): Promise<FluxRuntimeResult> {
    const start = Date.now();
    this.totalInteractions++;

    // Step 1: Record user message in memory
    await this.session.memory.add("user", input);

    // Step 2: Record in history
    this.history.push({ role: "user", content: input, timestamp: Date.now() });

    // Step 3: Feed to cognitive system
    this.cognitive.message(input);

    // Step 4: Process through service orchestrator (intent classification + routing)
    const getSystemContext = async () => {
      const sensorSnapshots: Record<string, unknown> = {};
      for (const sensorId of [
        "git",
        "docker",
        "battery",
        "idle",
        "clipboard",
        "spotify",
        "audio",
        "notifications",
        "screen",
        "filesystem",
        "system-health",
      ] as const) {
        try {
          const sensor = this.sensors.get(sensorId);
          if (sensor) {
            const snap = await sensor.snapshot();
            if (snap) sensorSnapshots[sensorId] = snap;
          }
        } catch {}
      }

      const batterySnap = sensorSnapshots.battery as
        | { level?: number; isCharging?: boolean; timeToEmpty?: number | null; timeToFull?: number | null; status?: string }
        | undefined;
      const healthSnap = sensorSnapshots["system-health"] as
        | { cpuUsagePercent?: number; memoryUsagePercent?: number; diskUsagePercent?: number; networkOnline?: boolean }
        | undefined;
      const recentActivity: string[] = [];
      for (const event of this.recentSensorEvents.slice(0, 5)) {
        recentActivity.push(`[${event.sensorId}] ${event.type}`);
      }
      for (const thought of this.recentThoughts.slice(-3)) {
        recentActivity.push(`Thought: ${thought.content.slice(0, 80)}`);
      }

      const goals = this.goalManager
        .getAll()
        .filter((g) => g.status === "active" || g.status === "in_progress")
        .map((g) => ({
          name: g.title,
          progress: g.progress,
          status: g.status as string,
        }));

      // Window tracking context
      const windowState = this.windowTracker.getState();
      const codingState = this.codingSession.tick();
      const browserCtx = this.browserContext.getLastContext();

      const sysResult: Record<string, unknown> = {
        battery: batterySnap
          ? {
              level: batterySnap.level ?? 0,
              charging: batterySnap.isCharging ?? false,
              ...(batterySnap.timeToEmpty != null
                ? { timeRemaining: batterySnap.timeToEmpty }
                : batterySnap.timeToFull != null
                  ? { timeRemaining: batterySnap.timeToFull }
                  : {}),
            }
          : null,
        systemHealth: healthSnap
          ? {
              cpu: healthSnap.cpuUsagePercent ?? 0,
              memory: healthSnap.memoryUsagePercent ?? 0,
              disk: healthSnap.diskUsagePercent ?? 0,
              network: healthSnap.networkOnline ?? true,
            }
          : null,
        activeWindow: windowState.current
          ? {
              app: windowState.current.className,
              title: windowState.current.title,
              isCoding: windowState.isCoding,
              isBrowsing: windowState.isBrowsing,
              isTerminal: windowState.isTerminal,
              focusTimeMs: windowState.focusTimeMs,
            }
          : null,
        browserContext: browserCtx
          ? {
              site: browserCtx.site,
              isGitHub: browserCtx.isGitHub,
              isStackOverflow: browserCtx.isStackOverflow,
              isDocs: browserCtx.isDocs,
              isSearchEngine: browserCtx.isSearchEngine,
              isAIChat: browserCtx.isAIChat,
            }
          : null,
        codingSession: codingState.currentSession
          ? {
              durationMs: codingState.currentSession.durationMs,
              filesChanged: codingState.currentSession.filesChanged,
              languages: codingState.currentSession.languages,
              projects: codingState.currentSession.projects,
              shouldSuggestBreak: codingState.shouldSuggestBreak,
            }
          : null,
        sensors: sensorSnapshots,
        goals,
        recentActivity,
        memoryStats: { totalMemories: this.memory.getStats().totalMemories },
        currentTime: new Date().toLocaleString(),
        platform: process.platform,
      };

      // Enrich with knowledge base search results for the current query
      try {
        const kbResults = this.knowledgeBase.search(input, 3);
        if (kbResults.length > 0) {
          sysResult.knowledgeBase = kbResults.map((r) => ({
            file: r.filePath,
            snippet: r.content.slice(0, 200),
          }));
        }
      } catch {
        // Knowledge base unavailable
      }

      // Enrich with multi-agent status
      try {
        const agents = this.multiAgent.getAgents();
        sysResult.agents = {
          count: agents.length,
          domains: agents.map((a) => a.domain),
        };
      } catch {
        // Multi-agent unavailable
      }

      // Enrich with cross-device sync status
      try {
        const syncStatus = this.crossDevice.getStatus();
        sysResult.crossDevice = {
          enabled: syncStatus.enabled,
          sharedDir: syncStatus.sharedDir,
          lastPush: syncStatus.lastPush,
          lastPull: syncStatus.lastPull,
        };
      } catch {
        // Cross-device unavailable
      }

      return sysResult as unknown as SystemContext;
    };

    const result = await this.orchestrator.process(input, {
      sessionId: this.session.id,
      memory: this.session.memory,
      provider: this.llmProvider,
      reply: () => {},
      speak: () => {},
      emit: () => {},
      getSystemContext,
      multiAgent: this.multiAgent,
    });

    const responseText = result.text;
    const duration = Date.now() - start;

    // Step 5: Record assistant response in memory
    await this.session.memory.add("assistant", responseText);

    // Step 6: Record in history
    this.history.push({
      role: "assistant",
      content: responseText,
      timestamp: Date.now(),
    });

    // Step 7: Update working memory
    this.workingMemory.add({
      type: "observation",
      content: `User: ${input}`,
      weight: 0.7,
      source: "user",
    });

    this.workingMemory.add({
      type: "observation",
      content: `Assistant: ${responseText}`,
      weight: 0.6,
      source: "assistant",
    });

    // Step 8: Record experience for self-evolution
    this.experienceDb.record({
      situation: input.slice(0, 200),
      decision: "service_routing",
      outcome: responseText.length > 0 ? "success" : "failure",
      confidence: 0.8,
      actualResult: { responseLength: responseText.length },
      userFeedback: null,
      successScore: responseText.length > 0 ? 0.8 : 0.2,
      recommendation: "",
      strategyUsed: null,
      duration,
      cost: 0,
      tags: ["chat", "runtime"],
      context: { inputLength: input.length },
    });

    // Step 9: Record habit
    this.habits.observe(
      "communication",
      `User message: ${input.slice(0, 50)}`,
      input.slice(0, 30),
    );

    // Step 10: Track confidence
    this.confidenceCalibration.record(
      "chat_response",
      0.8,
      responseText.length > 0,
    );

    // Step 11: Generate a thought about this interaction
    this.thoughtGraph.addNode({
      type: "observation_interpretation",
      content: `User said: ${input.slice(0, 100)}`,
      reasoning: "Direct user message",
      confidence: {
        value: 1.0,
        reason: "Direct observation",
        timestamp: Date.now(),
      },
      evidence: [],
      counterarguments: [],
      relatedThoughtIds: [],
      observationIds: [],
      goalId: null,
      expiresAt: Date.now() + 86400000, // 24 hours
      metadata: { role: "user" },
    });

    // Step 12: Store episodic memory of this interaction
    this.memory.storeEpisodic({
      type: "episodic",
      category: "interaction",
      event: `User asked: ${input.slice(0, 150)}`,
      context: `Assistant replied: ${responseText.slice(0, 200)}`,
      participants: ["user", "assistant"],
      location: null,
      duration,
      outcome: responseText.length > 0 ? "responded" : "no response",
      emotionalValence: responseText.length > 0 ? 0.5 : -0.2,
      content: `Q: ${input.slice(0, 200)}\nA: ${responseText.slice(0, 300)}`,
      strength: 0.8,
      confidence: 0.9,
      source: "chat",
      tags: ["chat", "conversation"],
      relatedIds: [],
      relatedEpisodeIds: [],
    });

    // Step 13: Session summarisation — generate a summary every 5 user messages
    this.userMessageCount++;
    if (this.userMessageCount % 5 === 0) {
      try {
        const recentHistory = this.history.slice(-10);
        const transcript = recentHistory
          .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 200)}`)
          .join("\n");

        let summaryText: string;
        if (this.llmProvider) {
          const llmResult = await this.llmProvider.complete({
            model: "qwen2.5-coder:7b",
            prompt: `Summarise this conversation in 2-3 sentences, focusing on what was accomplished and any open items. Be concise and natural.\n\n${transcript}`,
            temperature: 0.3,
          });
          summaryText = llmResult.text.trim();
        } else {
          // Fallback: take the last 2 user messages
          const userMsgs = recentHistory.filter((m) => m.role === "user").slice(-2);
          summaryText = `Conversation covered: ${userMsgs.map((m) => m.content.slice(0, 80)).join("; ")}`;
        }

        this.sessionSummaries.add({
          summary: summaryText,
          conversationId: `conv_${Date.now()}`,
          messageCount: this.userMessageCount,
        });
      } catch {
        // Best effort — don't break the interaction
      }
    }

    return {
      text: responseText,
      confidence: 0.8,
      toolsUsed: [],
      duration,
      metadata: {
        totalInteractions: this.totalInteractions,
        memorySize: this.workingMemory.snapshot().entries.length,
        thoughtGraphNodes: this.thoughtGraph.snapshot().nodeCount,
        thoughtGraphEdges: this.thoughtGraph.snapshot().edgeCount,
      },
    };
  }

  processEvent(event: {
    source: ObservationSource;
    title: string;
    detail: string;
  }): {
    readonly action: "ignore" | "buffer" | "immediate" | "summarize";
  } {
    return this.attention.process(event);
  }

  getHistory(): ReadonlyArray<FluxRuntimeMessage> {
    return this.history;
  }

  getState(): FluxRuntimeState {
    const graphSnapshot = this.thoughtGraph.snapshot();
    const sensorState = this.sensors.getState();
    const memStats = this.memory.getStats();
    return {
      memorySize: this.workingMemory.snapshot().entries.length,
      activeGoals: this.goalManager
        .getAll()
        .filter((g) => g.status === "active" || g.status === "in_progress")
        .length,
      worldModelEntities: this.worldModel.getState().version,
      attentionBufferSize: this.attention.getBuffer().length,
      cognitiveState: this.running ? "running" : "idle",
      relationshipLevel: 0,
      totalInteractions: this.totalInteractions,
      uptime: Date.now() - this.startTime,
      isRunning: this.running,
      lastTickAt: this.lastTickAt,
      tickCount: this.tickCount,
      thoughtGraphNodes: graphSnapshot.nodeCount,
      thoughtGraphEdges: graphSnapshot.edgeCount,
      lastPipelineDurationMs: this.lastPipelineDurationMs,
      sensorsRunning: sensorState.runningSensors,
      totalSensorEvents: sensorState.totalEvents,
      cognitiveMemoryCount: memStats.totalMemories,
      memoryStats: memStats,
    };
  }

  async getStreamingSnapshot(): Promise<{
    readonly state: FluxRuntimeState;
    readonly pipelineResult: CognitionResult | null;
    readonly recentThoughts: ReadonlyArray<{
      type: string;
      content: string;
      confidence: number;
      timestamp: number;
    }>;
    readonly recentActions: ReadonlyArray<{
      type: string;
      reasoning: string;
      confidence: number;
      timestamp: number;
    }>;
    readonly recentSensorEvents: ReadonlyArray<{
      sensorId: string;
      type: string;
      timestamp: number;
      priority: string;
    }>;
    readonly goals: ReadonlyArray<{
      id: string;
      title: string;
      status: string;
      progress: number;
    }>;
    readonly worldState: ReturnType<DefaultWorldModel["getState"]>;
    readonly sensorSnapshots: Record<string, unknown>;
    readonly proactiveSuggestions: ReadonlyArray<{
      id: string;
      type: string;
      message: string;
      timestamp: number;
      priority: string;
    }>;
    readonly proactiveMessages: ReadonlyArray<{
      id: string;
      content: string;
      type: string;
      priority: string;
      timestamp: number;
      spoken: boolean;
      actionLabel?: string;
      actionPayload?: string;
    }>;
  }> {
    const goals = this.goalManager.getAll().map((g) => ({
      id: g.id,
      title: g.title,
      status: g.status,
      progress: g.progress,
    }));

    // Gather sensor snapshots
    const sensorSnapshots: Record<string, unknown> = {};
    for (const sensorId of [
      "git",
      "docker",
      "battery",
      "idle",
      "clipboard",
      "spotify",
      "audio",
      "notifications",
      "filesystem",
    ] as const) {
      try {
        const sensor = this.sensors.get(sensorId);
        if (sensor) {
          const snap = await sensor.snapshot();
          if (snap) {
            sensorSnapshots[sensorId] = snap;
          } else {
            // Sensor available but no data yet — return minimal state
            const sensorState = sensor.getState();
            sensorSnapshots[sensorId] = {
              status: sensorState.status,
              available: true,
              lastUpdate: sensorState.lastUpdate || 0,
            };
          }
        }
      } catch {
        // Best-effort
      }
    }

    return {
      state: this.getState(),
      pipelineResult: this.lastPipelineResult,
      recentThoughts: this.recentThoughts.slice(-20),
      recentActions: this.recentActions.slice(-10),
      recentSensorEvents: this.recentSensorEvents.slice(-30),
      goals,
      worldState: this.worldModel.getState(),
      sensorSnapshots,
      proactiveSuggestions: this.proactiveSuggestions.slice(-10),
      proactiveMessages: this.proactiveMessages.slice(-10),
    };
  }

  async shutdown(): Promise<void> {
    this.stop();
    this.cognitiveReady = false;
  }
}
