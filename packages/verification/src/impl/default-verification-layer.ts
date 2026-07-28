import type { VerificationLayer, VerificationConfig } from "../interfaces/verification-layer.js";
import type { VerificationResult, VerificationType, VerificationRule, VerificationIssue } from "@ai-agent/exec-types";

let verIdCounter = 0;

const DEFAULT_RULES: VerificationRule[] = [
  { type: "unit_test", required: true, minScore: 80, timeout: 60000 },
  { type: "static_analysis", required: false, minScore: 70, timeout: 30000 },
  { type: "security_scan", required: false, minScore: 60, timeout: 60000 },
  { type: "fact_check", required: false, minScore: 70, timeout: 30000 },
  { type: "consistency_check", required: true, minScore: 80, timeout: 30000 },
];

const DEFAULT_CONFIG: VerificationConfig = {
  enabled: true,
  defaultMinScore: 70,
  timeout: 60000,
};

export class DefaultVerificationLayer implements VerificationLayer {
  private rules: VerificationRule[];
  private results = new Map<string, VerificationResult[]>();
  private config: VerificationConfig;

  constructor(config?: Partial<VerificationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rules = [...DEFAULT_RULES];
  }

  async verify(taskId: string, type: VerificationType, content: Record<string, unknown>): Promise<VerificationResult> {
    const rule = this.rules.find((r) => r.type === type);
    const minScore = rule?.minScore ?? this.config.defaultMinScore;

    const issues: VerificationIssue[] = [];
    let score = 100;

    if (type === "unit_test") {
      const passed = content["testsPassed"] as number ?? 0;
      const total = content["testsTotal"] as number ?? 1;
      score = Math.round((passed / total) * 100);
      if (score < minScore) {
        issues.push({ severity: "warning", message: `Test score ${score}% below minimum ${minScore}%`, file: null, line: null, rule: "unit_test", suggestion: "Add more tests" });
      }
    }

    if (type === "static_analysis") {
      const errors = content["errors"] as number ?? 0;
      score = Math.max(0, 100 - errors * 10);
      if (errors > 0) {
        issues.push({ severity: "error", message: `${errors} static analysis errors`, file: null, line: null, rule: "static_analysis", suggestion: "Fix errors" });
      }
    }

    const result: VerificationResult = {
      id: `ver_${++verIdCounter}`,
      taskId,
      type,
      passed: score >= minScore,
      score,
      issues,
      duration: 0,
      timestamp: Date.now(),
    };

    const existing = this.results.get(taskId) ?? [];
    existing.push(result);
    this.results.set(taskId, existing);

    return result;
  }

  async verifyAll(taskId: string, content: Record<string, unknown>): Promise<ReadonlyArray<VerificationResult>> {
    const results: VerificationResult[] = [];
    for (const rule of this.rules) {
      const result = await this.verify(taskId, rule.type, content);
      results.push(result);
    }
    return results;
  }

  addRule(rule: VerificationRule): void {
    this.rules.push(rule);
  }

  removeRule(type: VerificationType): void {
    this.rules = this.rules.filter((r) => r.type !== type);
  }

  getRules(): ReadonlyArray<VerificationRule> {
    return this.rules;
  }

  getResults(taskId: string): ReadonlyArray<VerificationResult> {
    return this.results.get(taskId) ?? [];
  }
}
