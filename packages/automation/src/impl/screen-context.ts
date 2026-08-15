/**
 * Lightweight Screen Context Analyzer
 *
 * NO screenshots, NO vision LLM. Pure window title + app name inference.
 * Runs in <5ms. Uses pattern matching + heuristics.
 *
 * What it detects:
 * - What app the user is in
 * - What they're doing in that app (coding which file, watching what, etc.)
 * - Browser context (which website, what page)
 * - Active project/repo
 * - Potential issues (merge conflicts, failing tests, unsaved changes)
 * - Suggestive actions based on context
 */

export interface ScreenContext {
  app: string;
  appCategory: "coding" | "browser" | "media" | "gaming" | "communication" | "terminal" | "file_manager" | "unknown";
  activity: string;
  project?: string | undefined;
  website?: string | undefined;
  language?: string | undefined;
  hasError: boolean;
  errorHint?: string | undefined;
  suggestions: string[];
  confidence: number;
  timestamp: number;
}

// ─── App Classification ──────────────────────────────────────────

const APP_CATEGORIES: Record<string, ScreenContext["appCategory"]> = {
  // Coding
  "code": "coding", "code.exe": "coding", "cursor": "coding", "cursor.exe": "coding",
  "idea": "coding", "idea64.exe": "coding", "webstorm": "coding",
  "pycharm": "coding", "pycharm64.exe": "coding", "sublime": "coding",
  "atom": "coding", "notepad++": "coding", "vim": "coding", "nvim": "coding",
  "emacs": "coding", "gitkraken": "coding", "postman": "coding",
  "insomnia": "coding", "docker desktop": "coding", "dbeaver": "coding",
  // Browser
  "chrome": "browser", "chrome.exe": "browser", "firefox": "browser", "firefox.exe": "browser",
  "msedge": "browser", "msedge.exe": "browser", "brave": "browser", "opera": "browser",
  "vivaldi": "browser", "arc": "browser",
  // Media
  "vlc": "media", "vlc.exe": "media", "mpv": "media", "potplayer": "media",
  "spotify": "media", "spotify.exe": "media", "foobar2000": "media",
  "obs studio": "media", "obs64.exe": "media", "audacity": "media",
  // Gaming
  "roblox": "gaming", "roblox.exe": "gaming", "robloxstudio": "gaming",
  "steam": "gaming", "steam.exe": "gaming", "epicgameslauncher": "gaming",
  "origin": "gaming", "battle.net": "gaming", "gog galaxy": "gaming",
  "minecraft": "gaming", "valorant": "gaming", "league of legends": "gaming",
  "fortnite": "gaming",
  // Communication
  "slack": "communication", "slack.exe": "communication",
  "discord": "communication", "discord.exe": "communication",
  "teams": "communication", "teams.exe": "communication",
  "zoom": "communication", "zoom.exe": "communication",
  "whatsapp": "communication", "telegram": "communication",
  "outlook": "communication", "outlook.exe": "communication",
  "mail": "communication",
  // Terminal
  "windows terminal": "terminal", "wt.exe": "terminal", "cmd": "terminal",
  "cmd.exe": "terminal", "powershell": "terminal", "powershell.exe": "terminal",
  "pwsh": "terminal", "pwsh.exe": "terminal", "iterm": "terminal",
  "kitty": "terminal", "alacritty": "terminal", "wezterm": "terminal",
  "warp": "terminal", "hyper": "terminal", "conemu": "terminal",
  // File manager
  "explorer": "file_manager", "explorer.exe": "file_manager",
  "total commander": "file_manager", "doublecmd": "file_manager",
  "finder": "file_manager",
};

// ─── Website Detection from Title ────────────────────────────────

interface WebsitePattern {
  pattern: RegExp;
  name: string;
  category: string;
}

const WEBSITE_PATTERNS: WebsitePattern[] = [
  { pattern: /github/i, name: "GitHub", category: "coding" },
  { pattern: /gitlab/i, name: "GitLab", category: "coding" },
  { pattern: /stackoverflow/i, name: "StackOverflow", category: "coding" },
  { pattern: /developer\.mozilla/i, name: "MDN Docs", category: "coding" },
  { pattern: /docs\./i, name: "Documentation", category: "coding" },
  { pattern: /npmjs|npm\.com/i, name: "npm", category: "coding" },
  { pattern: /pypi/i, name: "PyPI", category: "coding" },
  { pattern: /leetcode/i, name: "LeetCode", category: "coding" },
  { pattern: /hackerrank/i, name: "HackerRank", category: "coding" },
  { pattern: /youtube/i, name: "YouTube", category: "media" },
  { pattern: /twitch/i, name: "Twitch", category: "media" },
  { pattern: /netflix/i, name: "Netflix", category: "media" },
  { pattern: /disney/i, name: "Disney+", category: "media" },
  { pattern: /prime\s*video/i, name: "Prime Video", category: "media" },
  { pattern: /hulu/i, name: "Hulu", category: "media" },
  { pattern: /spotify/i, name: "Spotify", category: "media" },
  { pattern: /twitter|x\.com/i, name: "Twitter/X", category: "communication" },
  { pattern: /linkedin/i, name: "LinkedIn", category: "communication" },
  { pattern: /gmail/i, name: "Gmail", category: "communication" },
  { pattern: /mail\.google/i, name: "Gmail", category: "communication" },
  { pattern: /discord/i, name: "Discord", category: "communication" },
  { pattern: /slack/i, name: "Slack", category: "communication" },
  { pattern: /notion/i, name: "Notion", category: "coding" },
  { pattern: /figma/i, name: "Figma", category: "coding" },
  { pattern: /jira/i, name: "Jira", category: "coding" },
  { pattern: /trello/i, name: "Trello", category: "coding" },
  { pattern: /linear/i, name: "Linear", category: "coding" },
  { pattern: /vercel/i, name: "Vercel", category: "coding" },
  { pattern: /netlify/i, name: "Netlify", category: "coding" },
  { pattern: /aws|amazon/i, name: "AWS", category: "coding" },
  { pattern: /google\s*cloud|gcp/i, name: "GCP", category: "coding" },
  { pattern: /azure/i, name: "Azure", category: "coding" },
  { pattern: /reddit/i, name: "Reddit", category: "communication" },
  { pattern: /instagram/i, name: "Instagram", category: "communication" },
  { pattern: /facebook/i, name: "Facebook", category: "communication" },
  { pattern: /roblox/i, name: "Roblox", category: "gaming" },
  { pattern: /steam/i, name: "Steam", category: "gaming" },
  { pattern: /chess/i, name: "Chess.com", category: "gaming" },
  { pattern: /duolingo/i, name: "Duolingo", category: "coding" },
  { pattern: /chatgpt|openai/i, name: "ChatGPT", category: "coding" },
  { pattern: /claude/i, name: "Claude", category: "coding" },
  { pattern: /gemini/i, name: "Gemini", category: "coding" },
  { pattern: /copilot/i, name: "GitHub Copilot", category: "coding" },
];

// ─── File Extension → Language ───────────────────────────────────

const EXT_TO_LANG: Record<string, string> = {
  ".ts": "TypeScript", ".tsx": "TypeScript/React", ".js": "JavaScript",
  ".jsx": "JavaScript/React", ".py": "Python", ".rs": "Rust", ".go": "Go",
  ".java": "Java", ".kt": "Kotlin", ".swift": "Swift", ".c": "C",
  ".cpp": "C++", ".cs": "C#", ".rb": "Ruby", ".php": "PHP",
  ".html": "HTML", ".css": "CSS", ".scss": "SCSS", ".less": "LESS",
  ".json": "JSON", ".yaml": "YAML", ".yml": "YAML", ".toml": "TOML",
  ".md": "Markdown", ".sql": "SQL", ".sh": "Shell", ".bash": "Shell",
  ".ps1": "PowerShell", ".lua": "Lua", ".dart": "Dart",
  ".vue": "Vue", ".svelte": "Svelte", ".astro": "Astro",
};

// ─── Title Parsing Patterns ──────────────────────────────────────

interface TitlePattern {
  pattern: RegExp;
  extract: (match: RegExpMatchArray) => Partial<ScreenContext>;
}

const TITLE_PATTERNS: TitlePattern[] = [
  // VS Code: "filename — projectname"
  {
    pattern: /^(.+?)\s*[—–-]\s*(.+)$/,
    extract: (m) => {
      const filename = m[1]?.trim() ?? "";
      const project = m[2]?.trim() ?? "";
      const ext = filename.includes(".") ? filename.substring(filename.lastIndexOf(".")) : "";
      return {
        project,
        language: EXT_TO_LANG[ext],
        activity: `editing ${filename}`,
      };
    },
  },
  // JetBrains: "filename — projectname"
  {
    pattern: /^(.+?)\s*[—–-]\s*(.+)$/,
    extract: (m) => ({
      project: m[2]?.trim(),
      activity: `editing ${m[1]?.trim()}`,
    }),
  },
  // Browser with URL visible
  {
    pattern: /[-–] ([^\s]+\.[a-z]{2,})/i,
    extract: (m) => ({
      website: m[1]?.trim(),
      activity: `browsing ${m[1]?.trim()}`,
    }),
  },
];

// ─── Main Analyzer ───────────────────────────────────────────────

export function analyzeScreenContext(
  app: string,
  title: string,
): ScreenContext {
  const appLower = app.toLowerCase().replace(/\.exe$/, "");
  const category = APP_CATEGORIES[appLower] ?? APP_CATEGORIES[app] ?? "unknown";

  const context: ScreenContext = {
    app,
    appCategory: category,
    activity: "",
    hasError: false,
    suggestions: [],
    confidence: 0.5,
    timestamp: Date.now(),
  };

  // 1. Detect website from title
  for (const wp of WEBSITE_PATTERNS) {
    if (wp.pattern.test(title)) {
      context.website = wp.name;
      context.confidence = 0.8;
      break;
    }
  }

  // 2. Parse title for context (only for non-browser apps)
  if (category !== "browser") {
    for (const tp of TITLE_PATTERNS) {
      const match = title.match(tp.pattern);
      if (match) {
        Object.assign(context, tp.extract(match));
        context.confidence = 0.7;
        break;
      }
    }
  }

  // 3. Detect errors from title
  const errorPatterns = [
    /error/i, /failed/i, /failure/i, /exception/i, /crash/i,
    /not found/i, /404/i, /500/i, /timeout/i, /refused/i,
    /cannot/i, /unable/i, /denied/i, /forbidden/i, /unauthorized/i,
    /conflict/i, /merge conflict/i,
  ];
  for (const ep of errorPatterns) {
    if (ep.test(title)) {
      context.hasError = true;
      context.errorHint = title.match(ep)?.[0]?.toLowerCase();
      break;
    }
  }

  // 4. Generate activity description
  if (!context.activity) {
    context.activity = inferActivity(category, appLower, title, context.website);
  }

  // 5. Generate suggestions based on context
  context.suggestions = generateSuggestions(context, title);

  return context;
}

// ─── Activity Inference ──────────────────────────────────────────

function inferActivity(
  category: ScreenContext["appCategory"],
  app: string,
  title: string,
  website?: string,
): string {
  switch (category) {
    case "coding": {
      const fileMatch = title.match(/(\w+\.\w{1,5})\s/);
      const file = fileMatch?.[1];
      if (file) return `coding in ${file}`;
      if (app.includes("git")) return "using git";
      if (app.includes("docker")) return "managing containers";
      return "coding";
    }
    case "browser": {
      if (website) return `browsing ${website}`;
      return "browsing";
    }
    case "media": {
      if (app.includes("spotify")) return "listening to music";
      if (app.includes("vlc") || app.includes("mpv")) return "watching video";
      return "consuming media";
    }
    case "gaming": {
      if (app.includes("roblox")) return "playing Roblox";
      if (app.includes("steam")) return "using Steam";
      return "gaming";
    }
    case "communication": {
      if (app.includes("slack")) return "in Slack";
      if (app.includes("discord")) return "in Discord";
      if (app.includes("teams")) return "in Teams";
      if (app.includes("zoom")) return "in a meeting";
      return "communicating";
    }
    case "terminal": {
      const cmdMatch = title.match(/(?:>|λ|\$)\s*(\w+)/);
      if (cmdMatch) return `running ${cmdMatch[1]}`;
      return "in terminal";
    }
    default:
      return `using ${app}`;
  }
}

// ─── Suggestion Generation ───────────────────────────────────────

function generateSuggestions(ctx: ScreenContext, title: string): string[] {
  const suggestions: string[] = [];

  // Error-based suggestions
  if (ctx.hasError) {
    suggestions.push(`I see an error: "${ctx.errorHint}". Need help debugging?`);
  }

  // Context-specific suggestions
  switch (ctx.appCategory) {
    case "coding":
      if (ctx.language) {
        suggestions.push(`Working with ${ctx.language}. Need help with code?`);
      }
      if (/git/i.test(title)) {
        if (/conflict/i.test(title)) suggestions.push("Merge conflict detected. Want me to help resolve it?");
        if (/rebase/i.test(title)) suggestions.push("Rebase in progress. Need help?");
      }
      if (ctx.project) {
        suggestions.push(`Project: ${ctx.project}. Need help with this codebase?`);
      }
      break;

    case "browser":
      if (ctx.website === "GitHub") {
        if (/pull/i.test(title)) suggestions.push("Looking at a PR. Need help reviewing code?");
        if (/issue/i.test(title)) suggestions.push("Reading an issue. Need help with a solution?");
      }
      if (ctx.website === "StackOverflow") {
        suggestions.push("Researching on StackOverflow. Need help with the answer?");
      }
      if (ctx.website === "LeetCode") {
        suggestions.push("On LeetCode. Want me to help solve the problem?");
      }
      if (ctx.website === "YouTube") {
        suggestions.push("Watching YouTube. Want me to take notes or summarize?");
      }
      break;

    case "gaming":
      suggestions.push("Gaming mode. Want me to enable DND?");
      break;

    case "communication":
      if (ctx.website === "Slack" || ctx.app.toLowerCase().includes("slack")) {
        suggestions.push("In Slack. Want me to summarize unread messages?");
      }
      if (ctx.website === "Gmail" || ctx.app.toLowerCase().includes("mail")) {
        suggestions.push("Checking email. Want me to draft a reply?");
      }
      break;
  }

  return suggestions;
}

// ─── Batch Analysis (for tick loop) ──────────────────────────────

export function analyzeAndCompare(
  previous: ScreenContext | null,
  current: ScreenContext,
): {
  changed: boolean;
  newSuggestions: string[];
  context: ScreenContext;
} {
  const changed = !previous
    || previous.app !== current.app
    || previous.activity !== current.activity;

  const newSuggestions = changed ? current.suggestions : [];

  return { changed, newSuggestions, context: current };
}
