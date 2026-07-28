import type { Task, TaskResult, TaskConstraints, AgentMetadata, AgentMessage, AgentHealth } from "@ai-agent/exec-types";

export interface SpecialistAgent {
  readonly metadata: AgentMetadata;

  initialize(config: AgentConfig): Promise<void>;
  execute(task: Task): Promise<TaskResult>;
  cancel(taskId: string): Promise<void>;
  pause(taskId: string): Promise<void>;
  resume(taskId: string): Promise<void>;
  health(): AgentHealth;
  shutdown(): Promise<void>;

  onMessage(handler: (message: AgentMessage) => void): () => void;
  canHandle(task: Task): boolean;
  estimateCost(task: Task): number;
  estimateDuration(task: Task): number;
}

export interface AgentConfig {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly capabilities: ReadonlyArray<string>;
  readonly supportedModels: ReadonlyArray<string>;
  readonly maxConcurrentTasks: number;
  readonly priority: number;
  readonly costPerToken: number;
  readonly timeoutMs: number;
  readonly model: string;
  readonly systemPrompt: string;
}

export interface AgentLifecycle {
  onRegister(agent: SpecialistAgent): Promise<void>;
  onStart(agent: SpecialistAgent): Promise<void>;
  onStop(agent: SpecialistAgent): Promise<void>;
  onTaskAssigned(agent: SpecialistAgent, task: Task): Promise<void>;
  onTaskCompleted(agent: SpecialistAgent, task: Task, result: TaskResult): Promise<void>;
  onTaskFailed(agent: SpecialistAgent, task: Task, error: string): Promise<void>;
}
