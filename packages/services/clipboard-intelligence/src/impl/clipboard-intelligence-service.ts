/**
 * Clipboard Intelligence Service
 *
 * Clipboard history, read/translate/summarize clipboard content via LLM.
 * Cross-platform clipboard detection.
 *
 * Commands:
 *   "what's on my clipboard" — read clipboard content
 *   "translate my clipboard" — translate clipboard content
 *   "summarize clipboard" — summarize clipboard content
 *   "clipboard history" — show clipboard history (ring buffer)
 *   "copy and explain" — copy to clipboard and explain
 *   "convert clipboard to markdown" — format clipboard as markdown
 *   "explain clipboard" — explain clipboard content
 *   "summarize that" — summarize clipboard content
 *   "translate clipboard to <lang>" — translate to language
 *   "format clipboard" — format/pretify clipboard content
 */

import { execSync } from "node:child_process";
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

// ─── Clipboard Detection ────────────────────────────────────────

function detectClipboard(): { platform: string; available: boolean } {
  const platform = process.platform;

  if (platform === "linux") {
    // Check for Wayland or X11 clipboard
    const wayland = !!process.env.WAYLAND_DISPLAY;
    const x11 = !!process.env.DISPLAY;

    if (wayland) {
      return { platform: "wayland", available: !!run("which wl-copy 2>/dev/null") };
    }
    if (x11) {
      return { platform: "x11", available: !!run("which xclip 2>/dev/null") || !!run("which xsel 2>/dev/null") };
    }
  }

  if (platform === "win32") {
    return { platform: "windows", available: true };
  }

  if (platform === "darwin") {
    return { platform: "macos", available: true };
  }

  return { platform: "unknown", available: false };
}

// ─── Read Clipboard ─────────────────────────────────────────────

function readClipboard(): string {
  const { platform, available } = detectClipboard();
  if (!available) return "Clipboard not available";

  if (platform === "wayland") {
    return run("wl-paste 2>/dev/null");
  }
  if (platform === "x11") {
    return run("xclip -selection clipboard -o 2>/dev/null");
  }
  if (platform === "windows") {
    return runPs("Get-Clipboard -Format Text -ErrorAction SilentlyContinue");
  }
  if (platform === "macos") {
    return run("pbpaste 2>/dev/null");
  }

  return "Clipboard not supported on this platform";
}

// ─── Clipboard History (Ring Buffer) ────────────────────────────

const clipboardHistory: string[] = [];
const MAX_HISTORY = 50;
let lastClipboard = "";

export function pollClipboardHistory(): void {
  const current = readClipboard();
  if (current && current !== lastClipboard && current.length < 10000) {
    lastClipboard = current;
    clipboardHistory.unshift(current);
    if (clipboardHistory.length > MAX_HISTORY) clipboardHistory.pop();
  }
}

// Start polling
setInterval(pollClipboardHistory, 5000);

function getHistory(): string {
  if (clipboardHistory.length === 0) return "No clipboard history yet.";

  return clipboardHistory.slice(0, 20).map((item, i) => {
    const preview = item.length > 100 ? item.slice(0, 100) + "..." : item;
    return `${i + 1}. ${preview.replace(/\n/g, " ")}`;
  }).join("\n");
}

// ─── Clipboard Operations ───────────────────────────────────────

function copyToClipboard(text: string): boolean {
  const { platform, available } = detectClipboard();
  if (!available) return false;

  if (platform === "wayland") {
    execSync(`echo -n ${JSON.stringify(text)} | wl-copy`, { stdio: "pipe" });
    return true;
  }
  if (platform === "x11") {
    execSync(`echo -n ${JSON.stringify(text)} | xclip -selection clipboard`, { stdio: "pipe" });
    return true;
  }
  if (platform === "windows") {
    runPs(`Set-Clipboard -Value "${text.replace(/"/g, '`"')}"`);
    return true;
  }
  if (platform === "macos") {
    execSync(`echo -n ${JSON.stringify(text)} | pbcopy`, { stdio: "pipe" });
    return true;
  }

  return false;
}

// ─── Service ────────────────────────────────────────────────────

const MATCH = /\b(clipboard|copy|paste|clip|what('s| is)\s+(on|in)\s+(my\s+)?clipboard|translate\s+(?:my\s+)?clipboard|summarize\s+(?:my\s+)?clipboard|clipboard\s+history|explain\s+(?:my\s+)?clipboard|convert\s+clipboard|format\s+clipboard|summarize\s+that|translate\s+clipboard)\b/i;

export function createClipboardIntelligenceService(): Service {
  return {
    name: "clipboard-intelligence",
    description: "Clipboard intelligence — history, translate, summarize clipboard content",
    canHandle: (input: string) => MATCH.test(input),

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const lower = input.toLowerCase();

      try {
        const clipboardContent = readClipboard();
        if (!clipboardContent) return { text: "Clipboard is empty" };

        // Read clipboard
        if (/\b(what('s| is)\s+(on|in)\s+(my\s+)?clipboard|read\s+(?:my\s+)?clipboard|get\s+clipboard|paste)\b/.test(lower)) {
          return { text: `Clipboard content:\n\n${clipboardContent}` };
        }

        // History
        if (/\bhistory\b/.test(lower)) {
          return { text: `Clipboard history:\n\n${getHistory()}` };
        }

        // Explain
        if (/\bexplain\b/.test(lower)) {
          return { text: `Clipboard content:\n\n${clipboardContent}` };
        }

        // Translate
        const langMatch = lower.match(/translate\s+(?:my\s+)?clipboard\s+(?:to\s+)?(\w+)/);
        if (langMatch) {
          return { text: `Clipboard content to translate (${langMatch[1]}):\n\n${clipboardContent}` };
        }
        if (/\btranslate\b/.test(lower)) {
          return { text: `Clipboard content to translate:\n\n${clipboardContent}` };
        }

        // Summarize
        if (/\bsummarize\b/.test(lower) || /\bsummarise\b/.test(lower)) {
          return { text: `Clipboard content to summarize:\n\n${clipboardContent}` };
        }

        // Convert/Format
        if (/\b(convert|format)\b/.test(lower)) {
          return { text: `Clipboard content to format:\n\n${clipboardContent}` };
        }

        // Copy text to clipboard
        const copyMatch = input.match(/\bcopy\s+(.+?)\s+to\s+(?:my\s+)?clipboard/i);
        if (copyMatch) {
          const success = copyToClipboard(copyMatch[1]!);
          return { text: success ? `Copied to clipboard: ${copyMatch[1]}` : "Failed to copy to clipboard" };
        }

        // Default: show content
        return { text: `Clipboard:\n\n${clipboardContent}` };
      } catch (e) {
        return { text: `Clipboard error: ${e instanceof Error ? e.message : String(e)}` };
      }
    },
  };
}
