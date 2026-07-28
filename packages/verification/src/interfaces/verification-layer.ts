import type { VerificationResult, VerificationType, VerificationRule, VerificationIssue } from "@ai-agent/exec-types";

export interface VerificationLayer {
  verify(taskId: string, type: VerificationType, content: Record<string, unknown>): Promise<VerificationResult>;
  verifyAll(taskId: string, content: Record<string, unknown>): Promise<ReadonlyArray<VerificationResult>>;
  addRule(rule: VerificationRule): void;
  removeRule(type: VerificationType): void;
  getRules(): ReadonlyArray<VerificationRule>;
  getResults(taskId: string): ReadonlyArray<VerificationResult>;
}

export interface VerificationConfig {
  readonly enabled: boolean;
  readonly defaultMinScore: number;
  readonly timeout: number;
}
