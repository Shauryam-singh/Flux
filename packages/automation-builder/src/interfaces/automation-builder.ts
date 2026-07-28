import type { AutomationProposal, WorkflowStep } from "@ai-agent/evo-types";

export interface AutomationBuilder {
  propose(
    workflowPatternId: string,
    name: string,
    description: string,
    trigger: string,
    steps: ReadonlyArray<WorkflowStep>,
    estimatedTimeSaved: number,
    confidence: number
  ): AutomationProposal;
  get(proposalId: string): AutomationProposal | null;
  getAll(): ReadonlyArray<AutomationProposal>;
  getProposed(): ReadonlyArray<AutomationProposal>;
  getActive(): ReadonlyArray<AutomationProposal>;
  approve(proposalId: string): void;
  reject(proposalId: string): void;
  disable(proposalId: string): void;
  delete(proposalId: string): void;
}
