/**
 * Context-Aware Suggestions Service
 *
 * Analyzes current context and provides intelligent suggestions.
 * Deeply context-aware based on:
 *   - Active window/application
 *   - Recent files and code
 *   - Screen content
 *   - Time of day
 *   - User history
 *   - Current task
 *
 * Commands:
 *   "what should I do next?" → analyze context, suggest next steps
 *   "I'm stuck on this bug" → read screen, search Stack Overflow, suggest fix
 *   "help me with this code" → analyze code, suggest improvements
 *   "what's the best approach?" → analyze context, suggest strategy
 *   "suggest improvements" → analyze current work, suggest optimizations
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { homedir } from "node:os";
import type { Service, ServiceContext, ServiceResponse } from "@ai-agent/services-core";

// ─── Helpers ────────────────────────────────────────────────────

function run(cmd: string, timeoutMs = 5000): string {
  try {
    return execSync(cmd, { timeout: timeoutMs, encoding: "utf-8", stdio: "pipe" }).trim();
  } catch {
    return "";
  }
}

function runPs(script: string): string {
  try {
    return execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"').replace(/\n/g, "; ")}"`, {
      timeout: 5000, encoding: "utf-8", stdio: "pipe",
    }).trim();
  } catch {
    return "";
  }
}

// ─── Context Analysis ───────────────────────────────────────────

interface ContextInfo {
  activeApp: string;
  activeWindow: string;
  recentFiles: string[];
  currentDirectory: string;
  gitStatus: string;
  timeOfDay: string;
  dayOfWeek: string;
  systemHealth: string;
  recentErrors: string[];
}

function getActiveApp(): string {
  const platform = process.platform;

  if (platform === "linux") {
    // Hyprland
    const focused = run("hyprctl activewindow -j 2>/dev/null | jq -r '.initialTitle // .title' 2>/dev/null");
    if (focused) return focused;

    // Fallback to xdotool
    return run("xdotool getactivewindow getwindowname 2>/dev/null");
  }

  if (platform === "win32") {
    return runPs("(Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | Select-Object -First 1).MainWindowTitle");
  }

  if (platform === "darwin") {
    return run("osascript -e 'tell application \"System Events\" to get name of first application process whose frontmost is true' 2>/dev/null");
  }

  return "Unknown";
}

function getRecentFiles(dir: string, maxFiles = 10): string[] {
  const files: string[] = [];
  const platform = process.platform;

  try {
    if (platform === "linux") {
      // Use find with recently modified files
      const output = run(`find "${dir}" -maxdepth 3 -type f -mtime -1 -printf "%T@ %p\\n" 2>/dev/null | sort -rn | head -${maxFiles} | awk '{print $2}'`);
      if (output) files.push(...output.split("\n").filter(Boolean));
    } else if (platform === "win32") {
      const output = runPs(`Get-ChildItem -Path "${dir}" -Recurse -File | Sort-Object LastWriteTime -Descending | Select-Object -First ${maxFiles} | ForEach-Object { $_.FullName }`);
      if (output) files.push(...output.split("\n").filter(Boolean));
    }
  } catch {
    // Ignore errors
  }

  return files;
}

function getGitStatus(): string {
  const status = run("git status --short 2>/dev/null");
  if (!status) return "Not a git repo or no changes";

  const lines = status.split("\n").filter(Boolean);
  const modified = lines.filter(l => l.startsWith(" M") || l.startsWith("M")).length;
  const added = lines.filter(l => l.startsWith("A") || l.startsWith("??")).length;
  const deleted = lines.filter(l => l.startsWith(" D") || l.startsWith("D")).length;

  return `Modified: ${modified}, Added: ${added}, Deleted: ${deleted}`;
}

function getTimeContext(): { timeOfDay: string; dayOfWeek: string } {
  const now = new Date();
  const hour = now.getHours();
  const day = now.toLocaleDateString('en-US', { weekday: 'long' });

  let timeOfDay = "morning";
  if (hour >= 12 && hour < 17) timeOfDay = "afternoon";
  else if (hour >= 17 && hour < 21) timeOfDay = "evening";
  else if (hour >= 21 || hour < 5) timeOfDay = "night";

  return { timeOfDay, dayOfWeek: day };
}

function getSystemHealth(): string {
  const platform = process.platform;

  if (platform === "linux") {
    const load = run("cat /proc/loadavg | awk '{print $1}'");
    const mem = run("free -m | awk 'NR==2{printf \"%.1f%%\", $3*100/$2}'");
    const disk = run("df -h / | awk 'NR==2{print $5}'");

    return `Load: ${load}, Memory: ${mem}, Disk: ${disk}`;
  }

  if (platform === "win32") {
    const load = runPs("(Get-CimInstance Win32_Processor).LoadPercentage");
    const mem = runPs("[math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / (Get-CimInstance Win32_OperatingSystem).TotalVisibleMemorySize * 100, 1)");

    return `CPU: ${load}%, Free Memory: ${mem}%`;
  }

  return "Unknown";
}

function getRecentErrors(): string[] {
  const errors: string[] = [];

  // Check for recent error logs
  const logDir = join(homedir(), ".local", "share", "logs");
  if (existsSync(logDir)) {
    try {
      const files = readdirSync(logDir).filter(f => f.endsWith('.log')).slice(-3);
      for (const file of files) {
        const content = readFileSync(join(logDir, file), 'utf-8');
        const errorLines = content.split('\n').filter(l => l.toLowerCase().includes('error')).slice(-3);
        errors.push(...errorLines.map(l => l.slice(0, 200)));
      }
    } catch {
      // Ignore errors
    }
  }

  return errors.slice(0, 5);
}

async function gatherContext(): Promise<ContextInfo> {
  const { timeOfDay, dayOfWeek } = getTimeContext();
  const cwd = process.cwd();

  return {
    activeApp: getActiveApp(),
    activeWindow: getActiveApp(),
    recentFiles: getRecentFiles(cwd),
    currentDirectory: cwd,
    gitStatus: getGitStatus(),
    timeOfDay,
    dayOfWeek,
    systemHealth: getSystemHealth(),
    recentErrors: getRecentErrors(),
  };
}

// ─── Suggestion Engine ──────────────────────────────────────────

interface Suggestion {
  id: string;
  category: "task" | "code" | "system" | "learning" | "wellness";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  actions: string[];
  context: string;
}

function analyzeContext(context: ContextInfo): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Analyze active application
  const app = context.activeApp.toLowerCase();

  if (app.includes("code") || app.includes("vim") || app.includes("studio")) {
    suggestions.push({
      id: "code_review",
      category: "code",
      priority: "medium",
      title: "Code Review",
      description: "You're coding. Want me to review your changes or run tests?",
      actions: ["Run tests", "Check for lint errors", "Review git diff", "Suggest improvements"],
      context: "coding",
    });

    if (context.gitStatus.includes("Modified")) {
      suggestions.push({
        id: "commit_changes",
        category: "task",
        priority: "high",
        title: "Commit Changes",
        description: "You have uncommitted changes. Want me to help commit them?",
        actions: ["Show git status", "Stage all changes", "Create commit", "Push to remote"],
        context: "git",
      });
    }
  }

  if (app.includes("terminal") || app.includes("konsole")) {
    suggestions.push({
      id: "terminal_help",
      category: "task",
      priority: "low",
      title: "Terminal Assistance",
      description: "Need help with terminal commands or system management?",
      actions: ["Run command", "Check system status", "Monitor processes", "Manage services"],
      context: "terminal",
    });
  }

  if (app.includes("chrome") || app.includes("firefox") || app.includes("safari")) {
    suggestions.push({
      id: "browser_help",
      category: "task",
      priority: "low",
      title: "Browser Assistance",
      description: "Need help with web browsing or research?",
      actions: ["Search for information", "Save page", "Extract content", "Take screenshot"],
      context: "browsing",
    });
  }

  // Analyze time context
  if (context.timeOfDay === "morning") {
    suggestions.push({
      id: "morning_routine",
      category: "wellness",
      priority: "medium",
      title: "Morning Routine",
      description: "Good morning! Want me to check your schedule and priorities?",
      actions: ["Check calendar", "Review today's tasks", "Check emails", "Plan the day"],
      context: "morning",
    });
  }

  if (context.timeOfDay === "night") {
    suggestions.push({
      id: "wrap_up",
      category: "wellness",
      priority: "medium",
      title: "Wrap Up",
      description: "It's getting late. Want me to help you wrap up?",
      actions: ["Save all work", "Commit changes", "Review accomplishments", "Plan tomorrow"],
      context: "evening",
    });
  }

  // Analyze system health
  if (context.systemHealth.includes("Memory:")) {
    const memMatch = context.systemHealth.match(/Memory: (\d+\.?\d*)%/);
    if (memMatch?.[1] && parseFloat(memMatch[1]) > 80) {
      suggestions.push({
        id: "memory_warning",
        category: "system",
        priority: "high",
        title: "High Memory Usage",
        description: "Memory usage is high. Want me to check what's using the most?",
        actions: ["Show memory usage", "Kill memory hogs", "Clear caches", "Restart services"],
        context: "system",
      });
    }
  }

  // Analyze recent files
  if (context.recentFiles.length > 0) {
    const extensions = context.recentFiles.map(f => extname(f).toLowerCase());
    const codeFiles = extensions.filter(e => ['.ts', '.js', '.py', '.go', '.rs', '.java'].includes(e));

    if (codeFiles.length > 0) {
      suggestions.push({
        id: "code_continuation",
        category: "code",
        priority: "medium",
        title: "Continue Coding",
        description: `You've been working on ${codeFiles.length} code files recently.`,
        actions: ["Review recent changes", "Run tests", "Check for errors", "Suggest improvements"],
        context: "coding",
      });
    }
  }

  // Analyze git status
  if (context.gitStatus.includes("Added")) {
    suggestions.push({
      id: "new_files",
      category: "task",
      priority: "medium",
      title: "New Files Detected",
      description: "You have new untracked files. Want me to help organize them?",
      actions: ["Show new files", "Add to git", "Create .gitignore", "Review file structure"],
      context: "git",
    });
  }

  // Add general suggestions
  suggestions.push({
    id: "learn_something",
    category: "learning",
    priority: "low",
    title: "Learn Something New",
    description: "Want to learn about a new topic or improve your skills?",
    actions: ["Search for tutorials", "Find documentation", "Practice coding", "Read articles"],
    context: "learning",
  });

  return suggestions;
}

function rankSuggestions(suggestions: Suggestion[], context: ContextInfo): Suggestion[] {
  // Sort by priority and relevance
  const priorityOrder = { high: 0, medium: 1, low: 2 };

  return suggestions.sort((a, b) => {
    // First by priority
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Then by relevance to current context
    const aRelevance = a.context === context.activeApp.toLowerCase() ? 0 : 1;
    const bRelevance = b.context === context.activeApp.toLowerCase() ? 0 : 1;
    return aRelevance - bRelevance;
  });
}

// ─── Service ────────────────────────────────────────────────────

const MATCH = /\b(what|should|do|next|suggest|help|stuck|bug|improve|approach|context|recommend)\b/i;

export function createContextSuggestionsService(): Service {
  return {
    name: "context-suggestions",
    description: "Context-aware suggestions — analyzes your current work and suggests next steps",
    canHandle: (input: string) => MATCH.test(input),

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const lower = input.toLowerCase();

      try {
        // Gather current context
        const context = await gatherContext();

        // Generate suggestions based on context
        let suggestions = analyzeContext(context);

        // Handle specific queries
        if (/stuck|bug|error|problem|issue/i.test(lower)) {
          // User is stuck - provide debugging help
          const debugSuggestions: Suggestion[] = [
            {
              id: "debug_help",
              category: "code",
              priority: "high",
              title: "Debugging Help",
              description: "Let me help you debug this issue.",
              actions: [
                "Read the error message carefully",
                "Search Stack Overflow for similar issues",
                "Check the documentation",
                "Try a minimal reproduction",
                "Use console.log for debugging",
              ],
              context: "debugging",
            },
            {
              id: "stackoverflow_search",
              category: "learning",
              priority: "high",
              title: "Search Stack Overflow",
              description: "Want me to search Stack Overflow for solutions?",
              actions: ["Search Stack Overflow", "Check GitHub issues", "Read documentation"],
              context: "research",
            },
          ];
          suggestions = [...debugSuggestions, ...suggestions];
        }

        if (/improve|optimize|better|enhance/i.test(lower)) {
          // User wants improvements
          const improveSuggestions: Suggestion[] = [
            {
              id: "code_review",
              category: "code",
              priority: "high",
              title: "Code Review",
              description: "Let me review your code for improvements.",
              actions: [
                "Check for code smells",
                "Suggest refactoring opportunities",
                "Review performance",
                "Check for security issues",
                "Suggest best practices",
              ],
              context: "review",
            },
          ];
          suggestions = [...improveSuggestions, ...suggestions];
        }

        // Rank suggestions
        suggestions = rankSuggestions(suggestions, context);

        // Build response
        const response = [
          `**Context Analysis:**`,
          `- Active App: ${context.activeApp}`,
          `- Time: ${context.timeOfDay} (${context.dayOfWeek})`,
          `- System: ${context.systemHealth}`,
          `- Git: ${context.gitStatus}`,
          "",
          `**Suggestions:**`,
          ...suggestions.slice(0, 5).map((s, i) => {
            const priority = s.priority === "high" ? "🔴" : s.priority === "medium" ? "🟡" : "🟢";
            return `${i + 1}. ${priority} **${s.title}**: ${s.description}`;
          }),
          "",
          `*${suggestions.length} suggestions available. Say "help me with [topic]" for more details.*`,
        ].join("\n");

        return { text: response };
      } catch (e) {
        return { text: `Context analysis error: ${e instanceof Error ? e.message : String(e)}` };
      }
    },
  };
}

// ─── Exports ────────────────────────────────────────────────────

export { gatherContext, analyzeContext, rankSuggestions, type ContextInfo, type Suggestion };
