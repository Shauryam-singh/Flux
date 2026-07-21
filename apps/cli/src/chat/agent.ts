import {
  DefaultAgent,
  DefaultSession,
  LlmPlanner,
} from "@ai-agent/agent";
import {
  DefaultProviderFactory,
  type ProviderName,
} from "@ai-agent/providers";
import {
  DefaultToolExecutor,
  DefaultToolRegistry,
  echoTool,
  createReadFileTool,
  createWriteFileTool,
  createEditFileTool,
  createListDirectoryTool,
  createRunCommandTool,
  createGitStatusTool,
  createGitDiffTool,
  createGitLogTool,
  createGitAddTool,
  createGitCommitTool,
  createGitBranchTool,
  createGitCheckoutTool,
  createGitPushTool,
  createGitPullTool,
} from "@ai-agent/tools";

export interface AgentConfig {
  provider: ProviderName;
  model: string;
  providerConfigs: Partial<
    Record<ProviderName, { apiKey?: string; baseUrl?: string }>
  >;
}

const registry = new DefaultToolRegistry();
registry.register(echoTool);
registry.register(createReadFileTool());
registry.register(createWriteFileTool());
registry.register(createEditFileTool());
registry.register(createListDirectoryTool());
registry.register(createRunCommandTool());
registry.register(createGitStatusTool());
registry.register(createGitDiffTool());
registry.register(createGitLogTool());
registry.register(createGitAddTool());
registry.register(createGitCommitTool());
registry.register(createGitBranchTool());
registry.register(createGitCheckoutTool());
registry.register(createGitPushTool());
registry.register(createGitPullTool());

const executor = new DefaultToolExecutor(registry);
const session = new DefaultSession("cli-interactive");

export function createAgent(cfg: AgentConfig): DefaultAgent {
  const factory = new DefaultProviderFactory(cfg.providerConfigs);
  const provider = factory.create(cfg.provider);
  const planner = new LlmPlanner(provider, registry, {
    model: cfg.model,
  });
  return new DefaultAgent(planner, executor);
}

export function getToolNames(): string[] {
  return registry.getAll().map((t) => t.name);
}
