import { describe, it, expect } from "vitest";
import { DefaultResearchMode } from "../impl/default-research-mode.js";

describe("DefaultResearchMode", () => {
  it("should start research with gathering status", () => {
    const rm = new DefaultResearchMode();
    const topic = rm.startResearch("How to implement caching?");
    expect(topic.id).toMatch(/^rt_/);
    expect(topic.query).toBe("How to implement caching?");
    expect(topic.status).toBe("gathering");
    expect(topic.findings).toHaveLength(0);
    expect(topic.sources).toHaveLength(0);
    expect(topic.summary).toBeNull();
    expect(topic.recommendations).toHaveLength(0);
  });

  it("should add findings to a topic", () => {
    const rm = new DefaultResearchMode();
    const topic = rm.startResearch("test query");
    const finding = rm.addFinding(topic.id, "Redis is fast", "docs", 0.9, 0.85);
    expect(finding.id).toMatch(/^rf_/);
    expect(finding.content).toBe("Redis is fast");
    expect(finding.source).toBe("docs");
    expect(finding.relevance).toBe(0.9);
    expect(finding.reliability).toBe(0.85);
    const updated = rm.getTopic(topic.id)!;
    expect(updated.findings).toHaveLength(1);
  });

  it("should add sources to a topic", () => {
    const rm = new DefaultResearchMode();
    const topic = rm.startResearch("test query");
    const source = rm.addSource(topic.id, "https://example.com", "Example Doc", "web", 0.95);
    expect(source.id).toMatch(/^rs_/);
    expect(source.url).toBe("https://example.com");
    expect(source.title).toBe("Example Doc");
    expect(source.type).toBe("web");
    const updated = rm.getTopic(topic.id)!;
    expect(updated.sources).toHaveLength(1);
  });

  it("should update status", () => {
    const rm = new DefaultResearchMode();
    const topic = rm.startResearch("test");
    rm.updateStatus(topic.id, "analyzing");
    expect(rm.getTopic(topic.id)!.status).toBe("analyzing");
  });

  it("should complete research with summary and recommendations", () => {
    const rm = new DefaultResearchMode();
    const topic = rm.startResearch("test");
    rm.completeResearch(topic.id, "Use Redis for caching", ["Implement cache invalidation", "Set TTL"]);
    const completed = rm.getTopic(topic.id)!;
    expect(completed.status).toBe("complete");
    expect(completed.summary).toBe("Use Redis for caching");
    expect(completed.recommendations).toEqual(["Implement cache invalidation", "Set TTL"]);
  });

  it("should return null for nonexistent topic", () => {
    const rm = new DefaultResearchMode();
    expect(rm.getTopic("nonexistent")).toBeNull();
  });

  it("should get all topics", () => {
    const rm = new DefaultResearchMode();
    rm.startResearch("query 1");
    rm.startResearch("query 2");
    expect(rm.getAllTopics()).toHaveLength(2);
  });

  it("should get active topics", () => {
    const rm = new DefaultResearchMode();
    const t1 = rm.startResearch("query 1");
    const t2 = rm.startResearch("query 2");
    rm.completeResearch(t2.id, "done", []);
    const active = rm.getActiveTopics();
    expect(active).toHaveLength(1);
    expect(active[0]!.id).toBe(t1.id);
  });

  it("should get completed topics", () => {
    const rm = new DefaultResearchMode();
    const t1 = rm.startResearch("query 1");
    const t2 = rm.startResearch("query 2");
    rm.completeResearch(t1.id, "done", []);
    const completed = rm.getCompletedTopics();
    expect(completed).toHaveLength(1);
    expect(completed[0]!.id).toBe(t1.id);
  });

  it("should delete topic and related data", () => {
    const rm = new DefaultResearchMode();
    const topic = rm.startResearch("test");
    rm.addFinding(topic.id, "content", "src", 0.5, 0.5);
    rm.addSource(topic.id, "http://url", "title", "web", 0.5);
    rm.deleteTopic(topic.id);
    expect(rm.getTopic(topic.id)).toBeNull();
    expect(rm.getAllTopics()).toHaveLength(0);
  });

  it("should throw when adding finding to nonexistent topic", () => {
    const rm = new DefaultResearchMode();
    expect(() => rm.addFinding("nonexistent", "content", "src", 0.5, 0.5)).toThrow("Topic not found");
  });

  it("should throw when adding source to nonexistent topic", () => {
    const rm = new DefaultResearchMode();
    expect(() => rm.addSource("nonexistent", "http://url", "title", "web", 0.5)).toThrow("Topic not found");
  });

  it("should throw when updating status of nonexistent topic", () => {
    const rm = new DefaultResearchMode();
    expect(() => rm.updateStatus("nonexistent", "complete")).toThrow("Topic not found");
  });

  it("should throw when completing nonexistent topic", () => {
    const rm = new DefaultResearchMode();
    expect(() => rm.completeResearch("nonexistent", "summary", [])).toThrow("Topic not found");
  });
});
