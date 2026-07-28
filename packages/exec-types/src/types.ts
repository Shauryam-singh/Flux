// Phase 5: Executive Intelligence Shared Types

// ─── Agent Protocol Messages ───

export type MessageType =
  | "task_request"
  | "task_progress"
  | "task_blocked"
  | "task_completed"
  | "task_failed"
  | "need_information"
  | "need_approval"
  | "suggestion"
  | "heartbeat"
  | "cancel"
  | "pause"
  | "resume";

export interface AgentMessage {
  readonly id: string;
  readonly type: MessageType;
  readonly from: string;
  readonly to: string;
  readonly taskId: string;
  readonly timestamp: number;
  readonly payload: Record<string, unknown>;
  readonly correlationId: string | null;
}

export interface TaskRequest extends AgentMessage {
  readonly type: "task_request";
  readonly payload: {
    readonly objective: string;
    readonly context: Record<string, unknown>;
    readonly constraints: TaskConstraints;
    readonly parentId: string | null;
  };
}

export interface TaskProgress extends AgentMessage {
  readonly type: "task_progress";
  readonly payload: {
    readonly progress: number;
    readonly message: string;
    readonly intermediateResults: Record<string, unknown>;
  };
}

export interface TaskBlocked extends AgentMessage {
  readonly type: "task_blocked";
  readonly payload: {
    readonly reason: string;
    readonly blockedBy: string | null;
    readonly neededInformation: ReadonlyArray<string>;
  };
}

export interface TaskCompleted extends AgentMessage {
  readonly type: "task_completed";
  readonly payload: {
    readonly result: TaskResult;
    readonly artifacts: ReadonlyArray<TaskArtifact>;
  };
}

export interface TaskFailed extends AgentMessage {
  readonly type: "task_failed";
  readonly payload: {
    readonly error: string;
    readonly errorCode: string;
    readonly retryable: boolean;
    readonly partialResults: Record<string, unknown>;
  };
}

export interface NeedInformation extends AgentMessage {
  readonly type: "need_information";
  readonly payload: {
    readonly question: string;
    readonly options: ReadonlyArray<string> | null;
    readonly context: Record<string, unknown>;
  };
}

export interface NeedApproval extends AgentMessage {
  readonly type: "need_approval";
  readonly payload: {
    readonly action: string;
    readonly risk: "low" | "medium" | "high" | "critical";
    readonly reversible: boolean;
    readonly details: Record<string, unknown>;
  };
}

export interface Suggestion extends AgentMessage {
  readonly type: "suggestion";
  readonly payload: {
    readonly suggestion: string;
    readonly confidence: number;
    readonly reasoning: string;
    readonly alternatives: ReadonlyArray<string>;
  };
}

export interface Heartbeat extends AgentMessage {
  readonly type: "heartbeat";
  readonly payload: {
    readonly agentId: string;
    readonly status: "active" | "idle" | "busy" | "error";
    readonly currentTaskId: string | null;
    readonly memoryUsage: number;
  };
}

// ─── Task Types ───

export type TaskStatus =
  | "created"
  | "queued"
  | "assigned"
  | "running"
  | "blocked"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"
  | "retrying";

export type TaskPriority = "critical" | "high" | "normal" | "low" | "background";

export type TaskRisk = "automatic" | "low" | "medium" | "high" | "critical";

export interface TaskConstraints {
  readonly maxDurationMs: number | null;
  readonly maxRetries: number;
  readonly timeoutMs: number;
  readonly requiredCapabilities: ReadonlyArray<string>;
  readonly excludedAgents: ReadonlyArray<string>;
  readonly preferredAgents: ReadonlyArray<string>;
  readonly modelPreference: string | null;
  readonly costLimit: number | null;
}

export interface TaskResult {
  readonly success: boolean;
  readonly output: Record<string, unknown>;
  readonly summary: string;
  readonly duration: number;
  readonly tokenUsage: number;
  readonly cost: number;
}

export interface TaskArtifact {
  readonly type: "file" | "code" | "text" | "data" | "url";
  readonly path: string;
  readonly content: string;
  readonly metadata: Record<string, unknown>;
}

export interface Task {
  readonly id: string;
  readonly objective: string;
  readonly description: string;
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly progress: number;
  readonly assignedAgent: string | null;
  readonly parentId: string | null;
  readonly subtaskIds: ReadonlyArray<string>;
  readonly dependencies: ReadonlyArray<string>;
  readonly constraints: TaskConstraints;
  readonly result: TaskResult | null;
  readonly artifacts: ReadonlyArray<TaskArtifact>;
  readonly error: string | null;
  readonly retryCount: number;
  readonly createdAt: number;
  readonly startedAt: number | null;
  readonly completedAt: number | null;
  readonly updatedAt: number;
  readonly metadata: Record<string, unknown>;
}

// ─── Task Graph Types ───

export type GraphNodeType = "task" | "gate" | "merge" | "split" | "condition" | "fallback";

export interface GraphNode {
  readonly id: string;
  readonly type: GraphNodeType;
  readonly taskId: string | null;
  readonly label: string;
  readonly metadata: Record<string, unknown>;
}

export interface GraphEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly condition: string | null;
  readonly isFallback: boolean;
  readonly metadata: Record<string, unknown>;
}

export interface TaskGraph {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly nodes: ReadonlyArray<GraphNode>;
  readonly edges: ReadonlyArray<GraphEdge>;
  readonly status: "draft" | "active" | "paused" | "completed" | "failed";
  readonly progress: number;
  readonly createdAt: number;
  readonly updatedAt: number;
}

// ─── Agent Types ───

export type AgentStatus = "registered" | "active" | "busy" | "idle" | "disabled" | "error" | "offline";

export interface AgentCapability {
  readonly name: string;
  readonly version: string;
  readonly description: string;
}

export interface AgentMetadata {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly status: AgentStatus;
  readonly capabilities: ReadonlyArray<AgentCapability>;
  readonly supportedModels: ReadonlyArray<string>;
  readonly maxConcurrentTasks: number;
  readonly currentTaskCount: number;
  readonly priority: number;
  readonly costPerToken: number;
  readonly averageLatency: number;
  readonly successRate: number;
  readonly lastHeartbeat: number;
  readonly registeredAt: number;
  readonly tags: ReadonlyArray<string>;
}

export interface AgentHealth {
  readonly status: "healthy" | "degraded" | "unhealthy";
  readonly uptime: number;
  readonly tasksCompleted: number;
  readonly tasksFailed: number;
  readonly averageResponseTime: number;
  readonly memoryUsage: number;
  readonly errorRate: number;
}

// ─── Delegation Types ───

export interface DelegationDecision {
  readonly agentId: string;
  readonly model: string;
  readonly priority: TaskPriority;
  readonly timeoutMs: number;
  readonly retryStrategy: RetryStrategy;
  readonly costEstimate: number;
  readonly latencyEstimate: number;
  readonly reasoning: string;
}

export interface RetryStrategy {
  readonly maxRetries: number;
  readonly backoffMs: number;
  readonly backoffMultiplier: number;
  readonly maxBackoffMs: number;
  readonly retryableErrors: ReadonlyArray<string>;
}

// ─── Resource Types ───

export interface ResourceAllocation {
  readonly agentId: string;
  readonly taskId: string;
  readonly tokens: number;
  readonly cpuShares: number;
  readonly memoryMb: number;
  readonly gpuShares: number;
  readonly allocatedAt: number;
  readonly expiresAt: number;
}

export interface ResourceBudget {
  readonly totalTokens: number;
  readonly usedTokens: number;
  readonly totalCostUsd: number;
  readonly usedCostUsd: number;
  readonly concurrentAgents: number;
  readonly maxConcurrentAgents: number;
  readonly tokensPerMinute: number;
  readonly tokensUsedThisMinute: number;
  readonly resetAt: number;
}

// ─── Approval Types ───

export type ApprovalPolicy = "automatic" | "ask" | "deny";

export interface ApprovalRequest {
  readonly id: string;
  readonly taskId: string;
  readonly agentId: string;
  readonly action: string;
  readonly risk: TaskRisk;
  readonly reversible: boolean;
  readonly impact: string;
  readonly details: Record<string, unknown>;
  readonly policy: ApprovalPolicy;
  readonly status: "pending" | "approved" | "denied" | "expired";
  readonly createdAt: number;
  readonly respondedAt: number | null;
  readonly response: string | null;
}

export interface ApprovalRule {
  readonly id: string;
  readonly name: string;
  readonly match: (action: string, risk: TaskRisk) => boolean;
  readonly policy: ApprovalPolicy;
  readonly priority: number;
}

// ─── Verification Types ───

export type VerificationType =
  | "code_review"
  | "unit_test"
  | "static_analysis"
  | "security_scan"
  | "fact_check"
  | "consistency_check"
  | "performance_test"
  | "integration_test";

export interface VerificationResult {
  readonly id: string;
  readonly taskId: string;
  readonly type: VerificationType;
  readonly passed: boolean;
  readonly score: number;
  readonly issues: ReadonlyArray<VerificationIssue>;
  readonly duration: number;
  readonly timestamp: number;
}

export interface VerificationIssue {
  readonly severity: "info" | "warning" | "error" | "critical";
  readonly message: string;
  readonly file: string | null;
  readonly line: number | null;
  readonly rule: string | null;
  readonly suggestion: string | null;
}

export interface VerificationRule {
  readonly type: VerificationType;
  readonly required: boolean;
  readonly minScore: number;
  readonly timeout: number;
}

// ─── Background Project Types ───

export type ProjectStatus = "active" | "paused" | "completed" | "failed" | "cancelled";

export interface BackgroundProject {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly status: ProjectStatus;
  readonly schedule: ProjectSchedule;
  readonly tasks: ReadonlyArray<string>;
  readonly lastRun: number | null;
  readonly nextRun: number | null;
  readonly runCount: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface ProjectSchedule {
  readonly type: "interval" | "cron" | "event" | "manual";
  readonly intervalMs: number | null;
  readonly cronExpression: string | null;
  readonly eventTrigger: string | null;
  readonly enabled: boolean;
}

// ─── Long-running Goal Types ───

export type LongGoalStatus = "planning" | "active" | "in_progress" | "blocked" | "paused" | "completed" | "failed" | "cancelled";

export interface LongGoal {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: LongGoalStatus;
  readonly priority: TaskPriority;
  readonly progress: number;
  readonly subgoalIds: ReadonlyArray<string>;
  readonly taskGraphId: string | null;
  readonly milestones: ReadonlyArray<Milestone>;
  readonly checkpoints: ReadonlyArray<Checkpoint>;
  readonly estimatedDuration: number | null;
  readonly actualDuration: number | null;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly completedAt: number | null;
  readonly pausedAt: number | null;
  readonly resumeAt: number | null;
  readonly metadata: Record<string, unknown>;
  readonly tags: ReadonlyArray<string>;
}

export interface Milestone {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly completed: boolean;
  readonly completedAt: number | null;
  readonly requiredTaskIds: ReadonlyArray<string>;
}

export interface Checkpoint {
  readonly id: string;
  readonly timestamp: number;
  readonly state: Record<string, unknown>;
  readonly summary: string;
  readonly goalProgress: number;
}

// ─── Executive Types ───

export interface ExecutiveState {
  readonly activeTasks: number;
  readonly queuedTasks: number;
  readonly completedTasks: number;
  readonly failedTasks: number;
  readonly activeAgents: number;
  readonly totalAgents: number;
  readonly resourceBudget: ResourceBudget;
  readonly pendingApprovals: number;
  readonly activeGoals: number;
  readonly backgroundProjects: number;
  readonly uptime: number;
}

export interface ExecutiveConfig {
  readonly enabled: boolean;
  readonly maxConcurrentTasks: number;
  readonly maxQueuedTasks: number;
  readonly defaultTimeoutMs: number;
  readonly defaultMaxRetries: number;
  readonly autoApproveLowRisk: boolean;
  readonly enableVerification: boolean;
  readonly enableBackgroundProjects: boolean;
  readonly heartbeatIntervalMs: number;
  readonly checkpointIntervalMs: number;
  readonly resourceBudgetTokens: number;
  readonly resourceBudgetCostUsd: number;
}
