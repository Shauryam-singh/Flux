// Phase 6: Self-Evolution Shared Types

// --- Meta-Cognition Types ---

export type AnalysisCategory = "reasoning" | "planning" | "delegation" | "prediction" | "speech" | "tool_usage" | "interrupt" | "silence";

export interface SelfAnalysis {
  readonly id: string;
  readonly category: AnalysisCategory;
  readonly decisionId: string;
  readonly description: string;
  readonly reasoning: string;
  readonly quality: number;
  readonly improvements: ReadonlyArray<string>;
  readonly alternatives: ReadonlyArray<string>;
  readonly timestamp: number;
  readonly context: Record<string, unknown>;
}

export interface MetaCognitionInsight {
  readonly id: string;
  readonly type: "pattern" | "anomaly" | "recommendation" | "warning" | "strength";
  readonly message: string;
  readonly confidence: number;
  readonly evidence: ReadonlyArray<string>;
  readonly actionability: "high" | "medium" | "low";
  readonly timestamp: number;
}

// --- Strategy Types ---

export type StrategyType = "conservative" | "aggressive" | "minimal" | "teaching" | "research" | "coding" | "debugging" | "exploration" | "balanced";

export interface Strategy {
  readonly id: string;
  readonly name: string;
  readonly type: StrategyType;
  readonly description: string;
  readonly parameters: StrategyParameters;
  readonly successRate: number;
  readonly usageCount: number;
  readonly lastUsed: number;
  readonly createdAt: number;
  readonly tags: ReadonlyArray<string>;
}

export interface StrategyParameters {
  readonly riskTolerance: number;
  readonly verbosity: number;
  readonly autonomyLevel: number;
  readonly verificationLevel: number;
  readonly batchSize: number;
  readonly timeoutMultiplier: number;
  readonly retryAggressiveness: number;
  readonly costSensitivity: number;
}

export interface StrategyOutcome {
  readonly strategyId: string;
  readonly taskId: string;
  readonly success: boolean;
  readonly duration: number;
  readonly cost: number;
  readonly userSatisfaction: number;
  readonly timestamp: number;
}

// --- Experience Types ---

export type ExperienceOutcome = "success" | "partial" | "failure" | "timeout" | "cancelled";

export interface Experience {
  readonly id: string;
  readonly situation: string;
  readonly decision: string;
  readonly outcome: ExperienceOutcome;
  readonly confidence: number;
  readonly actualResult: Record<string, unknown>;
  readonly userFeedback: string | null;
  readonly successScore: number;
  readonly recommendation: string;
  readonly strategyUsed: string | null;
  readonly duration: number;
  readonly cost: number;
  readonly tags: ReadonlyArray<string>;
  readonly timestamp: number;
  readonly context: Record<string, unknown>;
}

export interface ExperienceQuery {
  readonly situation?: string;
  readonly outcome?: ExperienceOutcome;
  readonly minSuccessScore?: number;
  readonly tags?: ReadonlyArray<string>;
  readonly limit?: number;
  readonly since?: number;
}

// --- Adaptive Planner Types ---

export interface DurationEstimate {
  readonly taskType: string;
  readonly estimatedMs: number;
  readonly confidence: number;
  readonly sampleSize: number;
  readonly p50Ms: number;
  readonly p90Ms: number;
}

export interface PlanTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly pattern: string;
  readonly taskTypes: ReadonlyArray<string>;
  readonly averageDuration: number;
  readonly successRate: number;
  readonly usageCount: number;
  readonly steps: ReadonlyArray<PlanStep>;
  readonly createdAt: number;
}

export interface PlanStep {
  readonly name: string;
  readonly taskType: string;
  readonly dependencies: ReadonlyArray<string>;
  readonly estimatedMs: number;
  readonly requiredCapabilities: ReadonlyArray<string>;
}

// --- Workflow Discovery Types ---

export type WorkflowCategory = "git" | "release" | "study" | "research" | "debug" | "deploy" | "review" | "custom";

export interface WorkflowPattern {
  readonly id: string;
  readonly name: string;
  readonly category: WorkflowCategory;
  readonly description: string;
  readonly steps: ReadonlyArray<WorkflowStep>;
  readonly frequency: number;
  readonly lastObserved: number;
  readonly firstObserved: number;
  readonly confidence: number;
  readonly automatable: boolean;
}

export interface WorkflowStep {
  readonly action: string;
  readonly tool: string;
  readonly parameters: Record<string, unknown>;
  readonly order: number;
  readonly optional: boolean;
}

export interface WorkflowTemplate {
  readonly id: string;
  readonly patternId: string;
  readonly name: string;
  readonly description: string;
  readonly steps: ReadonlyArray<WorkflowStep>;
  readonly estimatedDuration: number;
  readonly successRate: number;
  readonly usageCount: number;
  readonly createdAt: number;
}

// --- Skill Types ---

export interface Skill {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly steps: ReadonlyArray<string>;
  readonly prerequisites: ReadonlyArray<string>;
  readonly successCount: number;
  readonly failureCount: number;
  readonly averageDuration: number;
  readonly confidence: number;
  readonly source: "discovered" | "manual" | "composed";
  readonly composedFrom: ReadonlyArray<string>;
  readonly tags: ReadonlyArray<string>;
  readonly createdAt: number;
  readonly lastUsed: number;
}

// --- Knowledge Types ---

export type KnowledgeType = "fact" | "preference" | "procedure" | "pattern" | "constraint" | "context";

export interface Knowledge {
  readonly id: string;
  readonly type: KnowledgeType;
  readonly content: string;
  readonly confidence: number;
  readonly strength: number;
  readonly accessCount: number;
  readonly lastAccessed: number;
  readonly source: string;
  readonly decayRate: number;
  readonly createdAt: number;
  readonly tags: ReadonlyArray<string>;
  readonly relatedIds: ReadonlyArray<string>;
  readonly composedFrom: ReadonlyArray<string>;
}

// --- Confidence Calibration Types ---

export interface ConfidenceRecord {
  readonly id: string;
  readonly domain: string;
  readonly predictedConfidence: number;
  readonly actualOutcome: boolean;
  readonly calibrationError: number;
  readonly timestamp: number;
  readonly context: Record<string, unknown>;
}

export interface CalibrationBucket {
  readonly lowerBound: number;
  readonly upperBound: number;
  readonly predictions: number;
  readonly correct: number;
  readonly averageConfidence: number;
  readonly actualAccuracy: number;
  readonly calibrationError: number;
}

// --- Self-Evaluation Types ---

export type EvaluationDimension = "planning" | "delegation" | "prediction" | "interrupt" | "speech" | "tool_usage" | "overall";

export interface EvaluationReport {
  readonly id: string;
  readonly goalId: string;
  readonly dimensions: ReadonlyArray<EvaluationDimensionScore>;
  readonly overallScore: number;
  readonly strengths: ReadonlyArray<string>;
  readonly weaknesses: ReadonlyArray<string>;
  readonly recommendations: ReadonlyArray<string>;
  readonly timestamp: number;
}

export interface EvaluationDimensionScore {
  readonly dimension: EvaluationDimension;
  readonly score: number;
  readonly evidence: ReadonlyArray<string>;
  readonly improvementSuggestions: ReadonlyArray<string>;
}

// --- Habit Types ---

export type HabitCategory = "coding" | "scheduling" | "communication" | "research" | "navigation" | "tool_preference";

export interface Habit {
  readonly id: string;
  readonly category: HabitCategory;
  readonly description: string;
  readonly pattern: string;
  readonly frequency: number;
  readonly confidence: number;
  readonly lastObserved: number;
  readonly firstObserved: number;
  readonly examples: ReadonlyArray<string>;
}

// --- Automation Types ---

export interface AutomationProposal {
  readonly id: string;
  readonly workflowPatternId: string;
  readonly name: string;
  readonly description: string;
  readonly trigger: string;
  readonly steps: ReadonlyArray<WorkflowStep>;
  readonly estimatedTimeSaved: number;
  readonly confidence: number;
  readonly status: "proposed" | "approved" | "active" | "rejected" | "disabled";
  readonly createdAt: number;
}

// --- Cognitive Health Types ---

export type HealthMetric = "memory_size" | "reasoning_latency" | "prediction_accuracy" | "goal_success_rate" | "agent_performance" | "resource_usage" | "knowledge_freshness" | "calibration_error";

export interface HealthStatus {
  readonly overall: "healthy" | "warning" | "critical";
  readonly metrics: ReadonlyArray<HealthMetricStatus>;
  readonly alerts: ReadonlyArray<HealthAlert>;
  readonly recommendations: ReadonlyArray<string>;
  readonly timestamp: number;
}

export interface HealthMetricStatus {
  readonly metric: HealthMetric;
  readonly value: number;
  readonly status: "normal" | "warning" | "critical";
  readonly trend: "improving" | "stable" | "declining";
  readonly threshold: number;
}

export interface HealthAlert {
  readonly id: string;
  readonly metric: HealthMetric;
  readonly severity: "info" | "warning" | "critical";
  readonly message: string;
  readonly timestamp: number;
  readonly recommendation: string;
}

// --- Simulation Types ---

export interface SimulationScenario {
  readonly id: string;
  readonly planId: string;
  readonly name: string;
  readonly description: string;
  readonly steps: ReadonlyArray<SimulationStep>;
  readonly estimatedDuration: number;
  readonly estimatedCost: number;
  readonly riskLevel: number;
  readonly successProbability: number;
}

export interface SimulationStep {
  readonly name: string;
  readonly action: string;
  readonly estimatedDuration: number;
  readonly riskLevel: number;
  readonly successProbability: number;
  readonly rollbackAction: string | null;
  readonly sideEffects: ReadonlyArray<string>;
}

export interface SimulationResult {
  readonly scenarioId: string;
  readonly completed: boolean;
  readonly actualDuration: number;
  readonly actualCost: number;
  readonly actualRisk: number;
  readonly failures: ReadonlyArray<SimulationFailure>;
  readonly timestamp: number;
}

export interface SimulationFailure {
  readonly stepIndex: number;
  readonly reason: string;
  readonly recoverable: boolean;
}

// --- Research Types ---

export type ResearchStatus = "idle" | "gathering" | "analyzing" | "summarizing" | "complete";

export interface ResearchTopic {
  readonly id: string;
  readonly query: string;
  readonly status: ResearchStatus;
  readonly findings: ReadonlyArray<ResearchFinding>;
  readonly sources: ReadonlyArray<ResearchSource>;
  readonly summary: string | null;
  readonly recommendations: ReadonlyArray<string>;
  readonly confidence: number;
  readonly createdAt: number;
  readonly completedAt: number | null;
}

export interface ResearchFinding {
  readonly id: string;
  readonly content: string;
  readonly source: string;
  readonly relevance: number;
  readonly reliability: number;
  readonly timestamp: number;
}

export interface ResearchSource {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly type: "web" | "documentation" | "code" | "internal";
  readonly reliability: number;
  readonly accessedAt: number;
}

// --- Self-Evolution Config ---

export interface SelfEvolutionConfig {
  readonly enabled: boolean;
  readonly maxExperiences: number;
  readonly maxKnowledge: number;
  readonly maxSkills: number;
  readonly decayIntervalMs: number;
  readonly consolidationIntervalMs: number;
  readonly healthCheckIntervalMs: number;
  readonly evaluationIntervalMs: number;
  readonly autoApplyStrategies: boolean;
  readonly maxStrategyAdaptations: number;
  readonly confidenceCalibrationEnabled: boolean;
  readonly researchModeEnabled: boolean;
  readonly simulationEnabled: boolean;
}
