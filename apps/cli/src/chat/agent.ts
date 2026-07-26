import {
  DefaultAgent,
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
import {
  createUndoTool,
  createRedoTool,
  createEditFunctionTool,
  createAddImportTool,
  createRemoveImportTool,
  createScaffoldTool,
  createListTemplatesTool,
  createAutoCommitTool,
  createRunCommandWithRetryTool,
} from "../tools/index.js";

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
registry.register(createUndoTool());
registry.register(createRedoTool());
registry.register(createEditFunctionTool());
registry.register(createAddImportTool());
registry.register(createRemoveImportTool());
registry.register(createScaffoldTool());
registry.register(createListTemplatesTool());
registry.register(createRunCommandWithRetryTool());

const executor = new DefaultToolExecutor(registry);

export function createAgent(cfg: AgentConfig): DefaultAgent {
  const factory = new DefaultProviderFactory(cfg.providerConfigs);
  const provider = factory.create(cfg.provider);
  const planner = new LlmPlanner(provider, registry, {
    model: cfg.model,
  });
  
  const generateCommitMessage = async (diff: string): Promise<string> => {
    try {
      const response = await provider.complete({
        model: cfg.model,
        prompt: `You are a git commit message generator. Generate a concise, conventional commit message for this diff.

Rules:
- Use conventional commit format: type(scope): description
- Types: feat, fix, refactor, chore, docs, test, style, perf, ci, build
- Keep subject line under 50 characters
- Use imperative mood ("add" not "added")
- No period at end

Diff:
${diff.slice(0, 4000)}

Commit message:`,
        temperature: 0.3,
        maxTokens: 200,
      });

      const message = response.text.trim().split('\n')[0];
      if (message && message.length > 5) {
        return message;
      }
    } catch {
      // Fall through to fallback
    }
    
    const added = diff.split("\n").filter(l => l.startsWith("+") && !l.startsWith("+++")).length;
    const removed = diff.split("\n").filter(l => l.startsWith("-") && !l.startsWith("---")).length;
    const files = diff.split("diff --git").length - 1;
    
    const type = added > 0 && removed === 0 ? "feat" :
                 added === 0 && removed > 0 ? "chore" : "refactor";
    return `${type}: update ${files} file${files !== 1 ? 's' : ''}`;
  };

  registry.register(createAutoCommitTool(generateCommitMessage));
  
  return new DefaultAgent(planner, executor);
}

export function getToolNames(): string[] {
  return registry.getAll().map((t) => t.name);
}
