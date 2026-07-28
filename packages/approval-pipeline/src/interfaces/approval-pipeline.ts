import type { ApprovalRequest, ApprovalRule, ApprovalPolicy, TaskRisk } from "@ai-agent/exec-types";

export interface ApprovalPipeline {
  requestApproval(request: Omit<ApprovalRequest, "id" | "status" | "createdAt" | "respondedAt" | "response">): ApprovalRequest;
  approve(requestId: string, response?: string): void;
  deny(requestId: string, response?: string): void;
  getPending(): ReadonlyArray<ApprovalRequest>;
  getById(id: string): ApprovalRequest | null;
  getPolicy(action: string, risk: TaskRisk): ApprovalPolicy;
  addRule(rule: ApprovalRule): void;
  removeRule(ruleId: string): void;
}

export interface ApprovalPipelineConfig {
  readonly enabled: boolean;
  readonly autoApproveLowRisk: boolean;
  readonly expiryMs: number;
}
