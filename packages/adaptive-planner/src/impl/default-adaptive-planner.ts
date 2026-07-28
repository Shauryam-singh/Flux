import type { DurationEstimate, PlanTemplate, PlanStep } from "@ai-agent/evo-types";
import type { AdaptivePlanner } from "../interfaces/adaptive-planner.js";

let templateCounter = 0;

interface DurationSample {
  readonly estimatedMs: number;
  readonly actualMs: number;
}

export class DefaultAdaptivePlanner implements AdaptivePlanner {
  private readonly durations = new Map<string, DurationSample[]>();
  private readonly templates = new Map<string, PlanTemplate>();

  recordDuration(taskType: string, estimatedMs: number, actualMs: number): void {
    const samples = this.durations.get(taskType) ?? [];
    samples.push({ estimatedMs, actualMs });
    this.durations.set(taskType, samples);
  }

  getEstimate(taskType: string): DurationEstimate | null {
    const samples = this.durations.get(taskType);
    if (samples === undefined || samples.length === 0) return null;

    const sorted = [...samples]
      .map((s) => s.actualMs)
      .sort((a, b) => a - b);

    const p50Index = Math.min(Math.ceil(0.5 * sorted.length) - 1, sorted.length - 1);
    const p90Index = Math.min(Math.ceil(0.9 * sorted.length) - 1, sorted.length - 1);

    const avgEstimated = samples.reduce((sum, s) => sum + s.estimatedMs, 0) / samples.length;
    const avgActual = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
    const accuracy = avgEstimated > 0 ? 1 - Math.abs(avgEstimated - avgActual) / avgEstimated : 1;

    return {
      taskType,
      estimatedMs: Math.round(avgEstimated),
      confidence: Math.max(0, Math.min(1, accuracy)),
      sampleSize: sorted.length,
      p50Ms: sorted[p50Index] ?? 0,
      p90Ms: sorted[p90Index] ?? sorted[sorted.length - 1] ?? 0,
    };
  }

  getAllEstimates(): ReadonlyArray<DurationEstimate> {
    return [...this.durations.keys()]
      .map((taskType) => this.getEstimate(taskType))
      .filter((e): e is DurationEstimate => e !== null);
  }

  saveTemplate(name: string, description: string, pattern: string, taskTypes: ReadonlyArray<string>, steps: ReadonlyArray<PlanStep>): PlanTemplate {
    const avgDuration = steps.reduce((sum, s) => sum + s.estimatedMs, 0);
    const template: PlanTemplate = {
      id: `pt_${++templateCounter}`,
      name,
      description,
      pattern,
      taskTypes,
      averageDuration: avgDuration,
      successRate: 0,
      usageCount: 0,
      steps,
      createdAt: Date.now(),
    };
    this.templates.set(template.id, template);
    return template;
  }

  getTemplate(templateId: string): PlanTemplate | null {
    return this.templates.get(templateId) ?? null;
  }

  getTemplates(): ReadonlyArray<PlanTemplate> {
    return [...this.templates.values()];
  }

  getTemplatesByPattern(pattern: string): ReadonlyArray<PlanTemplate> {
    return [...this.templates.values()].filter((t) => t.pattern === pattern);
  }

  deleteTemplate(templateId: string): void {
    this.templates.delete(templateId);
  }

  predictBlockers(taskTypes: ReadonlyArray<string>): ReadonlyArray<string> {
    const blockers: string[] = [];
    for (const taskType of taskTypes) {
      const estimate = this.getEstimate(taskType);
      if (estimate === null) continue;
      if (estimate.p90Ms > estimate.p50Ms * 2) {
        blockers.push(`${taskType} has high variance (p90 is >2x p50)`);
      }
    }
    return blockers;
  }
}
