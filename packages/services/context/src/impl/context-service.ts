import type { Service } from "@ai-agent/services-core";
import type { ServiceContext } from "@ai-agent/services-core";
import type { ServiceResponse } from "@ai-agent/services-core";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface ContextSnapshot {
  timestamp: string;
  activeWindow?: string;
  activeApp?: string;
  activeFile?: string;
  workingDirectory?: string;
  openFiles: string[];
  recentCommands: string[];
  currentTask?: string;
  userIntent?: string;
}

export interface UserContext {
  id: string;
  name: string;
  preferences: Record<string, string>;
  habits: string[];
  currentProject?: string;
  currentTask?: string;
  lastActive: string;
  history: ContextSnapshot[];
}

const CONTEXT_DIR = path.join(os.homedir(), ".ai-agent", "context");
const CONTEXT_FILE = path.join(CONTEXT_DIR, "user-context.json");
const SNAPSHOTS_FILE = path.join(CONTEXT_DIR, "snapshots.json");

function ensureDir(): void {
  if (!fs.existsSync(CONTEXT_DIR)) {
    fs.mkdirSync(CONTEXT_DIR, { recursive: true });
  }
}

function loadContext(): UserContext {
  try {
    ensureDir();
    if (fs.existsSync(CONTEXT_FILE)) {
      return JSON.parse(fs.readFileSync(CONTEXT_FILE, "utf-8"));
    }
  } catch {
    // ignore
  }
  return {
    id: `user_${Date.now()}`,
    name: "User",
    preferences: {},
    habits: [],
    lastActive: new Date().toISOString(),
    history: [],
  };
}

function saveContext(context: UserContext): void {
  ensureDir();
  fs.writeFileSync(CONTEXT_FILE, JSON.stringify(context, null, 2));
}

function loadSnapshots(): ContextSnapshot[] {
  try {
    ensureDir();
    if (fs.existsSync(SNAPSHOTS_FILE)) {
      return JSON.parse(fs.readFileSync(SNAPSHOTS_FILE, "utf-8"));
    }
  } catch {
    // ignore
  }
  return [];
}

function saveSnapshots(snapshots: ContextSnapshot[]): void {
  ensureDir();
  // Keep only last 100 snapshots
  const trimmed = snapshots.slice(-100);
  fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify(trimmed, null, 2));
}

function getActiveWindow(): { app: string; title: string } | null {
  try {
    const { execSync } = require("node:child_process");
    const platform = process.platform;

    if (platform === "linux") {
      // Get active window ID
      const windowId = execSync("xdotool getactivewindow 2>/dev/null", {
        encoding: "utf-8",
        timeout: 2000,
      }).trim();

      if (windowId) {
        // Get window name/title
        const name = execSync(`xdotool getwindowname ${windowId} 2>/dev/null`, {
          encoding: "utf-8",
          timeout: 2000,
        }).trim();

        // Get window class (app name)
        const className = execSync(`xprop -id ${windowId} WM_CLASS 2>/dev/null`, {
          encoding: "utf-8",
          timeout: 2000,
        }).trim();

        const appMatch = className.match(/"([^"]+)"/);
        const app = appMatch?.[1] ?? "unknown";

        return { app, title: name };
      }
    } else if (platform === "darwin") {
      const output = execSync(
        'osascript -e "tell application \\"System Events\\" to get name of first application process whose frontmost is true"',
        { encoding: "utf-8", timeout: 2000 },
      ).trim();
      return { app: output, title: output };
    }
  } catch {
    // ignore
  }
  return null;
}

function getOpenFiles(): string[] {
  try {
    const { execSync } = require("node:child_process");
    const platform = process.platform;

    if (platform === "linux") {
      // Get recently accessed files
      const output = execSync(
        "find ~ -maxdepth 3 -type f -newer /tmp -name '*.ts' -o -name '*.js' -o -name '*.py' -o -name '*.rs' -o -name '*.go' -o -name '*.java' 2>/dev/null | head -20",
        { encoding: "utf-8", timeout: 5000 },
      );
      return output.trim().split("\n").filter(Boolean);
    }
  } catch {
    // ignore
  }
  return [];
}

function detectProject(directory: string): string | null {
  try {
    if (fs.existsSync(path.join(directory, "package.json"))) {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(directory, "package.json"), "utf-8"),
      );
      return pkg.name ?? null;
    }
    if (fs.existsSync(path.join(directory, "Cargo.toml"))) {
      return "rust-project";
    }
    if (fs.existsSync(path.join(directory, "go.mod"))) {
      return "go-project";
    }
    if (fs.existsSync(path.join(directory, "pyproject.toml"))) {
      return "python-project";
    }
  } catch {
    // ignore
  }
  return null;
}

export function createContextService(): Service {
  return {
    name: "context",
    description: "Persistent context memory: remembers what you're working on, your habits, preferences, and project history across sessions",

    async canHandle(input: string): Promise<boolean> {
      const lower = input.toLowerCase();
      const keywords = [
        "context", "remember", "memory", "what was i",
        "what am i working", "my project", "my preferences",
        "what did we", "history", "recall",
      ];
      return keywords.some((k) => lower.includes(k));
    },

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const lower = input.toLowerCase();
      let result: string;

      if (/^(show|what('s| is))\s+(my\s+)?context/i.test(lower)) {
        const context = loadContext();
        const recent = context.history.slice(-5);

        if (recent.length === 0) {
          result = "No context recorded yet. I'll start tracking what you're working on.";
        } else {
          const latest = recent[recent.length - 1]!;
          const lines = [
            `**Your Context:**`,
            latest.activeApp ? `App: ${latest.activeApp}` : null,
            latest.activeFile ? `File: ${latest.activeFile}` : null,
            latest.workingDirectory ? `Directory: ${latest.workingDirectory}` : null,
            latest.currentTask ? `Task: ${latest.currentTask}` : null,
            latest.openFiles.length > 0 ? `Open files: ${latest.openFiles.length}` : null,
            "",
            `**Recent activity:** (${recent.length} snapshots)`,
            ...recent.map((s) => {
              const time = new Date(s.timestamp).toLocaleTimeString();
              return `- ${time}: ${s.activeApp ?? "unknown"} — ${s.activeWindow ?? "no title"}`;
            }),
          ].filter(Boolean);

          result = lines.join("\n");
        }
      } else if (/^(what did we|what was i)\s+(do|work|talk)/i.test(lower)) {
        const context = loadContext();
        const recent = context.history.slice(-10);

        if (recent.length === 0) {
          result = "I don't have any context yet. Start working on something and I'll remember it.";
        } else {
          const apps = [...new Set(recent.map((s) => s.activeApp).filter(Boolean))];
          const files = [...new Set(recent.flatMap((s) => s.openFiles).filter(Boolean))];

          result = [
            `**What we've been doing:**`,
            `Apps used: ${apps.join(", ") || "none tracked"}`,
            `Files touched: ${files.length} files`,
            context.currentProject ? `Project: ${context.currentProject}` : null,
            "",
            `I'll keep tracking so I can help you better.`,
          ].filter(Boolean).join("\n");
        }
      } else if (/^(set|update|change)\s+(my\s+)?(name|preference)/i.test(lower)) {
        const context = loadContext();
        const match = input.match(/(?:set|update|change)\s+(?:my\s+)?(name|preference)\s+(?:to\s+)?(.+)/i);

        if (match) {
          const key = match[1]!.toLowerCase();
          const value = match[2]!.trim();

          if (key === "name") {
            context.name = value;
            result = `Got it! I'll call you **${value}** from now on.`;
          } else {
            context.preferences[key] = value;
            result = `Updated your preference: **${key}** = ${value}`;
          }
          saveContext(context);
        } else {
          result = "Usage: `set my name to [name]` or `set my preference [key] to [value]`";
        }
      } else if (/^(forget|clear)\s+(my\s+)?(context|memory|history)/i.test(lower)) {
        saveContext({
          id: `user_${Date.now()}`,
          name: "User",
          preferences: {},
          habits: [],
          lastActive: new Date().toISOString(),
          history: [],
        });
        saveSnapshots([]);
        result = "Context cleared. Fresh start!";
      } else if (/^(track|record)\s+(this|what i('m| am))/i.test(lower)) {
        const context = loadContext();
        const task = input.replace(/^(track|record)\s+(this|what i('m| am))\s*/i, "").trim();

        if (task) {
          context.currentTask = task;
          context.history.push({
            timestamp: new Date().toISOString(),
            currentTask: task,
            openFiles: [],
            recentCommands: [],
          });
          saveContext(context);
          result = `Tracking: **${task}**. I'll remember this.`;
        } else {
          result = "What would you like me to track? `track this [description]`";
        }
      } else if (/^(who am i|what('s| is) my name)/i.test(lower)) {
        const context = loadContext();
        result = context.name !== "User"
          ? `You're **${context.name}**! We've been working together for a while now.`
          : "I don't know your name yet. Tell me! `set my name to [name]`";
      } else {
        result = "I can remember your context. Try:\n- `show my context` — see what I know\n- `what were we doing` — recent activity\n- `track this [task]` — set current task\n- `set my name to [name]` — tell me who you are";
      }

      await ctx.memory.add("user", input);
      await ctx.memory.add("assistant", result);
      ctx.reply(result);

      return { text: result };
    },
  };
}

// Export for use by other services
export { loadContext, saveContext, loadSnapshots, saveSnapshots, getActiveWindow, getOpenFiles, detectProject };
