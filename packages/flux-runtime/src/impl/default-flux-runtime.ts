import type { FluxRuntime, FluxRuntimeConfig, FluxRuntimeMessage, FluxRuntimeResult, FluxRuntimeState, TickEvent } from "../interfaces/flux-runtime.js";

import { DefaultToolRegistry, echoTool, createReadFileTool, createWriteFileTool, createEditFileTool, createListDirectoryTool, createRunCommandTool, createGitStatusTool, createGitDiffTool, createGitLogTool, createGitAddTool, createGitCommitTool, createGitBranchTool, createGitCheckoutTool, createGitPushTool, createGitPullTool, createHttpRequestTool, createProcessMonitorTool, createCronTool, createSystemInfoTool, createDockerTool, createScreenMonitorTool } from "@ai-agent/tools";
import { DefaultProviderFactory, type Provider } from "@ai-agent/providers";
import { DefaultSession } from "@ai-agent/agent";
import { DefaultServiceRegistry, Orchestrator, type LlmProvider } from "@ai-agent/services-core";
import { createChatService } from "@ai-agent/services-chat";
import { createCodingService } from "@ai-agent/services-coding";
import { createSearchService } from "@ai-agent/services-search";
import { createSystemService } from "@ai-agent/services-system";
import { createRemindersService } from "@ai-agent/services-reminders";
import { createFilesService } from "@ai-agent/services-files";
import { createNotificationService } from "@ai-agent/services-notifications";
import { createMonitorService } from "@ai-agent/services-monitor";
import { createAutomationService } from "@ai-agent/services-automations";
import { createContextService } from "@ai-agent/services-context";
import { createProactiveService } from "@ai-agent/services-proactive";
import { AttentionManager, type ObservationSource } from "@ai-agent/attention";
import { DefaultWorldModel } from "@ai-agent/world-model";
import { DefaultWorkingMemory } from "@ai-agent/working-memory";
import { DefaultGoalManager } from "@ai-agent/goals";
import { DefaultReasoningEngine, LlmThoughtGenerator } from "@ai-agent/reasoning";
import { DefaultDecisionEngine, DefaultInterruptController } from "@ai-agent/decisions";
import { DefaultCognitiveOrchestrator, type CognitiveOrchestrator } from "@ai-agent/cognitive";
import { DefaultExperienceDatabase } from "@ai-agent/experience-db";
import { DefaultMetaCognitionEngine } from "@ai-agent/meta-cognition";
import { DefaultStrategyLibrary } from "@ai-agent/strategy-library";
import { DefaultConfidenceCalibration } from "@ai-agent/confidence-calibration";
import { DefaultKnowledgeConsolidation } from "@ai-agent/knowledge-consolidation";
import { DefaultHabitDiscovery } from "@ai-agent/habit-discovery";
import { DefaultThoughtGraph, type CognitionResult } from "@ai-agent/thought-graph";
import { CognitionPipeline } from "./cognition-pipeline.js";
import { execSync } from "node:child_process";

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
  readonly confidenceCalibration: InstanceType<typeof DefaultConfidenceCalibration>;
  readonly knowledge: InstanceType<typeof DefaultKnowledgeConsolidation>;
  readonly habits: InstanceType<typeof DefaultHabitDiscovery>;
  readonly thoughtGraph: DefaultThoughtGraph;
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

  constructor(config: FluxRuntimeConfig) {
    this.config = config;
    this.startTime = Date.now();

    // --- Layer 1: Tools ---
    const toolRegistry = new DefaultToolRegistry();
    const tools = [
      echoTool, createReadFileTool(), createWriteFileTool(), createEditFileTool(),
      createListDirectoryTool(), createRunCommandTool(), createGitStatusTool(),
      createGitDiffTool(), createGitLogTool(), createGitAddTool(), createGitCommitTool(),
      createGitBranchTool(), createGitCheckoutTool(), createGitPushTool(), createGitPullTool(),
      createHttpRequestTool(), createProcessMonitorTool(), createCronTool(),
      createSystemInfoTool(), createDockerTool(), createScreenMonitorTool(),
    ];
    for (const tool of tools) {
      toolRegistry.register(tool);
    }

    // --- Layer 2: LLM Provider ---
    const factory = new DefaultProviderFactory(config.providerConfigs);
    this.provider = factory.create(config.provider);

    this.llmProvider = {
      complete: (req) => this.provider.complete({
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
    this.workingMemory = new DefaultWorkingMemory({ capacity: config.maxMemoryCapacity ?? 50 });
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
        onAction: () => {},
        onThought: () => {},
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

    // Start the cognitive system's internal timers (5s think cycle, 30min reflection)
    this.cognitive.start();

    // Start our observation gathering loop
    const tickMs = this.config.backgroundTickMs ?? 5000;
    this.backgroundTimer = setInterval(() => {
      this.runTick();
    }, tickMs);

    // Run first tick immediately
    this.runTick();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;

    // Stop cognitive system timers
    this.cognitive.stop();

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

  private runTick(): void {
    if (!this.running) return;

    const tickStart = Date.now();
    this.tickCount++;
    let observationsGathered = 0;

    try {
      // Gather observations from available sources
      observationsGathered = this.gatherObservations();
    } catch {
      // Observation gathering is best-effort
    }

    // Run the 14-stage cognition pipeline
    let pipelineResult: CognitionResult | undefined;
    try {
      // Use a synchronous wrapper for the async pipeline
      this.pipeline.runTick().then((result) => {
        this.lastPipelineDurationMs = result.durationMs;
        pipelineResult = result;
      }).catch(() => {
        // Pipeline errors are non-fatal
      });
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

  private gatherObservations(): number {
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

    return count;
  }

  private gatherScreenObservation(): { source: ObservationSource; title: string; detail: string } | null {
    try {
      const platform = process.platform;
      let app = "";
      let title = "";

      if (platform === "linux") {
        const activeWindow = execSync("xdotool getactivewindow getwindowname 2>/dev/null", { encoding: "utf-8", timeout: 2000 }).trim();
        const parts = activeWindow.split(" — ");
        app = parts[0]?.trim() ?? activeWindow;
        title = parts.slice(1).join(" — ").trim();
      } else if (platform === "darwin") {
        const script = `tell application "System Events" to get {name of first application process whose frontmost is true, name of front window of first application process whose frontmost is true}`;
        const output = execSync(`osascript -e '${script}' 2>/dev/null`, { encoding: "utf-8", timeout: 2000 }).trim();
        const parts = output.split(", ");
        app = parts[0]?.trim() ?? "";
        title = parts.slice(1).join(", ").trim();
      }

      if (!app) return null;

      // Only emit if something changed (dedup)
      if (app === this.lastScreenApp && title === this.lastScreenTitle) return null;
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

  private gatherSystemObservation(): { source: ObservationSource; title: string; detail: string } | null {
    try {
      const loadavg = execSync("cat /proc/loadavg 2>/dev/null || sysctl -n vm.loadavg 2>/dev/null", { encoding: "utf-8", timeout: 2000 }).trim();
      const parts = loadavg.split(" ");
      const load1 = parseFloat(parts[0] ?? "0");
      const cpus = parseInt(execSync("nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4", { encoding: "utf-8", timeout: 2000 }).trim(), 10);
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
    const result = await this.orchestrator.process(input, {
      sessionId: this.session.id,
      memory: this.session.memory,
      provider: this.llmProvider,
      reply: () => {},
      speak: () => {},
      emit: () => {},
    });

    const responseText = result.text;
    const duration = Date.now() - start;

    // Step 5: Record assistant response in memory
    await this.session.memory.add("assistant", responseText);

    // Step 6: Record in history
    this.history.push({ role: "assistant", content: responseText, timestamp: Date.now() });

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
    this.habits.observe("communication", `User message: ${input.slice(0, 50)}`, input.slice(0, 30));

    // Step 10: Track confidence
    this.confidenceCalibration.record("chat_response", 0.8, responseText.length > 0);

    // Step 11: Generate a thought about this interaction
    this.thoughtGraph.addNode({
      type: "observation_interpretation",
      content: `User said: ${input.slice(0, 100)}`,
      reasoning: "Direct user message",
      confidence: { value: 1.0, reason: "Direct observation", timestamp: Date.now() },
      evidence: [],
      counterarguments: [],
      relatedThoughtIds: [],
      observationIds: [],
      goalId: null,
      expiresAt: Date.now() + 86400000, // 24 hours
      metadata: { role: "user" },
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

  processEvent(event: { source: ObservationSource; title: string; detail: string }): {
    readonly action: "ignore" | "buffer" | "immediate" | "summarize";
  } {
    return this.attention.process(event);
  }

  getHistory(): ReadonlyArray<FluxRuntimeMessage> {
    return this.history;
  }

  getState(): FluxRuntimeState {
    const graphSnapshot = this.thoughtGraph.snapshot();
    return {
      memorySize: this.workingMemory.snapshot().entries.length,
      activeGoals: this.goalManager.getAll().filter((g) => g.status === "active" || g.status === "in_progress").length,
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
    };
  }

  async shutdown(): Promise<void> {
    this.stop();
    this.cognitiveReady = false;
  }
}
