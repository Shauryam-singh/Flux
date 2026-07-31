import { execSync } from "node:child_process";
import type { ObservationSource } from "@ai-agent/attention";

/**
 * Detects browser context — which site the user is on,
 * whether they're looking at code, docs, or searching.
 * Works on CachyOS + HyDE (hyprctl) and Windows 11.
 */
export interface BrowserContext {
  readonly site: string;
  readonly url: string;
  readonly tabTitle: string;
  readonly browser: string;
  readonly isGitHub: boolean;
  readonly isStackOverflow: boolean;
  readonly isDocs: boolean;
  readonly isSearchEngine: boolean;
  readonly isYouTube: boolean;
  readonly isAIChat: boolean;
  readonly isCodeReview: boolean;
  readonly isPRPage: boolean;
  readonly isIssuePage: boolean;
}

const GITHUB_PATTERNS = ["github.com"];
const SO_PATTERNS = ["stackoverflow.com", "stackexchange.com"];
const DOCS_PATTERNS = [
  "docs.",
  "developer.mozilla",
  "readthedocs",
  "docs.rs",
  "pkg.go.dev",
  "pkgdocs.",
  "typescriptlang.org",
  "rust-lang.org",
  "python.org/doc",
  "nodejs.org/docs",
];
const SEARCH_ENGINES = ["google.com", "bing.com", "duckduckgo.com", "brave.com/search"];
const YOUTUBE_PATTERNS = ["youtube.com", "youtu.be"];
const AI_CHAT_PATTERNS = [
  "chat.openai.com",
  "chatgpt.com",
  "claude.ai",
  "copilot.microsoft",
  "gemini.google",
  "poe.com",
  "you.com",
];

export class BrowserContextSensor {
  private readonly isWindows: boolean;
  private lastContext: BrowserContext | null = null;

  constructor() {
    this.isWindows = process.platform === "win32";
  }

  /**
   * Detect current browser context from the active window title.
   * Browser tabs usually show: "Page Title - BrowserName"
   */
  detectFromWindowTitle(title: string, app: string): BrowserContext | null {
    const appLower = app.toLowerCase();
    const titleLower = title.toLowerCase();

    // Is this a browser?
    const isBrowser =
      appLower.includes("firefox") ||
      appLower.includes("chrome") ||
      appLower.includes("brave") ||
      appLower.includes("chromium") ||
      appLower.includes("edge") ||
      appLower.includes("opera") ||
      appLower.includes("vivaldi") ||
      appLower.includes("librewolf") ||
      appLower.includes("waterfox") ||
      appLower.includes("qutebrowser");

    if (!isBrowser) return null;

    // Extract site from title (usually "Page Title — SiteName" or "Page Title - SiteName")
    const parts = title.split(/ — | - /);
    const sitePart = parts[parts.length - 1]?.trim() ?? "";
    const tabTitle = parts.slice(0, -1).join(" - ").trim() || title;

    const context: BrowserContext = {
      site: sitePart,
      url: "", // We don't always get the URL from title
      tabTitle,
      browser: app,
      isGitHub: GITHUB_PATTERNS.some((p) => sitePart.toLowerCase().includes(p) || titleLower.includes(p)),
      isStackOverflow: SO_PATTERNS.some((p) => sitePart.toLowerCase().includes(p) || titleLower.includes(p)),
      isDocs: DOCS_PATTERNS.some((p) => sitePart.toLowerCase().includes(p) || titleLower.includes(p)),
      isSearchEngine: SEARCH_ENGINES.some((p) => sitePart.toLowerCase().includes(p)),
      isYouTube: YOUTUBE_PATTERNS.some((p) => sitePart.toLowerCase().includes(p) || titleLower.includes(p)),
      isAIChat: AI_CHAT_PATTERNS.some((p) => sitePart.toLowerCase().includes(p) || titleLower.includes(p)),
      isCodeReview: titleLower.includes("pull request") || titleLower.includes("code review"),
      isPRPage: titleLower.includes("pull request") && titleLower.includes("github"),
      isIssuePage: titleLower.includes("issue") && titleLower.includes("github"),
    };

    this.lastContext = context;
    return context;
  }

  /**
   * Try to get the actual URL from the browser (Firefox/Chrome DevTools Protocol).
   * Only works if browser has remote debugging enabled.
   */
  tryGetUrl(): string | null {
    if (this.isWindows) {
      return this.getUrlWindows();
    }
    return this.getUrlLinux();
  }

  private getUrlWindows(): string | null {
    // Try PowerShell to read clipboard (user might copy URL)
    // This is a fallback — not reliable
    return null;
  }

  private getUrlLinux(): string | null {
    // Try xdotool to get window title (often contains URL for some browsers)
    try {
      const raw = execSync(
        "xdotool getactivewindow getwindowname 2>/dev/null",
        { encoding: "utf-8", timeout: 1000 },
      ).trim();

      // Some browsers show URL in title
      if (raw.includes("://") || raw.includes("www.")) {
        const urlMatch = raw.match(/(https?:\/\/[^\s]+)/);
        return urlMatch?.[1] ?? null;
      }
    } catch {
      // ignore
    }

    return null;
  }

  getLastContext(): BrowserContext | null {
    return this.lastContext;
  }
}
