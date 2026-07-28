import { DefaultToolRegistry, echoTool, createReadFileTool, createWriteFileTool, createEditFileTool, createListDirectoryTool, createRunCommandTool, createGitStatusTool, createGitDiffTool, createGitLogTool, createGitAddTool, createGitCommitTool, createGitBranchTool, createGitCheckoutTool, createGitPushTool, createGitPullTool, createHttpRequestTool, createProcessMonitorTool, createCronTool, createSystemInfoTool, createDockerTool, createScreenMonitorTool } from "@ai-agent/tools";
import { DefaultProviderFactory, type ProviderName, type Provider } from "@ai-agent/providers";
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

export interface FluxConfig {
  provider: ProviderName;
  model: string;
  providerConfigs: Partial<Record<ProviderName, { apiKey?: string; baseUrl?: string }>>;
}

export interface FluxInstance {
  process(input: string): Promise<string>;
  processEvent(event: { source: ObservationSource; title: string; detail: string }): {
    action: "ignore" | "buffer" | "immediate" | "summarize";
    observation?: import("@ai-agent/attention").Observation;
    summary?: import("@ai-agent/attention").ObservationSummary;
  };
  session: InstanceType<typeof DefaultSession>;
  llmProvider: Provider;
  model: string;
  attention: AttentionManager;
  cognitive: CognitiveOrchestrator;
}

export function createFlux(config: FluxConfig): FluxInstance {
  const toolRegistry = new DefaultToolRegistry();
  toolRegistry.register(echoTool);
  toolRegistry.register(createReadFileTool());
  toolRegistry.register(createWriteFileTool());
  toolRegistry.register(createEditFileTool());
  toolRegistry.register(createListDirectoryTool());
  toolRegistry.register(createRunCommandTool());
  toolRegistry.register(createGitStatusTool());
  toolRegistry.register(createGitDiffTool());
  toolRegistry.register(createGitLogTool());
  toolRegistry.register(createGitAddTool());
  toolRegistry.register(createGitCommitTool());
  toolRegistry.register(createGitBranchTool());
  toolRegistry.register(createGitCheckoutTool());
  toolRegistry.register(createGitPushTool());
  toolRegistry.register(createGitPullTool());
  toolRegistry.register(createHttpRequestTool());
  toolRegistry.register(createProcessMonitorTool());
  toolRegistry.register(createCronTool());
  toolRegistry.register(createSystemInfoTool());
  toolRegistry.register(createDockerTool());
  toolRegistry.register(createScreenMonitorTool());

  const factory = new DefaultProviderFactory(config.providerConfigs);
  const provider = factory.create(config.provider);

  const llmProvider: LlmProvider = {
    complete: (req) => provider.complete({
      model: req.model === "default" ? config.model : req.model,
      prompt: req.prompt,
      temperature: req.temperature ?? 0.7,
    }),
  };

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

  const orchestrator = new Orchestrator(serviceRegistry);
  const session = new DefaultSession("flux-session");

  const worldModel = new DefaultWorldModel();
  const workingMemory = new DefaultWorkingMemory({ capacity: 50 });
  const goalManager = new DefaultGoalManager();
  const thoughtGenerator = new LlmThoughtGenerator(llmProvider);
  const reasoningEngine = new DefaultReasoningEngine(thoughtGenerator);
  const decisionEngine = new DefaultDecisionEngine();
  const interruptController = new DefaultInterruptController();

  let cognitiveReady = false;
  const cognitive = new DefaultCognitiveOrchestrator(
    worldModel,
    workingMemory,
    goalManager,
    reasoningEngine,
    decisionEngine,
    interruptController,
    {
      llmProvider,
      onAction: (decision) => {
        if (decision.action.type === "speak") {
          console.log(`[Cognitive] ${decision.action.payload["text"]}`);
        }
      },
      onThought: (thought) => {
        if (thought.confidence > 0.7) {
          console.log(`[Thought] (${thought.type}) ${thought.content} [${(thought.confidence * 100).toFixed(0)}%]`);
        }
      },
    },
  );

  const attention = new AttentionManager({
    minBrainScore: 40,
    onSummary: (summary) => {
      console.log(`[Attention] Summary: ${summary.summary} (${summary.totalCount} events, ${summary.timeRange.start}-${summary.timeRange.end})`);
    },
    onObservation: (observation) => {
      if (cognitiveReady) {
        cognitive.observe(observation);
      }
    },
  });

  cognitiveReady = true;

  async function process(input: string): Promise<string> {
    await session.memory.add("user", input);
    cognitive.message(input);

    const result = await orchestrator.process(input, {
      sessionId: session.id,
      memory: session.memory,
      provider: llmProvider,
      reply: () => {},
      speak: () => {},
      emit: () => {},
    });

    return result.text;
  }

  function processEvent(event: { source: ObservationSource; title: string; detail: string }) {
    return attention.process(event);
  }

  return { process, session, llmProvider: provider, model: config.model, attention, processEvent, cognitive };
}
