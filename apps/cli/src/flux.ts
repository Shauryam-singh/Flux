import { DefaultFluxRuntime, type FluxRuntimeConfig, type FluxRuntime } from "@ai-agent/flux-runtime";
import type { ProviderName } from "@ai-agent/providers";
import type { Provider } from "@ai-agent/providers";
import type { ObservationSource } from "@ai-agent/attention";
import type { DefaultSession } from "@ai-agent/agent";
import type { LlmProvider } from "@ai-agent/services-core";

export type { FluxRuntimeConfig, FluxRuntime } from "@ai-agent/flux-runtime";

export interface FluxConfig {
  provider: ProviderName;
  model: string;
  providerConfigs: Partial<Record<ProviderName, { apiKey?: string; baseUrl?: string }>>;
}

export interface FluxInstance {
  process(input: string): Promise<string>;
  processEvent(event: { source: ObservationSource; title: string; detail: string }): {
    action: "ignore" | "buffer" | "immediate" | "summarize";
  };
  getState(): ReturnType<FluxRuntime["getState"]>;
  shutdown(): Promise<void>;
  runtime: FluxRuntime;
  session: InstanceType<typeof DefaultSession>;
  llmProvider: LlmProvider;
  model: string;
}

export function createFlux(config: FluxConfig): FluxInstance {
  const runtimeConfig: FluxRuntimeConfig = {
    provider: config.provider,
    model: config.model,
    providerConfigs: config.providerConfigs,
    maxMemoryCapacity: 50,
    attentionMinBrainScore: 40,
    enableSelfEvolution: true,
  };

  const runtime = new DefaultFluxRuntime(runtimeConfig);

  return {
    async process(input: string): Promise<string> {
      const result = await runtime.process(input);
      return result.text;
    },

    processEvent(event) {
      return runtime.processEvent(event);
    },

    getState() {
      return runtime.getState();
    },

    async shutdown() {
      await runtime.shutdown();
    },

    runtime,
    session: runtime.session,
    llmProvider: runtime.llmProvider,
    model: config.model,
  };
}
