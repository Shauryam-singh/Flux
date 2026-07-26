import type { Service } from "../interfaces/service.js";

const KEYWORDS: Record<string, string[]> = {
  coding: [
    "code", "file", "function", "bug", "fix", "refactor", "write", "edit",
    "create file", "read file", "compile", "build", "test", "debug",
    "import", "export", "class", "interface", "type", "variable",
    "git", "commit", "branch", "merge", "push", "pull",
  ],
  search: [
    "search", "look up", "find", "what is", "who is", "where is",
    "when did", "how to", "tell me about", "google", "research",
    "latest", "news", "current",
  ],
  system: [
    "open", "close", "volume", "brightness", "battery", "wifi",
    "bluetooth", "shutdown", "restart", "sleep", "lock",
    "screenshot", "screen", "display", "cpu", "memory", "disk",
  ],
  reminders: [
    "remind", "note", "task", "todo", "schedule", "alarm",
    "remember", "save note", "list tasks", "delete note",
  ],
  files: [
    "find file", "list files", "folder", "directory", "organize",
    "move file", "copy file", "delete file", "rename",
    "browse", "explore",
  ],
};

export function classifyIntent(input: string): string | null {
  const lower = input.toLowerCase();

  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const [service, keywords] of Object.entries(KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        score += keyword.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = service;
    }
  }

  return bestScore > 0 ? bestMatch : null;
}
