import type { AutomationProposal, WorkflowStep } from "@ai-agent/evo-types";
import type { AutomationBuilder } from "../interfaces/automation-builder.js";

export class DefaultAutomationBuilder implements AutomationBuilder {
  private readonly proposals = new Map<string, AutomationProposal>();
  private counter = 0;

  propose(
    workflowPatternId: string,
    name: string,
    description: string,
    trigger: string,
    steps: ReadonlyArray<WorkflowStep>,
    estimatedTimeSaved: number,
    confidence: number,
  ): AutomationProposal {
    const id = `ab_${++this.counter}`;
    const proposal: AutomationProposal = {
      id,
      workflowPatternId,
      name,
      description,
      trigger,
      steps: [...steps],
      estimatedTimeSaved,
      confidence,
      status: "proposed",
      createdAt: Date.now(),
    };
    this.proposals.set(id, proposal);
    return proposal;
  }

  get(proposalId: string): AutomationProposal | null {
    return this.proposals.get(proposalId) ?? null;
  }

  getAll(): ReadonlyArray<AutomationProposal> {
    return [...this.proposals.values()];
  }

  getProposed(): ReadonlyArray<AutomationProposal> {
    return [...this.proposals.values()].filter((p) => p.status === "proposed");
  }

  getActive(): ReadonlyArray<AutomationProposal> {
    return [...this.proposals.values()].filter((p) => p.status === "active");
  }

  approve(proposalId: string): void {
    const proposal = this.proposals.get(proposalId);
    if (proposal) {
      this.proposals.set(proposalId, { ...proposal, status: "active" });
    }
  }

  reject(proposalId: string): void {
    const proposal = this.proposals.get(proposalId);
    if (proposal) {
      this.proposals.set(proposalId, { ...proposal, status: "rejected" });
    }
  }

  disable(proposalId: string): void {
    const proposal = this.proposals.get(proposalId);
    if (proposal) {
      this.proposals.set(proposalId, { ...proposal, status: "disabled" });
    }
  }

  delete(proposalId: string): void {
    this.proposals.delete(proposalId);
  }
}
