import type { ResearchTopic, ResearchFinding, ResearchSource, ResearchStatus } from "@ai-agent/evo-types";

export interface ResearchMode {
  startResearch(query: string): ResearchTopic;
  addFinding(topicId: string, content: string, source: string, relevance: number, reliability: number): ResearchFinding;
  addSource(topicId: string, url: string, title: string, type: ResearchSource["type"], reliability: number): ResearchSource;
  updateStatus(topicId: string, status: ResearchStatus): void;
  completeResearch(topicId: string, summary: string, recommendations: ReadonlyArray<string>): void;
  getTopic(topicId: string): ResearchTopic | null;
  getAllTopics(): ReadonlyArray<ResearchTopic>;
  getActiveTopics(): ReadonlyArray<ResearchTopic>;
  getCompletedTopics(): ReadonlyArray<ResearchTopic>;
  deleteTopic(topicId: string): void;
}
