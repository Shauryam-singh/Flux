export type { SpecialistAgent, AgentConfig, AgentLifecycle } from "./interfaces/specialist-agent.js";
export {
  BaseSpecialistAgent,
  CodingAgent,
  ResearchAgent,
  DocumentationAgent,
  TestingAgent,
  GitAgent,
  DebugAgent,
  ReviewAgent,
} from "./impl/base-specialist-agent.js";
