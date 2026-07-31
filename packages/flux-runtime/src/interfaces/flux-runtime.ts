import type { DefaultSession } from "@ai-agent/agent";
import type { AttentionManager, ObservationSource } from "@ai-agent/attention";
import type { CognitiveOrchestrator } from "@ai-agent/cognitive";
import type { MemoryManager } from "@ai-agent/cognitive-memory";
import type { DefaultConfidenceCalibration } from "@ai-agent/confidence-calibration";
import type { DefaultExperienceDatabase } from "@ai-agent/experience-db";
import type { DefaultGoalManager } from "@ai-agent/goals";
import type { DefaultHabitDiscovery } from "@ai-agent/habit-discovery";
import type { DefaultKnowledgeConsolidation } from "@ai-agent/knowledge-consolidation";
import type { DefaultMetaCognitionEngine } from "@ai-agent/meta-cognition";
import type { Provider, ProviderName } from "@ai-agent/providers";
import type { SensorManager } from "@ai-agent/sensors";
import type { LlmProvider } from "@ai-agent/services-core";
import type { DefaultStrategyLibrary } from "@ai-agent/strategy-library";
import type {
  CognitionResult,
  DefaultThoughtGraph,
} from "@ai-agent/thought-graph";
import type { DefaultWorkingMemory } from "@ai-agent/working-memory";
import type { DefaultWorldModel } from "@ai-agent/world-model";

export interface FluxRuntimeConfig {
  readonly provider: ProviderName;
  readonly model: string;
  readonly providerConfigs: Partial<
    Record<ProviderName, { apiKey?: string; baseUrl?: string }>
  >;
  readonly maxMemoryCapacity?: number;
  readonly attentionMinBrainScore?: number;
  readonly enableSelfEvolution?: boolean;
  readonly backgroundTickMs?: number;
  readonly autoStart?: boolean;
  readonly enableSensors?: boolean;
}

export interface FluxRuntimeMessage {
  readonly role: "user" | "assistant" | "system";
  readonly content: string;
  readonly timestamp: number;
  readonly metadata?: Record<string, unknown>;
}

export interface FluxRuntimeResult {
  readonly text: string;
  readonly thought?: string;
  readonly confidence: number;
  readonly toolsUsed: ReadonlyArray<string>;
  readonly duration: number;
  readonly metadata: Record<string, unknown>;
}

export interface TickEvent {
  readonly tickNumber: number;
  readonly timestamp: number;
  readonly observations: number;
  readonly cognitiveCycleRan: boolean;
  readonly duration: number;
  readonly pipelineResult?: CognitionResult | undefined;
}

export interface FluxRuntime {
  readonly provider: Provider;
  readonly llmProvider: LlmProvider;
  readonly session: InstanceType<typeof DefaultSession>;
  readonly attention: InstanceType<typeof AttentionManager>;
  readonly cognitive: CognitiveOrchestrator;
  readonly thoughtGraph: DefaultThoughtGraph;
  readonly sensors: SensorManager;
  readonly memory: MemoryManager;
  readonly goalManager: DefaultGoalManager;
  readonly worldModel: InstanceType<typeof DefaultWorldModel>;
  readonly workingMemory: InstanceType<typeof DefaultWorkingMemory>;
  readonly experienceDb: DefaultExperienceDatabase;
  readonly metaCognition: DefaultMetaCognitionEngine;
  readonly strategyLibrary: DefaultStrategyLibrary;
  readonly confidenceCalibration: DefaultConfidenceCalibration;
  readonly knowledge: DefaultKnowledgeConsolidation;
  readonly habits: DefaultHabitDiscovery;
  process(input: string): Promise<FluxRuntimeResult>;
  processEvent(event: {
    source: ObservationSource;
    title: string;
    detail: string;
  }): {
    readonly action: "ignore" | "buffer" | "immediate" | "summarize";
  };
  start(): void;
  stop(): void;
  isRunning(): boolean;
  onTick(handler: (event: TickEvent) => void): () => void;
  getHistory(): ReadonlyArray<FluxRuntimeMessage>;
  getState(): FluxRuntimeState;
  getStreamingSnapshot(): Promise<{
    readonly state: FluxRuntimeState;
    readonly pipelineResult:
      | import("@ai-agent/thought-graph").CognitionResult
      | null;
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
    readonly worldState: import("@ai-agent/world-model").WorldState;
    readonly sensorSnapshots: Record<string, unknown>;
  }>;
  explainThought(thoughtId: string): ReturnType<DefaultThoughtGraph["explain"]>;
  getRecentThoughts(
    limit?: number,
  ): ReturnType<DefaultThoughtGraph["getRecentThoughts"]>;
  getStrongestThoughts(
    limit?: number,
  ): ReturnType<DefaultThoughtGraph["getStrongestThoughts"]>;
  emitProactiveMessage(opts: {
    content: string;
    type?: "suggestion" | "alert" | "info";
    priority?: "low" | "medium" | "high";
    actionLabel?: string;
    actionPayload?: string;
  }): void;
  onProactiveMessage(listener: (msgJson: string) => void): () => void;
  onProactiveSpeak(listener: (text: string) => void): () => void;
  getProactiveMessages(limit?: number): ReadonlyArray<{
    id: string;
    content: string;
    type: string;
    priority: string;
    timestamp: number;
    spoken: boolean;
    actionLabel?: string;
    actionPayload?: string;
  }>;
  triggerAutoResponse(trigger: {
    source: string;
    event: string;
    context?: Record<string, unknown>;
  }): Promise<void>;
  shutdown(): Promise<void>;
}

export interface FluxRuntimeState {
  readonly memorySize: number;
  readonly activeGoals: number;
  readonly worldModelEntities: number;
  readonly attentionBufferSize: number;
  readonly cognitiveState: string;
  readonly relationshipLevel: number;
  readonly totalInteractions: number;
  readonly uptime: number;
  readonly isRunning: boolean;
  readonly lastTickAt: number | null;
  readonly tickCount: number;
  readonly thoughtGraphNodes: number;
  readonly thoughtGraphEdges: number;
  readonly lastPipelineDurationMs: number | null;
  readonly sensorsRunning: number;
  readonly totalSensorEvents: number;
  readonly cognitiveMemoryCount: number;
  readonly memoryStats: import("@ai-agent/cognitive-memory").MemoryStats | null;
}
