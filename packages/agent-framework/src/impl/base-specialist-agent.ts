import type { SpecialistAgent, AgentConfig } from "../interfaces/specialist-agent.js";
import type { Task, TaskResult, AgentMessage, AgentHealth, AgentMetadata, AgentCapability } from "@ai-agent/exec-types";

let idCounter = 0;

export abstract class BaseSpecialistAgent implements SpecialistAgent {
  metadata: AgentMetadata;
  protected config: AgentConfig;
  protected messageHandlers: Array<(message: AgentMessage) => void> = [];
  protected activeTasks = new Map<string, Task>();
  protected startTime = 0;
  protected tasksCompleted = 0;
  protected tasksFailed = 0;
  protected totalResponseTime = 0;

  constructor(config: AgentConfig) {
    this.config = config;
    this.metadata = {
      id: config.id,
      name: config.name,
      description: config.description,
      version: config.version,
      status: "registered",
      capabilities: config.capabilities.map((c) => ({ name: c, version: "1.0.0", description: c })),
      supportedModels: config.supportedModels,
      maxConcurrentTasks: config.maxConcurrentTasks,
      currentTaskCount: 0,
      priority: config.priority,
      costPerToken: config.costPerToken,
      averageLatency: 0,
      successRate: 1,
      lastHeartbeat: Date.now(),
      registeredAt: Date.now(),
      tags: [],
    };
  }

  async initialize(_config: AgentConfig): Promise<void> {
    this.startTime = Date.now();
    this.metadata = { ...this.metadata, status: "active" };
  }

  abstract execute(task: Task): Promise<TaskResult>;

  async cancel(taskId: string): Promise<void> {
    this.activeTasks.delete(taskId);
    this.metadata = { ...this.metadata, currentTaskCount: this.activeTasks.size, status: this.activeTasks.size === 0 ? "idle" : "busy" };
  }

  async pause(taskId: string): Promise<void> {
    this.metadata = { ...this.metadata, status: "busy" };
  }

  async resume(taskId: string): Promise<void> {
    this.metadata = { ...this.metadata, status: "busy" };
  }

  health(): AgentHealth {
    return {
      status: this.metadata.status === "error" ? "unhealthy" : "healthy",
      uptime: Date.now() - this.startTime,
      tasksCompleted: this.tasksCompleted,
      tasksFailed: this.tasksFailed,
      averageResponseTime: this.tasksCompleted > 0 ? this.totalResponseTime / this.tasksCompleted : 0,
      memoryUsage: 0,
      errorRate: this.tasksCompleted + this.tasksFailed > 0 ? this.tasksFailed / (this.tasksCompleted + this.tasksFailed) : 0,
    };
  }

  async shutdown(): Promise<void> {
    this.metadata = { ...this.metadata, status: "offline" };
    this.activeTasks.clear();
  }

  onMessage(handler: (message: AgentMessage) => void): () => void {
    this.messageHandlers.push(handler);
    return () => {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
    };
  }

  canHandle(task: Task): boolean {
    return task.constraints.requiredCapabilities.every(
      (cap) => this.config.capabilities.includes(cap),
    );
  }

  estimateCost(task: Task): number {
    return this.config.costPerToken * 1000;
  }

  estimateDuration(task: Task): number {
    return this.config.timeoutMs;
  }

  protected sendMessage(message: AgentMessage): void {
    for (const handler of this.messageHandlers) {
      handler(message);
    }
  }

  protected startTask(task: Task): void {
    this.activeTasks.set(task.id, task);
    this.metadata = { ...this.metadata, currentTaskCount: this.activeTasks.size, status: "busy" };
  }

  protected completeTask(taskId: string, result: TaskResult): void {
    this.activeTasks.delete(taskId);
    this.tasksCompleted++;
    this.totalResponseTime += result.duration;
    this.metadata = {
      ...this.metadata,
      currentTaskCount: this.activeTasks.size,
      status: this.activeTasks.size === 0 ? "idle" : "busy",
      averageLatency: this.totalResponseTime / this.tasksCompleted,
      successRate: this.tasksCompleted / (this.tasksCompleted + this.tasksFailed),
    };
  }

  protected failTask(taskId: string): void {
    this.activeTasks.delete(taskId);
    this.tasksFailed++;
    this.metadata = {
      ...this.metadata,
      currentTaskCount: this.activeTasks.size,
      status: this.activeTasks.size === 0 ? "idle" : "busy",
      successRate: this.tasksCompleted / (this.tasksCompleted + this.tasksFailed),
    };
  }

  protected generateId(): string {
    return `${this.config.id}_${++idCounter}`;
  }
}

// ─── Built-in Specialist Agents ───

export class CodingAgent extends BaseSpecialistAgent {
  constructor() {
    super({
      id: "coding",
      name: "Coding Agent",
      description: "Writes, edits, and refactors code",
      version: "1.0.0",
      capabilities: ["code_generation", "code_editing", "refactoring", " debugging"],
      supportedModels: ["qwen2.5-coder:7b", "gpt-4"],
      maxConcurrentTasks: 2,
      priority: 10,
      costPerToken: 0.00003,
      timeoutMs: 300000,
      model: "qwen2.5-coder:7b",
      systemPrompt: "You are a coding specialist.",
    });
  }

  async execute(task: Task): Promise<TaskResult> {
    const start = Date.now();
    this.startTask(task);
    const result: TaskResult = {
      success: true,
      output: { filesModified: [], linesChanged: 0 },
      summary: `Completed: ${task.objective}`,
      duration: Date.now() - start,
      tokenUsage: 0,
      cost: 0,
    };
    this.completeTask(task.id, result);
    return result;
  }
}

export class ResearchAgent extends BaseSpecialistAgent {
  constructor() {
    super({
      id: "research",
      name: "Research Agent",
      description: "Researches topics, gathers information, summarizes findings",
      version: "1.0.0",
      capabilities: ["research", "web_search", "summarization", "analysis"],
      supportedModels: ["qwen2.5-coder:7b", "gpt-4"],
      maxConcurrentTasks: 3,
      priority: 8,
      costPerToken: 0.00002,
      timeoutMs: 600000,
      model: "qwen2.5-coder:7b",
      systemPrompt: "You are a research specialist.",
    });
  }

  async execute(task: Task): Promise<TaskResult> {
    const start = Date.now();
    this.startTask(task);
    const result: TaskResult = {
      success: true,
      output: { sources: [], summary: "" },
      summary: `Research completed: ${task.objective}`,
      duration: Date.now() - start,
      tokenUsage: 0,
      cost: 0,
    };
    this.completeTask(task.id, result);
    return result;
  }
}

export class DocumentationAgent extends BaseSpecialistAgent {
  constructor() {
    super({
      id: "documentation",
      name: "Documentation Agent",
      description: "Writes and maintains documentation",
      version: "1.0.0",
      capabilities: ["documentation", "writing", "formatting"],
      supportedModels: ["qwen2.5-coder:7b"],
      maxConcurrentTasks: 2,
      priority: 6,
      costPerToken: 0.00002,
      timeoutMs: 300000,
      model: "qwen2.5-coder:7b",
      systemPrompt: "You are a documentation specialist.",
    });
  }

  async execute(task: Task): Promise<TaskResult> {
    const start = Date.now();
    this.startTask(task);
    const result: TaskResult = {
      success: true,
      output: { filesWritten: [] },
      summary: `Documentation completed: ${task.objective}`,
      duration: Date.now() - start,
      tokenUsage: 0,
      cost: 0,
    };
    this.completeTask(task.id, result);
    return result;
  }
}

export class TestingAgent extends BaseSpecialistAgent {
  constructor() {
    super({
      id: "testing",
      name: "Testing Agent",
      description: "Writes and runs tests",
      version: "1.0.0",
      capabilities: ["testing", "test_generation", "test_analysis"],
      supportedModels: ["qwen2.5-coder:7b"],
      maxConcurrentTasks: 2,
      priority: 9,
      costPerToken: 0.00002,
      timeoutMs: 300000,
      model: "qwen2.5-coder:7b",
      systemPrompt: "You are a testing specialist.",
    });
  }

  async execute(task: Task): Promise<TaskResult> {
    const start = Date.now();
    this.startTask(task);
    const result: TaskResult = {
      success: true,
      output: { testsWritten: 0, testsPassed: 0 },
      summary: `Testing completed: ${task.objective}`,
      duration: Date.now() - start,
      tokenUsage: 0,
      cost: 0,
    };
    this.completeTask(task.id, result);
    return result;
  }
}

export class GitAgent extends BaseSpecialistAgent {
  constructor() {
    super({
      id: "git",
      name: "Git Agent",
      description: "Manages git operations",
      version: "1.0.0",
      capabilities: ["git_operations", "branching", "merging"],
      supportedModels: ["qwen2.5-coder:7b"],
      maxConcurrentTasks: 1,
      priority: 8,
      costPerToken: 0.00001,
      timeoutMs: 120000,
      model: "qwen2.5-coder:7b",
      systemPrompt: "You are a git specialist.",
    });
  }

  async execute(task: Task): Promise<TaskResult> {
    const start = Date.now();
    this.startTask(task);
    const result: TaskResult = {
      success: true,
      output: { commits: [], branch: "" },
      summary: `Git operation completed: ${task.objective}`,
      duration: Date.now() - start,
      tokenUsage: 0,
      cost: 0,
    };
    this.completeTask(task.id, result);
    return result;
  }
}

export class DebugAgent extends BaseSpecialistAgent {
  constructor() {
    super({
      id: "debug",
      name: "Debug Agent",
      description: "Diagnoses and fixes bugs",
      version: "1.0.0",
      capabilities: ["debugging", "error_analysis", "root_cause_analysis"],
      supportedModels: ["qwen2.5-coder:7b", "gpt-4"],
      maxConcurrentTasks: 1,
      priority: 11,
      costPerToken: 0.00003,
      timeoutMs: 600000,
      model: "qwen2.5-coder:7b",
      systemPrompt: "You are a debugging specialist.",
    });
  }

  async execute(task: Task): Promise<TaskResult> {
    const start = Date.now();
    this.startTask(task);
    const result: TaskResult = {
      success: true,
      output: { rootCause: "", fix: "" },
      summary: `Debug completed: ${task.objective}`,
      duration: Date.now() - start,
      tokenUsage: 0,
      cost: 0,
    };
    this.completeTask(task.id, result);
    return result;
  }
}

export class ReviewAgent extends BaseSpecialistAgent {
  constructor() {
    super({
      id: "review",
      name: "Review Agent",
      description: "Reviews code and provides feedback",
      version: "1.0.0",
      capabilities: ["code_review", "quality_analysis", "security_review"],
      supportedModels: ["qwen2.5-coder:7b"],
      maxConcurrentTasks: 2,
      priority: 7,
      costPerToken: 0.00002,
      timeoutMs: 300000,
      model: "qwen2.5-coder:7b",
      systemPrompt: "You are a code review specialist.",
    });
  }

  async execute(task: Task): Promise<TaskResult> {
    const start = Date.now();
    this.startTask(task);
    const result: TaskResult = {
      success: true,
      output: { issues: [], score: 0 },
      summary: `Review completed: ${task.objective}`,
      duration: Date.now() - start,
      tokenUsage: 0,
      cost: 0,
    };
    this.completeTask(task.id, result);
    return result;
  }
}
