import type { Provider, ProviderName } from "@ai-agent/providers";
import type { ObservationSource, AttentionManager } from "@ai-agent/attention";
import type { CognitiveOrchestrator } from "@ai-agent/cognitive";
import type { DefaultSession } from "@ai-agent/agent";
import type { LlmProvider } from "@ai-agent/services-core";

export interface FluxRuntimeConfig {
  readonly provider: ProviderName;
  readonly model: string;
  readonly providerConfigs: Partial<Record<ProviderName, { apiKey?: string; baseUrl?: string }>>;
  readonly maxMemoryCapacity?: number;
  readonly attentionMinBrainScore?: number;
  readonly enableSelfEvolution?: boolean;
  readonly backgroundTickMs?: number;
  readonly autoStart?: boolean;
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
}

export interface FluxRuntime {
  readonly provider: Provider;
  readonly llmProvider: LlmProvider;
  readonly session: InstanceType<typeof DefaultSession>;
  readonly attention: InstanceType<typeof AttentionManager>;
  readonly cognitive: CognitiveOrchestrator;
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
}
