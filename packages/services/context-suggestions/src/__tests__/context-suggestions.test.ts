import { describe, it, expect, vi, beforeEach } from "vitest";
import { createContextSuggestionsService, analyzeContext, rankSuggestions } from "../impl/context-suggestions-service.js";
import type { ContextInfo } from "../impl/context-suggestions-service.js";

// Mock execSync
vi.mock("node:child_process", () => ({
  execSync: vi.fn().mockReturnValue(""),
}));

// Mock fs
vi.mock("node:fs", () => ({
  readFileSync: vi.fn().mockReturnValue(""),
  existsSync: vi.fn().mockReturnValue(false),
  readdirSync: vi.fn().mockReturnValue([]),
}));

describe("contextSuggestionsService", () => {
  let service: ReturnType<typeof createContextSuggestionsService>;
  const mockContext = {
    provider: {
      complete: vi.fn().mockResolvedValue({ text: "Generated response" }),
    },
    memory: {
      add: vi.fn(),
      history: vi.fn().mockResolvedValue([]),
    },
  } as any;

  beforeEach(() => {
    service = createContextSuggestionsService();
    vi.clearAllMocks();
  });

  it("should have correct name", () => {
    expect(service.name).toBe("context-suggestions");
  });

  it("should have canHandle method", () => {
    expect(typeof service.canHandle).toBe("function");
  });

  it("should handle context queries", () => {
    expect(service.canHandle("what should I do next")).toBe(true);
    expect(service.canHandle("I'm stuck on this bug")).toBe(true);
    expect(service.canHandle("suggest improvements")).toBe(true);
    expect(service.canHandle("help me with this code")).toBe(true);
    expect(service.canHandle("what's the best approach")).toBe(true);
  });

  it("should not handle non-context queries", () => {
    expect(service.canHandle("play music")).toBe(false);
    expect(service.canHandle("open youtube")).toBe(false);
  });

  it("should have execute method", () => {
    expect(typeof service.execute).toBe("function");
  });
});

describe("analyzeContext", () => {
  const mockContext: ContextInfo = {
    activeApp: "VS Code",
    activeWindow: "VS Code",
    recentFiles: ["src/index.ts", "src/utils.ts"],
    currentDirectory: "/home/user/project",
    gitStatus: "Modified: 2, Added: 1, Deleted: 0",
    timeOfDay: "morning",
    dayOfWeek: "Monday",
    systemHealth: "Load: 0.5, Memory: 45%, Disk: 60%",
    recentErrors: [],
  };

  it("should generate suggestions for coding context", () => {
    const suggestions = analyzeContext(mockContext);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some(s => s.context === "coding")).toBe(true);
  });

  it("should generate suggestions for morning time", () => {
    const morningContext = { ...mockContext, timeOfDay: "morning" };
    const suggestions = analyzeContext(morningContext);
    expect(suggestions.some(s => s.context === "morning")).toBe(true);
  });

  it("should generate suggestions for night time", () => {
    const nightContext = { ...mockContext, timeOfDay: "night" };
    const suggestions = analyzeContext(nightContext);
    expect(suggestions.some(s => s.context === "evening")).toBe(true);
  });

  it("should generate suggestions for high memory usage", () => {
    const highMemContext = { ...mockContext, systemHealth: "Load: 0.5, Memory: 85%, Disk: 60%" };
    const suggestions = analyzeContext(highMemContext);
    expect(suggestions.some(s => s.id === "memory_warning")).toBe(true);
  });

  it("should generate suggestions for git changes", () => {
    const gitContext = { ...mockContext, gitStatus: "Modified: 3, Added: 0, Deleted: 0" };
    const suggestions = analyzeContext(gitContext);
    expect(suggestions.some(s => s.id === "commit_changes")).toBe(true);
  });
});

describe("rankSuggestions", () => {
  const mockContext: ContextInfo = {
    activeApp: "VS Code",
    activeWindow: "VS Code",
    recentFiles: [],
    currentDirectory: "/home/user/project",
    gitStatus: "Modified: 0, Added: 0, Deleted: 0",
    timeOfDay: "morning",
    dayOfWeek: "Monday",
    systemHealth: "Load: 0.5, Memory: 45%, Disk: 60%",
    recentErrors: [],
  };

  it("should rank high priority suggestions first", () => {
    const suggestions = [
      { id: "1", category: "task" as const, priority: "low" as const, title: "Low", description: "", actions: [], context: "" },
      { id: "2", category: "task" as const, priority: "high" as const, title: "High", description: "", actions: [], context: "" },
      { id: "3", category: "task" as const, priority: "medium" as const, title: "Medium", description: "", actions: [], context: "" },
    ];

    const ranked = rankSuggestions(suggestions, mockContext);
    expect(ranked[0]?.priority).toBe("high");
    expect(ranked[1]?.priority).toBe("medium");
    expect(ranked[2]?.priority).toBe("low");
  });
});
