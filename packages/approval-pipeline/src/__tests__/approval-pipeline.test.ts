import { describe, it, expect, beforeEach } from "vitest";
import { DefaultApprovalPipeline } from "../impl/default-approval-pipeline.js";

describe("DefaultApprovalPipeline", () => {
  let pipeline: DefaultApprovalPipeline;

  beforeEach(() => {
    pipeline = new DefaultApprovalPipeline();
  });

  it("should auto-approve read actions", () => {
    const req = pipeline.requestApproval({ taskId: "t1", agentId: "a1", action: "read_file", risk: "low", reversible: true, impact: "none", details: {}, policy: "automatic" });
    expect(req.status).toBe("approved");
  });

  it("should require approval for push actions", () => {
    const req = pipeline.requestApproval({ taskId: "t1", agentId: "a1", action: "push_git", risk: "medium", reversible: false, impact: "code changes", details: {}, policy: "ask" });
    expect(req.status).toBe("pending");
  });

  it("should approve pending requests", () => {
    const req = pipeline.requestApproval({ taskId: "t1", agentId: "a1", action: "push_git", risk: "medium", reversible: false, impact: "code changes", details: {}, policy: "ask" });
    pipeline.approve(req.id, "Looks good");
    expect(pipeline.getById(req.id)!.status).toBe("approved");
  });

  it("should deny requests", () => {
    const req = pipeline.requestApproval({ taskId: "t1", agentId: "a1", action: "delete_file", risk: "high", reversible: false, impact: "data loss", details: {}, policy: "ask" });
    pipeline.deny(req.id, "Too risky");
    expect(pipeline.getById(req.id)!.status).toBe("denied");
  });

  it("should get pending requests", () => {
    pipeline.requestApproval({ taskId: "t1", agentId: "a1", action: "push_git", risk: "medium", reversible: false, impact: "", details: {}, policy: "ask" });
    expect(pipeline.getPending().length).toBe(1);
  });
});
