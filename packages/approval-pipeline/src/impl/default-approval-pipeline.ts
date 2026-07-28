import type { ApprovalPipeline, ApprovalPipelineConfig } from "../interfaces/approval-pipeline.js";
import type { ApprovalRequest, ApprovalRule, ApprovalPolicy, TaskRisk } from "@ai-agent/exec-types";

let reqIdCounter = 0;

const DEFAULT_RULES: ApprovalRule[] = [
  { id: "r1", name: "read automatic", match: (a) => a.startsWith("read"), policy: "automatic", priority: 10 },
  { id: "r2", name: "search automatic", match: (a) => a.startsWith("search"), policy: "automatic", priority: 10 },
  { id: "r3", name: "delete ask", match: (a) => a.startsWith("delete"), policy: "ask", priority: 5 },
  { id: "r4", name: "push ask", match: (a) => a.startsWith("push"), policy: "ask", priority: 5 },
  { id: "r5", name: "email ask", match: (a) => a.startsWith("send_email"), policy: "ask", priority: 5 },
  { id: "r6", name: "write automatic", match: (a) => a.startsWith("write"), policy: "automatic", priority: 8 },
  { id: "r7", name: "execute ask", match: (a) => a.startsWith("execute"), policy: "ask", priority: 3 },
];

const DEFAULT_CONFIG: ApprovalPipelineConfig = {
  enabled: true,
  autoApproveLowRisk: true,
  expiryMs: 300000,
};

export class DefaultApprovalPipeline implements ApprovalPipeline {
  private rules: ApprovalRule[];
  private requests = new Map<string, ApprovalRequest>();
  private config: ApprovalPipelineConfig;

  constructor(config?: Partial<ApprovalPipelineConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rules = [...DEFAULT_RULES];
  }

  requestApproval(data: Omit<ApprovalRequest, "id" | "status" | "createdAt" | "respondedAt" | "response">): ApprovalRequest {
    const policy = this.getPolicy(data.action, data.risk);

    const request: ApprovalRequest = {
      ...data,
      id: `apr_${++reqIdCounter}`,
      policy,
      status: policy === "automatic" ? "approved" : "pending",
      createdAt: Date.now(),
      respondedAt: policy === "automatic" ? Date.now() : null,
      response: policy === "automatic" ? "auto-approved" : null,
    };

    this.requests.set(request.id, request);
    return request;
  }

  approve(requestId: string, response?: string): void {
    const request = this.requests.get(requestId);
    if (request && request.status === "pending") {
      this.requests.set(requestId, {
        ...request,
        status: "approved",
        respondedAt: Date.now(),
        response: response ?? "approved",
      });
    }
  }

  deny(requestId: string, response?: string): void {
    const request = this.requests.get(requestId);
    if (request && request.status === "pending") {
      this.requests.set(requestId, {
        ...request,
        status: "denied",
        respondedAt: Date.now(),
        response: response ?? "denied",
      });
    }
  }

  getPending(): ReadonlyArray<ApprovalRequest> {
    return Array.from(this.requests.values()).filter((r) => r.status === "pending");
  }

  getById(id: string): ApprovalRequest | null {
    return this.requests.get(id) ?? null;
  }

  getPolicy(action: string, risk: TaskRisk): ApprovalPolicy {
    const sorted = [...this.rules].sort((a, b) => a.priority - b.priority);
    for (const rule of sorted) {
      if (rule.match(action, risk)) return rule.policy;
    }
    if (risk === "critical") return "ask";
    if (risk === "high") return "ask";
    if (this.config.autoApproveLowRisk && (risk === "low" || risk === "automatic")) return "automatic";
    return "ask";
  }

  addRule(rule: ApprovalRule): void {
    this.rules.push(rule);
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter((r) => r.id !== ruleId);
  }
}
