/**
 * Cognitive Memory Types
 *
 * Based on cognitive science memory systems:
 * - Semantic: Facts and knowledge about the world
 * - Episodic: Personal experiences and events
 * - Procedural: How to do things (workflows, commands)
 * - Relationship: User preferences and interaction patterns
 * - Project: Project-specific knowledge
 * - Timeline: Chronological life events
 * - Reflection: Meta-cognitive insights
 */

// ─── Base Memory ──────────────────────────────────────────────────

export type MemoryType =
  | "semantic"
  | "episodic"
  | "procedural"
  | "relationship"
  | "project"
  | "timeline"
  | "reflection";

export interface BaseMemory {
  readonly id: string;
  readonly type: MemoryType;
  readonly content: string;
  readonly timestamp: number;
  readonly lastAccessed: number;
  readonly accessCount: number;
  readonly strength: number; // 0-1, how strong the memory is
  readonly confidence: number; // 0-1, how confident we are in this memory
  readonly source: string;
  readonly tags: ReadonlyArray<string>;
  readonly relatedIds: ReadonlyArray<string>;
}

// ─── Semantic Memory ──────────────────────────────────────────────
// "User prefers TypeScript"
// "The project uses pnpm workspaces"
// "TypeScript 6+ with ES2023"

export type SemanticCategory =
  | "fact"         // Objective truth
  | "preference"   // User preference
  | "constraint"   // System constraint
  | "definition"   // Term definition
  | "relationship"; // How things relate

export interface SemanticMemory extends BaseMemory {
  readonly type: "semantic";
  readonly category: SemanticCategory;
  readonly subject: string;     // What this is about
  readonly predicate: string;   // The relationship
  readonly object: string;      // The value
  readonly domain: string;      // Knowledge domain (e.g., "programming", "project")
  readonly contradictions: ReadonlyArray<string>; // IDs of contradictory memories
}

// ─── Episodic Memory ──────────────────────────────────────────────
// "Yesterday we fixed the router"
// "User asked about Docker at 3pm"
// "Build failed after merge"

export type EpisodicCategory =
  | "interaction"    // User-AI interaction
  | "event"          // Something that happened
  | "achievement"    // Completed task
  | "failure"        // Something went wrong
  | "discovery"      // Learned something new
  | "decision";      // Made a choice

export interface EpisodicMemory extends BaseMemory {
  readonly type: "episodic";
  readonly category: EpisodicCategory;
  readonly event: string;           // What happened
  readonly context: string;         // Surrounding context
  readonly participants: ReadonlyArray<string>; // Who was involved
  readonly location: string | null; // Where it happened (file, app, etc.)
  readonly duration: number | null; // How long it lasted (ms)
  readonly outcome: string | null;  // What resulted
  readonly emotionalValence: number; // -1 to 1 (negative to positive)
  readonly relatedEpisodeIds: ReadonlyArray<string>;
}

// ─── Procedural Memory ────────────────────────────────────────────
// "Deploying requires: pnpm build, docker compose up"
// "To fix TypeScript errors, run tsc --noEmit"
// "Commit message format: type(scope): description"

export type ProceduralCategory =
  | "command"       // Shell commands
  | "workflow"      // Multi-step process
  | "pattern"       // Code pattern
  | "shortcut"      // Keyboard shortcut
  | "convention"    // Coding convention
  | "debugging";    // Debugging steps

export interface ProceduralStep {
  readonly order: number;
  readonly action: string;
  readonly command: string | null;
  readonly expectedResult: string;
  readonly errorHandling: string | null;
}

export interface ProceduralMemory extends BaseMemory {
  readonly type: "procedural";
  readonly category: ProceduralCategory;
  readonly name: string;              // Name of the procedure
  readonly steps: ReadonlyArray<ProceduralStep>;
  readonly prerequisites: ReadonlyArray<string>; // What's needed before
  readonly successRate: number;       // 0-1, how often this works
  readonly lastUsed: number;
  readonly useCount: number;
  readonly variations: ReadonlyArray<string>; // Alternative approaches
}

// ─── Relationship Memory ──────────────────────────────────────────
// "User likes sarcasm at medium level"
// "User prefers concise responses"
// "User is a senior developer"

export type RelationshipCategory =
  | "preference"     // What user likes/dislikes
  | "personality"    // User personality traits
  | "skill_level"    // User expertise level
  | "communication"  // Communication style
  | "habit"          // User habits
  | "context";       // Current situation

export interface RelationshipMemory extends BaseMemory {
  readonly type: "relationship";
  readonly category: RelationshipCategory;
  readonly attribute: string;    // What attribute
  readonly value: string;        // The value
  readonly intensity: number;    // 0-1, how strongly held
  readonly evidence: ReadonlyArray<string>; // Supporting observations
  readonly lastConfirmed: number; // When last verified
  readonly contradictions: ReadonlyArray<string>;
}

// ─── Project Memory ───────────────────────────────────────────────
// "Flux uses Tauri v2 with vanilla HTML/CSS/JS"
// "Phase 6 added self-evolution"
// "Build command: pnpm run build"

export type ProjectCategory =
  | "architecture"   // System design
  | "tech_stack"     // Technologies used
  | "convention"     // Project conventions
  | "milestone"      // Completed milestones
  | "issue"          // Known issues
  | "dependency"     // Dependencies
  | "configuration"; // Config files

export interface ProjectMemory extends BaseMemory {
  readonly type: "project";
  readonly category: ProjectCategory;
  readonly projectName: string;
  readonly component: string;      // Which part of the project
  readonly description: string;    // Detailed description
  readonly filePath: string | null; // Related file path
  readonly version: string | null; // Version when recorded
  readonly verified: boolean;      // Has this been verified recently
}

// ─── Timeline Memory ──────────────────────────────────────────────
// "Completed Executive Intelligence at 11pm"
// "Started background cognition loop"
// "Fixed DNS issue blocking git push"

export type TimelineCategory =
  | "milestone"      // Major achievement
  | "task_completed" // Finished a task
  | "task_started"   // Began a task
  | "error_resolved" // Fixed an issue
  | "learning"       // Learned something
  | "decision"       // Made a decision
  | "observation";   // Noticed something

export interface TimelineMemory extends BaseMemory {
  readonly type: "timeline";
  readonly category: TimelineCategory;
  readonly event: string;           // What happened
  readonly significance: number;    // 0-1, how important
  readonly impact: string;          // What it affected
  readonly nextEvent: string | null; // What comes next
  readonly tags: ReadonlyArray<string>;
}

// ─── Reflection Memory ────────────────────────────────────────────
// "I should be more proactive about errors"
// "User prefers I ask before making big changes"
// "The cognition pipeline works best with frequent observations"

export type ReflectionCategory =
  | "insight"        // Something I learned about myself
  | "strategy"       // Better way to do things
  | "mistake"        // Something I should avoid
  | "improvement"    // Area for growth
  | "pattern"        // Recurring behavior
  | "goal_adjustment"; // Changed approach

export interface ReflectionMemory extends BaseMemory {
  readonly type: "reflection";
  readonly category: ReflectionCategory;
  readonly insight: string;         // The reflection
  readonly trigger: string;         // What caused this reflection
  readonly confidence: number;      // 0-1, how sure I am
  readonly applicability: number;   // 0-1, how broadly applicable
  readonly actionItem: string | null; // What I should do about it
  readonly verifiedByExperience: boolean; // Has this been confirmed
  readonly revisionCount: number;   // How many times revised
}

// ─── Memory Query ─────────────────────────────────────────────────

export interface MemoryQuery {
  readonly text?: string;           // Free text search
  readonly types?: ReadonlyArray<MemoryType>;
  readonly categories?: ReadonlyArray<string>;
  readonly tags?: ReadonlyArray<string>;
  readonly minStrength?: number;
  readonly minConfidence?: number;
  readonly maxAge?: number;         // ms since creation
  readonly limit?: number;
  readonly sortBy?: "strength" | "recency" | "relevance" | "accessCount";
}

export interface MemoryQueryResult {
  readonly memories: ReadonlyArray<BaseMemory>;
  readonly totalMatches: number;
  readonly queryTime: number;
  readonly suggestions: ReadonlyArray<string>;
}

// ─── Memory Stats ─────────────────────────────────────────────────

export interface MemoryStats {
  readonly totalMemories: number;
  readonly byType: Record<MemoryType, number>;
  readonly averageStrength: number;
  readonly averageConfidence: number;
  readonly oldestMemory: number;
  readonly newestMemory: number;
  readonly totalAccesses: number;
  readonly consolidationEvents: number;
}
