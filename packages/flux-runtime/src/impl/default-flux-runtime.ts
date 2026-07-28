import type { FluxRuntime, FluxRuntimeConfig, FluxRuntimeMessage, FluxRuntimeResult, FluxRuntimeState } from "../interfaces/flux-runtime.js";

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

export class DefaultFluxRuntime implements FluxRuntime {
  private readonly config: FluxRuntimeConfig;
  private readonly startTime: number;
  private readonly history: FluxRuntimeMessage[] = [];

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

  private totalInteractions = 0;
  private cognitiveReady = false;

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
          this.cognitive.observe(observation);
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

    this.cognitiveReady = true;
  }

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

    return {
      text: responseText,
      confidence: 0.8,
      toolsUsed: [],
      duration,
      metadata: {
        totalInteractions: this.totalInteractions,
        memorySize: this.workingMemory.snapshot().entries.length,
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
    return {
      memorySize: this.workingMemory.snapshot().entries.length,
      activeGoals: this.goalManager.getAll().filter((g) => g.status === "active" || g.status === "in_progress").length,
      worldModelEntities: this.worldModel.getState().version,
      attentionBufferSize: this.attention.getBuffer().length,
      cognitiveState: "active",
      relationshipLevel: 0,
      totalInteractions: this.totalInteractions,
      uptime: Date.now() - this.startTime,
    };
  }

  async shutdown(): Promise<void> {
    this.cognitiveReady = false;
  }
}
