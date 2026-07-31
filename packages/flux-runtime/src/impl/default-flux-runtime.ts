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
  Orchestrator,
} from "@ai-agent/services-core";
import { createFilesService } from "@ai-agent/services-files";
import { createMonitorService } from "@ai-agent/services-monitor";
import { createNotificationService } from "@ai-agent/services-notifications";
import { createProactiveService } from "@ai-agent/services-proactive";
import { createRemindersService } from "@ai-agent/services-reminders";
import { createSearchService } from "@ai-agent/services-search";
import { createSystemService } from "@ai-agent/services-system";
import { DefaultPluginLoader, type FluxPlugin } from "@ai-agent/plugins";
import { DefaultKnowledgeBase } from "@ai-agent/knowledge-base";
import { DefaultMultiAgentCoordinator } from "@ai-agent/multi-agent";
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

    // Initialize proactive awareness trackers
    this.windowTracker = new WindowTracker();
    this.browserContext = new BrowserContextSensor();
    this.codingSession = new CodingSessionTracker();

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
    // Check every 15 seconds (was 30, faster for awareness)
    if (now - this.lastSuggestionCheck < 15000) return;
    this.lastSuggestionCheck = now;

    try {
      // ── 1. System Health (CPU / Memory / Disk / Network) ──────────
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
        }
      }

      // ── 2. Battery ──────────────────────────────────────────────
      const batterySnap = await this.sensors.get("battery")?.snapshot() as { level?: number; isCharging?: boolean } | null;
      if (batterySnap?.level != null && batterySnap.level < 20 && !batterySnap.isCharging) {
        this.addSuggestion("battery_low", "warning", `Battery is low at ${batterySnap.level}% — consider plugging in`, "high");
      }

      // ── 3. Window Tracking (IDE, Browser, Terminal context) ─────
      const windowInfo = this.windowTracker.poll();
      if (windowInfo) {
        const app = windowInfo.app;
        const title = windowInfo.title;

        // Track app visits
        const count = (this.appVisitCount.get(app) ?? 0) + 1;
        this.appVisitCount.set(app, count);

        // ── IDE Detection (VS Code, IntelliJ, Zed, etc.) ──
        const isIDE =
          app.includes("code") ||
          app.includes("vscode") ||
          app.includes("visual studio") ||
          app.includes("idea") ||
          app.includes("intellij") ||
          app.includes("pycharm") ||
          app.includes("webstorm") ||
          app.includes("zed") ||
          app.includes("cursor") ||
          app.includes("helix");

        if (isIDE && this.lastScreenAppForSuggestions !== app) {
          // Extract project name from window title (format: "filename — ProjectName")
          const parts = title.split(" — ");
          const projectName = parts.length > 1 && parts[parts.length - 1] != null ? parts[parts.length - 1]!.trim() : null;

          if (projectName) {
            this.addSuggestion("ide_project", "info", `Working on "${projectName}" — need help with code, debugging, or git?`, "low");
          } else {
            this.addSuggestion("ide_help", "info", "IDE is open — need help with code, debugging, or git?", "low");
          }
        }

        // ── Browser Context Detection ──
        const browserCtx = this.browserContext.detectFromWindowTitle(title, app);
        if (browserCtx) {
          if (browserCtx.isGitHub && !this.lastScreenAppForSuggestions.includes(app)) {
            if (browserCtx.isPRPage) {
              this.addSuggestion("github_pr", "info", "Reviewing a PR on GitHub — need help with code review?", "low");
            } else if (browserCtx.isIssuePage) {
              this.addSuggestion("github_issue", "info", "Looking at a GitHub issue — need help investigating?", "low");
            } else if (browserCtx.isCodeReview) {
              this.addSuggestion("github_code_review", "info", "Code review on GitHub — want me to analyze the changes?", "low");
            } else {
              this.addSuggestion("github", "info", "Browsing GitHub — need help with a repo or PR?", "low");
            }
          }
          if (browserCtx.isStackOverflow && !this.lastScreenAppForSuggestions.includes(app)) {
            this.addSuggestion("stackoverflow", "info", "Looking at Stack Overflow — want me to help solve this?", "low");
          }
          if (browserCtx.isDocs && !this.lastScreenAppForSuggestions.includes(app)) {
            this.addSuggestion("docs", "info", "Reading documentation — want me to summarize or explain this?", "low");
          }
          if (browserCtx.isAIChat && !this.lastScreenAppForSuggestions.includes(app)) {
            this.addSuggestion("ai_chat", "info", "Using AI chat — want me to help with something else?", "low");
          }
          if (browserCtx.isSearchEngine && !this.lastScreenAppForSuggestions.includes(app)) {
            this.addSuggestion("search", "info", "Searching the web — want me to look that up for you?", "low");
          }
        }

        // ── Terminal Detection ──
        const isTerminal =
          app.includes("kitty") ||
          app.includes("alacritty") ||
          app.includes("wezterm") ||
          app.includes("foot") ||
          app.includes("ghostty") ||
          app.includes("tilix") ||
          app.includes("konsole") ||
          app.includes("gnome-terminal") ||
          app.includes("windows terminal") ||
          app.includes("cmd") ||
          app.includes("powershell") ||
          app.includes("wt");

        if (isTerminal && this.lastScreenAppForSuggestions !== app) {
          this.addSuggestion("terminal_help", "info", "Terminal open — need help running commands or monitoring processes?", "low");
        }

        // ── App Usage Patterns ──
        if (count === 10) {
          this.addSuggestion("app_pattern", "info", `You've been using ${windowInfo.className} a lot — want me to set up automation?`, "low");
        }

        this.lastScreenAppForSuggestions = app;
      }

      // ── 4. Coding Session Tracking ──────────────────────────────
      // Feed file changes to the coding session tracker
      const fsSnap = await this.sensors.get("filesystem")?.snapshot() as { recentChanges?: ReadonlyArray<{ path: string }> } | null;
      if (fsSnap?.recentChanges) {
        for (const change of fsSnap.recentChanges.slice(-3)) {
          if (change.path) {
            this.codingSession.recordFileChange(change.path);
          }
        }
      }

      const codingState = this.codingSession.tick();
      if (codingState.shouldSuggestBreak && codingState.breakReason && now - this.lastCodingSessionSuggestion > 600_000) {
        this.addSuggestion("coding_break", "info", codingState.breakReason, "medium");
        this.lastCodingSessionSuggestion = now;
      }

      // ── 5. Git Status ───────────────────────────────────────────
      const gitSnap = await this.sensors.get("git")?.snapshot() as {
        branch?: string;
        isDirty?: boolean;
        stagedCount?: number;
        ahead?: number;
        behind?: number;
        merging?: boolean;
        rebasing?: boolean;
      } | null;
      if (gitSnap) {
        if (gitSnap.isDirty && gitSnap?.branch) {
          this.addSuggestion("git_dirty", "info", `Git branch "${gitSnap.branch}" has uncommitted changes`, "medium");
        }
        if (gitSnap.merging) {
          this.addSuggestion("git_merge", "info", "You're in a merge — need help resolving conflicts?", "high");
        }
        if (gitSnap.rebasing) {
          this.addSuggestion("git_rebase", "info", "You're in a rebase — need help resolving conflicts?", "high");
        }
        if (gitSnap.ahead != null && gitSnap.ahead > 3) {
          this.addSuggestion("git_ahead", "info", `You're ${gitSnap.ahead} commits ahead of remote — consider pushing`, "low");
        }
        if (gitSnap.behind != null && gitSnap.behind > 3) {
          this.addSuggestion("git_behind", "info", `You're ${gitSnap.behind} commits behind remote — consider pulling`, "low");
        }
      }

      // ── 6. Filesystem Changes ───────────────────────────────────
      if (fsSnap?.recentChanges && fsSnap.recentChanges.length > 15) {
        this.addSuggestion("fs_many_changes", "info", `${fsSnap.recentChanges.length} recent file changes — consider committing`, "medium");
      }

      // ── 7. Clipboard Awareness ──────────────────────────────────
      const clipSnap = await this.sensors.get("clipboard")?.snapshot() as { content?: string; length?: number } | null;
      if (clipSnap?.content && clipSnap.length != null && clipSnap.length > 500) {
        // Large clipboard content — user might be doing a big paste
        this.addSuggestion("clipboard_large", "info", `Large clipboard content (${clipSnap.length} chars) — need help with this?`, "low");
      }

      // ── 8. Notification Awareness ───────────────────────────────
      const notifSnap = await this.sensors.get("notifications")?.snapshot() as { recent?: ReadonlyArray<{ summary: string; body?: string }> } | null;
      if (notifSnap?.recent) {
        for (const notif of notifSnap.recent.slice(0, 2)) {
          const text = `${notif.summary} ${notif.body ?? ""}`.toLowerCase();
          if (text.includes("error") || text.includes("fail") || text.includes("crash")) {
            this.addSuggestion("notif_error", "warning", `Notification: "${notif.summary}" — want me to help?`, "medium");
          }
        }
      }

      // ── 9. Idle Detection ───────────────────────────────────────
      const idleSnap = await this.sensors.get("idle")?.snapshot() as { isIdle?: boolean; idleSeconds?: number } | null;
      if (idleSnap?.isIdle && idleSnap.idleSeconds && idleSnap.idleSeconds > 600) {
        const mins = Math.round(idleSnap.idleSeconds / 60);
        this.addSuggestion("idle_long", "info", `Idle for ${mins} minutes — want me to pause background tasks?`, "low");
      }

      // ── 10. Context Switching Detection ─────────────────────────
      const windowState = this.windowTracker.getState();
      if (windowState.switchesLast5Min > 15) {
        this.addSuggestion("context_switching", "info", "You've switched apps 15+ times in 5 minutes — want me to focus mode?", "low");
      }
    } catch {
      // Best-effort
    }
  }

  private addSuggestion(id: string, type: string, message: string, priority: string): void {
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

      return {
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
    };

    const result = await this.orchestrator.process(input, {
      sessionId: this.session.id,
      memory: this.session.memory,
      provider: this.llmProvider,
      reply: () => {},
      speak: () => {},
      emit: () => {},
      getSystemContext,
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
    };
  }

  async shutdown(): Promise<void> {
    this.stop();
    this.cognitiveReady = false;
  }
}
