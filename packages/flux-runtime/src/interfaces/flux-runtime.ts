import type { Provider, ProviderName } from "@ai-agent/providers";
import type { ObservationSource, AttentionManager } from "@ai-agent/attention";
import type { CognitiveOrchestrator } from "@ai-agent/cognitive";
import type { DefaultSession } from "@ai-agent/agent";
import type { LlmProvider } from "@ai-agent/services-core";
import type { DefaultThoughtGraph, CognitionResult } from "@ai-agent/thought-graph";
import type { SensorManager } from "@ai-agent/sensors";

export interface FluxRuntimeConfig {
  readonly provider: ProviderName;
  readonly model: string;
  readonly providerConfigs: Partial<Record<ProviderName, { apiKey?: string; baseUrl?: string }>>;
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
  readonly pipelineResult?: CognitionResult;
}

export interface FluxRuntime {
  readonly provider: Provider;
  readonly llmProvider: LlmProvider;
  readonly session: InstanceType<typeof DefaultSession>;
  readonly attention: InstanceType<typeof AttentionManager>;
  readonly cognitive: CognitiveOrchestrator;
  readonly thoughtGraph: DefaultThoughtGraph;
  readonly sensors: SensorManager;
  process(input: string): Promise<FluxRuntimeResult>;
  processEvent(event: { source: ObservationSource; title: string; detail: string }): {
    readonly action: "ignore" | "buffer" | "immediate" | "summarize";
  };
  start(): void;
  stop(): void;
  isRunning(): boolean;
  onTick(handler: (event: TickEvent) => void): () => void;
  getHistory(): ReadonlyArray<FluxRuntimeMessage>;
  getState(): FluxRuntimeState;
  explainThought(thoughtId: string): ReturnType<DefaultThoughtGraph["explain"]>;
  getRecentThoughts(limit?: number): ReturnType<DefaultThoughtGraph["getRecentThoughts"]>;
  getStrongestThoughts(limit?: number): ReturnType<DefaultThoughtGraph["getStrongestThoughts"]>;
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
}
