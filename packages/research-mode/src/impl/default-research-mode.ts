import type { ResearchMode } from "../interfaces/research-mode.js";
import type { ResearchTopic, ResearchFinding, ResearchSource, ResearchStatus } from "@ai-agent/evo-types";

export class DefaultResearchMode implements ResearchMode {
  private topics: Map<string, ResearchTopic> = new Map();
  private findings: Map<string, ResearchFinding[]> = new Map();
  private sources: Map<string, ResearchSource[]> = new Map();
  private topicCounter = 0;
  private findingCounter = 0;
  private sourceCounter = 0;

  startResearch(query: string): ResearchTopic {
    const now = Date.now();
    const topic: ResearchTopic = {
      id: `rt_${++this.topicCounter}`,
      query,
      status: "gathering",
      findings: [],
      sources: [],
      summary: null,
      recommendations: [],
      confidence: 0,
      createdAt: now,
      completedAt: null,
    };
    this.topics.set(topic.id, topic);
    this.findings.set(topic.id, []);
    this.sources.set(topic.id, []);
    return topic;
  }

  addFinding(topicId: string, content: string, source: string, relevance: number, reliability: number): ResearchFinding {
    const topic = this.topics.get(topicId);
    if (!topic) throw new Error(`Topic not found: ${topicId}`);

    const finding: ResearchFinding = {
      id: `rf_${++this.findingCounter}`,
      content,
      source,
      relevance,
      reliability,
      timestamp: Date.now(),
    };

    const topicFindings = this.findings.get(topicId) ?? [];
    topicFindings.push(finding);
    this.findings.set(topicId, topicFindings);

    this.updateTopicFindings(topicId);
    return finding;
  }

  addSource(topicId: string, url: string, title: string, type: ResearchSource["type"], reliability: number): ResearchSource {
    const topic = this.topics.get(topicId);
    if (!topic) throw new Error(`Topic not found: ${topicId}`);

    const source: ResearchSource = {
      id: `rs_${++this.sourceCounter}`,
      url,
      title,
      type,
      reliability,
      accessedAt: Date.now(),
    };

    const topicSources = this.sources.get(topicId) ?? [];
    topicSources.push(source);
    this.sources.set(topicId, topicSources);

    this.updateTopicSources(topicId);
    return source;
  }

  updateStatus(topicId: string, status: ResearchStatus): void {
    const topic = this.topics.get(topicId);
    if (!topic) throw new Error(`Topic not found: ${topicId}`);
    this.topics.set(topicId, { ...topic, status });
  }

  completeResearch(topicId: string, summary: string, recommendations: ReadonlyArray<string>): void {
    const topic = this.topics.get(topicId);
    if (!topic) throw new Error(`Topic not found: ${topicId}`);
    this.topics.set(topicId, {
      ...topic,
      status: "complete",
      summary,
      recommendations,
      completedAt: Date.now(),
    });
  }

  getTopic(topicId: string): ResearchTopic | null {
    return this.topics.get(topicId) ?? null;
  }

  getAllTopics(): ReadonlyArray<ResearchTopic> {
    return Array.from(this.topics.values());
  }

  getActiveTopics(): ReadonlyArray<ResearchTopic> {
    return Array.from(this.topics.values()).filter(
      (t) => t.status === "gathering" || t.status === "analyzing"
    );
  }

  getCompletedTopics(): ReadonlyArray<ResearchTopic> {
    return Array.from(this.topics.values()).filter((t) => t.status === "complete");
  }

  deleteTopic(topicId: string): void {
    this.topics.delete(topicId);
    this.findings.delete(topicId);
    this.sources.delete(topicId);
  }

  private updateTopicFindings(topicId: string): void {
    const topic = this.topics.get(topicId);
    if (!topic) return;
    const findings = this.findings.get(topicId) ?? [];
    this.topics.set(topicId, { ...topic, findings });
  }

  private updateTopicSources(topicId: string): void {
    const topic = this.topics.get(topicId);
    if (!topic) return;
    const sources = this.sources.get(topicId) ?? [];
    this.topics.set(topicId, { ...topic, sources });
  }
}
