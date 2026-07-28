import type { WorkflowDiscovery } from "../interfaces/workflow-discovery.js";
import type { WorkflowPattern, WorkflowStep, WorkflowTemplate, WorkflowCategory } from "@ai-agent/evo-types";

export class DefaultWorkflowDiscovery implements WorkflowDiscovery {
  private steps: WorkflowStep[] = [];
  private patterns: Map<string, WorkflowPattern> = new Map();
  private templates: Map<string, WorkflowTemplate> = new Map();
  private patternCounter = 0;
  private templateCounter = 0;

  recordStep(action: string, tool: string, parameters: Record<string, unknown>): void {
    const step: WorkflowStep = {
      action,
      tool,
      parameters,
      order: this.steps.length,
      optional: false,
    };
    this.steps.push(step);
  }

  detectPatterns(minFrequency: number = 2): ReadonlyArray<WorkflowPattern> {
    const sequences = new Map<string, { steps: WorkflowStep[]; count: number; firstSeen: number; lastSeen: number }>();

    for (let i = 0; i < this.steps.length; i++) {
      for (let len = 2; len <= Math.min(10, this.steps.length - i); len++) {
        const seq = this.steps.slice(i, i + len);
        const key = seq.map((s) => `${s.action}:${s.tool}`).join("|");
        const existing = sequences.get(key);
        if (existing) {
          sequences.set(key, {
            steps: seq,
            count: existing.count + 1,
            firstSeen: existing.firstSeen,
            lastSeen: Date.now(),
          });
        } else {
          sequences.set(key, {
            steps: seq,
            count: 1,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
          });
        }
      }
    }

    this.patterns.clear();
    for (const [key, entry] of sequences) {
      if (entry.count >= minFrequency) {
        const id = `wp_${++this.patternCounter}`;
        const pattern: WorkflowPattern = {
          id,
          name: key,
          category: "custom",
          description: `Detected pattern: ${key}`,
          steps: entry.steps,
          frequency: entry.count,
          lastObserved: entry.lastSeen,
          firstObserved: entry.firstSeen,
          confidence: Math.min(1, entry.count / 10),
          automatable: entry.count >= 5,
        };
        this.patterns.set(id, pattern);
      }
    }

    return Array.from(this.patterns.values());
  }

  getPattern(patternId: string): WorkflowPattern | null {
    return this.patterns.get(patternId) ?? null;
  }

  getAllPatterns(): ReadonlyArray<WorkflowPattern> {
    return Array.from(this.patterns.values());
  }

  getPatternsByCategory(category: WorkflowCategory): ReadonlyArray<WorkflowPattern> {
    return Array.from(this.patterns.values()).filter((p) => p.category === category);
  }

  createTemplate(patternId: string, name: string, description: string): WorkflowTemplate {
    const pattern = this.patterns.get(patternId);
    if (!pattern) throw new Error(`Pattern not found: ${patternId}`);

    const id = `wt_${++this.templateCounter}`;
    const now = Date.now();
    const template: WorkflowTemplate = {
      id,
      patternId,
      name,
      description,
      steps: pattern.steps,
      estimatedDuration: 0,
      successRate: 1,
      usageCount: 0,
      createdAt: now,
    };
    this.templates.set(id, template);
    return template;
  }

  getTemplate(templateId: string): WorkflowTemplate | null {
    return this.templates.get(templateId) ?? null;
  }

  getTemplates(): ReadonlyArray<WorkflowTemplate> {
    return Array.from(this.templates.values());
  }

  deleteTemplate(templateId: string): void {
    this.templates.delete(templateId);
  }

  getRecentSteps(count: number): ReadonlyArray<WorkflowStep> {
    return this.steps.slice(-count);
  }
}
