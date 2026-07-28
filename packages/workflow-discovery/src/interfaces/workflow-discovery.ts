import type { WorkflowPattern, WorkflowStep, WorkflowTemplate, WorkflowCategory } from "@ai-agent/evo-types";

export interface WorkflowDiscovery {
  recordStep(action: string, tool: string, parameters: Record<string, unknown>): void;
  detectPatterns(minFrequency?: number): ReadonlyArray<WorkflowPattern>;
  getPattern(patternId: string): WorkflowPattern | null;
  getAllPatterns(): ReadonlyArray<WorkflowPattern>;
  getPatternsByCategory(category: WorkflowCategory): ReadonlyArray<WorkflowPattern>;
  createTemplate(patternId: string, name: string, description: string): WorkflowTemplate;
  getTemplate(templateId: string): WorkflowTemplate | null;
  getTemplates(): ReadonlyArray<WorkflowTemplate>;
  deleteTemplate(templateId: string): void;
  getRecentSteps(count: number): ReadonlyArray<WorkflowStep>;
}
