// Types
export type {
  BaseMemory,
  MemoryType,
  MemoryQuery,
  MemoryQueryResult,
  MemoryStats,
  SemanticMemory,
  SemanticCategory,
  EpisodicMemory,
  EpisodicCategory,
  ProceduralMemory,
  ProceduralCategory,
  ProceduralStep,
  RelationshipMemory,
  RelationshipCategory,
  ProjectMemory,
  ProjectCategory,
  TimelineMemory,
  TimelineCategory,
  ReflectionMemory,
  ReflectionCategory,
} from "./types/memory.js";

// Interface
export type { MemoryManager, ConsolidationResult } from "./interfaces/memory-manager.js";

// Implementation
export { DefaultMemoryManager } from "./impl/default-memory-manager.js";
