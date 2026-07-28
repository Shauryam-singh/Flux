import type { DurationEstimate, PlanTemplate, PlanStep } from "@ai-agent/evo-types";

export interface AdaptivePlanner {
  recordDuration(taskType: string, estimatedMs: number, actualMs: number): void;
  getEstimate(taskType: string): DurationEstimate | null;
  getAllEstimates(): ReadonlyArray<DurationEstimate>;
  saveTemplate(name: string, description: string, pattern: string, taskTypes: ReadonlyArray<string>, steps: ReadonlyArray<PlanStep>): PlanTemplate;
  getTemplate(templateId: string): PlanTemplate | null;
  getTemplates(): ReadonlyArray<PlanTemplate>;
  getTemplatesByPattern(pattern: string): ReadonlyArray<PlanTemplate>;
  deleteTemplate(templateId: string): void;
  predictBlockers(taskTypes: ReadonlyArray<string>): ReadonlyArray<string>;
}
