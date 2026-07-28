import type { SelfEvolutionCore } from "../interfaces/self-evolution-core.js";
import type { SelfEvolutionConfig, HealthStatus, EvaluationReport } from "@ai-agent/evo-types";
import { DefaultMetaCognitionEngine } from "@ai-agent/meta-cognition";
import { DefaultStrategyLibrary } from "@ai-agent/strategy-library";
import { DefaultExperienceDatabase } from "@ai-agent/experience-db";
import { DefaultAdaptivePlanner } from "@ai-agent/adaptive-planner";
import { DefaultWorkflowDiscovery } from "@ai-agent/workflow-discovery";
import { DefaultSkillLibrary } from "@ai-agent/skill-library";
import { DefaultKnowledgeConsolidation } from "@ai-agent/knowledge-consolidation";
import { DefaultConfidenceCalibration } from "@ai-agent/confidence-calibration";
import { DefaultSelfEvaluation } from "@ai-agent/self-evaluation";
import { DefaultHabitDiscovery } from "@ai-agent/habit-discovery";
import { DefaultAutomationBuilder } from "@ai-agent/automation-builder";
import { DefaultCognitiveHealthMonitor } from "@ai-agent/cognitive-health";
import { DefaultSimulationEngine } from "@ai-agent/simulation-engine";
import { DefaultResearchMode } from "@ai-agent/research-mode";

const DEFAULT_CONFIG: SelfEvolutionConfig = {
  enabled: true,
  maxExperiences: 10000,
  maxKnowledge: 5000,
  maxSkills: 500,
  decayIntervalMs: 86400000,
  consolidationIntervalMs: 604800000,
  healthCheckIntervalMs: 3600000,
  evaluationIntervalMs: 86400000,
  autoApplyStrategies: false,
  maxStrategyAdaptations: 10,
  confidenceCalibrationEnabled: true,
  researchModeEnabled: true,
  simulationEnabled: true,
};

export class DefaultSelfEvolutionCore implements SelfEvolutionCore {
  private config: SelfEvolutionConfig;
  private readonly metaCognition: DefaultMetaCognitionEngine;
  private readonly strategyLibrary: DefaultStrategyLibrary;
  private readonly experienceDb: DefaultExperienceDatabase;
  private readonly adaptivePlanner: DefaultAdaptivePlanner;
  private readonly workflowDiscovery: DefaultWorkflowDiscovery;
  private readonly skillLibrary: DefaultSkillLibrary;
  private readonly knowledgeConsolidation: DefaultKnowledgeConsolidation;
  private readonly confidenceCalibration: DefaultConfidenceCalibration;
  private readonly selfEvaluation: DefaultSelfEvaluation;
  private readonly habitDiscovery: DefaultHabitDiscovery;
  private readonly automationBuilder: DefaultAutomationBuilder;
  private readonly cognitiveHealth: DefaultCognitiveHealthMonitor;
  private readonly simulationEngine: DefaultSimulationEngine;
  private readonly researchMode: DefaultResearchMode;
  private lastHealthCheck = 0;
  private lastConsolidation = 0;
  private evaluations: EvaluationReport[] = [];

  constructor(configOverrides?: Partial<SelfEvolutionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...configOverrides };
    this.metaCognition = new DefaultMetaCognitionEngine();
    this.strategyLibrary = new DefaultStrategyLibrary();
    this.experienceDb = new DefaultExperienceDatabase();
    this.adaptivePlanner = new DefaultAdaptivePlanner();
    this.workflowDiscovery = new DefaultWorkflowDiscovery();
    this.skillLibrary = new DefaultSkillLibrary();
    this.knowledgeConsolidation = new DefaultKnowledgeConsolidation();
    this.confidenceCalibration = new DefaultConfidenceCalibration();
    this.selfEvaluation = new DefaultSelfEvaluation();
    this.habitDiscovery = new DefaultHabitDiscovery();
    this.automationBuilder = new DefaultAutomationBuilder();
    this.cognitiveHealth = new DefaultCognitiveHealthMonitor();
    this.simulationEngine = new DefaultSimulationEngine();
    this.researchMode = new DefaultResearchMode();
  }

  configure(config: Partial<SelfEvolutionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): SelfEvolutionConfig {
    return this.config;
  }

  getHealth(): HealthStatus {
    return {
      overall: "healthy",
      metrics: [],
      alerts: [],
      recommendations: [],
      timestamp: Date.now(),
    };
  }

  runHealthCheck(): HealthStatus {
    const health = this.getHealth();
    this.lastHealthCheck = Date.now();
    return health;
  }

  getRecentEvaluations(count?: number): ReadonlyArray<EvaluationReport> {
    const sorted = [...this.evaluations].sort((a, b) => b.timestamp - a.timestamp);
    return count !== undefined ? sorted.slice(0, count) : sorted;
  }

  getStatus(): {
    readonly totalExperiences: number;
    readonly totalKnowledge: number;
    readonly totalSkills: number;
    readonly totalWorkflows: number;
    readonly totalStrategies: number;
    readonly healthOverall: "healthy" | "degraded" | "critical";
  } {
    return {
      totalExperiences: 0,
      totalKnowledge: 0,
      totalSkills: 0,
      totalWorkflows: 0,
      totalStrategies: 0,
      healthOverall: "healthy",
    };
  }

  consolidate(): number {
    this.lastConsolidation = Date.now();
    return 0;
  }

  tick(): void {
    const now = Date.now();
    if (now - this.lastHealthCheck >= this.config.healthCheckIntervalMs) {
      this.runHealthCheck();
    }
    if (now - this.lastConsolidation >= this.config.consolidationIntervalMs) {
      this.consolidate();
    }
  }
}
