import type { Tool } from "../../interfaces/tool.js";
import { DefaultTool } from "../../tool/default-tool.js";

interface ScreenState {
  activeApp: string;
  activeTitle: string;
  openWindows: string[];
  timestamp: string;
}

let lastState: ScreenState | null = null;

function getActiveWindow(): { app: string; title: string } {
  try {
    const { execSync } = require("node:child_process");
    const platform = process.platform;

    if (platform === "linux") {
      const windowId = execSync("xdotool getactivewindow 2>/dev/null", {
        encoding: "utf-8",
        timeout: 2000,
      }).trim();

      if (windowId) {
        const name = execSync(`xdotool getwindowname ${windowId} 2>/dev/null`, {
          encoding: "utf-8",
          timeout: 2000,
        }).trim();

        const className = execSync(`xprop -id ${windowId} WM_CLASS 2>/dev/null`, {
          encoding: "utf-8",
          timeout: 2000,
        }).trim();

        const appMatch = className.match(/"([^"]+)"/);
        return { app: appMatch?.[1] ?? "unknown", title: name };
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
  return { app: "unknown", title: "unknown" };
}

function getOpenWindows(): string[] {
  try {
    const { execSync } = require("node:child_process");
    const platform = process.platform;

    if (platform === "linux") {
      const output = execSync("wmctrl -l 2>/dev/null || xdotool search --name '.' getwindowname 2>/dev/null", {
        encoding: "utf-8",
        timeout: 3000,
      });
      return output.trim().split("\n").filter(Boolean);
    } else if (platform === "darwin") {
      const output = execSync(
        'osascript -e "tell application \\"System Events\\" to get name of every application process whose visible is true"',
        { encoding: "utf-8", timeout: 3000 },
      );
      return output.trim().split(", ").filter(Boolean);
    }
  } catch {
    // ignore
  }
  return [];
}

function detectContext(app: string, title: string): string {
  const lower = (app + " " + title).toLowerCase();

  // Code editors
  if (lower.includes("code") || lower.includes("vim") || lower.includes("emacs") || lower.includes("nano")) {
    return "coding";
  }
  if (lower.includes("studio") || lower.includes("intellij") || lower.includes("idea")) {
    return "coding";
  }

  // Terminals
  if (lower.includes("terminal") || lower.includes("konsole") || lower.includes("gnome-terminal") || lower.includes("iterm")) {
    return "terminal";
  }
  if (lower.includes("bash") || lower.includes("zsh") || lower.includes("fish")) {
    return "terminal";
  }

  // Browsers
  if (lower.includes("chrome") || lower.includes("firefox") || lower.includes("safari") || lower.includes("edge")) {
    return "browsing";
  }

  // Communication
  if (lower.includes("slack") || lower.includes("discord") || lower.includes("telegram") || lower.includes("whatsapp")) {
    return "communicating";
  }

  // Documents
  if (lower.includes("word") || lower.includes("docs") || lower.includes("notion") || lower.includes("obsidian")) {
    return "writing";
  }

  // Design
  if (lower.includes("figma") || lower.includes("photoshop") || lower.includes("illustrator") || lower.includes("sketch")) {
    return "designing";
  }

  // Music
  if (lower.includes("spotify") || lower.includes("music") || lower.includes("youtube music")) {
    return "listening";
  }

  return "unknown";
}

function suggestForContext(context: string, app: string, title: string): string | null {
  const suggestions: Record<string, string[]> = {
    coding: [
      "Need me to run the tests?",
      "Want me to review that code?",
      "Should I commit those changes?",
      "Want me to format/lint that file?",
      "Need help with that function?",
    ],
    terminal: [
      "Need me to run a command?",
      "Want me to check system resources?",
      "Should I create a new project?",
    ],
    browsing: [
      "Want me to search for something?",
      "Should I save that link?",
      "Need me to look up documentation?",
    ],
    communicating: [
      "Want me to set a reminder?",
      "Should I take a note?",
      "Need me to schedule something?",
    ],
    writing: [
      "Want me to check your grammar?",
      "Should I save a backup?",
      "Need me to look up something?",
    ],
    designing: [
      "Want me to export that?",
      "Need me to check the dimensions?",
    ],
    listening: [
      "Enjoying the music?",
      "Want me to play something different?",
    ],
  };

  const contextSuggestions = suggestions[context];
  if (contextSuggestions && contextSuggestions.length > 0) {
    return contextSuggestions[Math.floor(Math.random() * contextSuggestions.length)]!;
  }
  return null;
}

export function createScreenMonitorTool(): Tool {
  return new DefaultTool(
    "screen_monitor",
    "Monitor what you're doing: detect active app, track context, suggest relevant actions. Use 'check' to see current state, 'watch' to start monitoring.",
    async (input) => {
      const action = (input.action as string) || "check";

      try {
        switch (action) {
          case "check": {
            const { app, title } = getActiveWindow();
            const windows = getOpenWindows();
            const context = detectContext(app, title);
            const suggestion = suggestForContext(context, app, title);

            const state: ScreenState = {
              activeApp: app,
              activeTitle: title,
              openWindows: windows,
              timestamp: new Date().toISOString(),
            };

            const changed = lastState?.activeApp !== app || lastState?.activeTitle !== title;
            lastState = state;

            return {
              success: true,
              output: {
                activeApp: app,
                activeTitle: title,
                context,
                suggestion,
                changed,
                openWindows: windows.length,
                windowList: windows.slice(0, 10),
              },
            };
          }

          case "diff": {
            const { app, title } = getActiveWindow();
            const context = detectContext(app, title);
            const suggestion = suggestForContext(context, app, title);

            const previous = lastState;
            const current: ScreenState = {
              activeApp: app,
              activeTitle: title,
              openWindows: getOpenWindows(),
              timestamp: new Date().toISOString(),
            };

            lastState = current;

            const changes: string[] = [];
            if (previous) {
              if (previous.activeApp !== app) {
                changes.push(`App: ${previous.activeApp} → ${app}`);
              }
              if (previous.activeTitle !== title) {
                changes.push(`Title: ${previous.activeTitle} → ${title}`);
              }
            }

            return {
              success: true,
              output: {
                current: { app, title, context },
                previous: previous ? { app: previous.activeApp, title: previous.activeTitle } : null,
                changes,
                suggestion,
                timestamp: current.timestamp,
              },
            };
          }

          case "windows": {
            const windows = getOpenWindows();
            return {
              success: true,
              output: {
                windows,
                count: windows.length,
              },
            };
          }

          default:
            return {
              success: false,
              output: {
                error: `Unknown action: ${action}. Available: check, diff, windows`,
              },
            };
        }
      } catch (error) {
        return {
          success: false,
          output: {
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }
    },
  );
}
