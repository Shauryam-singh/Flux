import type { ActivityMode, ActivitySnapshot } from "../types/index.js";

const APP_MODE_MAP: Record<string, ActivityMode> = {
  // Coding
  "code.exe": "coding",
  "code": "coding",
  "cursor": "coding",
  "idea.exe": "coding",
  "webstorm.exe": "coding",
  "pycharm.exe": "coding",
  "gitkraken.exe": "coding",
  "postman.exe": "coding",
  // Gaming
  "roblox.exe": "gaming",
  "robloxstudio.exe": "gaming",
  "steam.exe": "gaming",
  "epicgameslauncher.exe": "gaming",
  "origin.exe": "gaming",
  "battle.net.exe": "gaming",
  "leagueoflegends.exe": "gaming",
  "valorant.exe": "gaming",
  "minecraft.exe": "gaming",
  "fortnite.exe": "gaming",
  // Watching
  "vlc.exe": "watching",
  "mpv.exe": "watching",
  "plex.exe": "watching",
  "netflix.exe": "watching",
  "disneyplus.exe": "watching",
  "hbomax.exe": "watching",
  "primevideo.exe": "watching",
  // Browsing
  "chrome.exe": "browsing",
  "msedge.exe": "browsing",
  "firefox.exe": "browsing",
  "brave.exe": "browsing",
  "opera.exe": "browsing",
  // Communicating
  "slack.exe": "communicating",
  "discord.exe": "communicating",
  "telegram.exe": "communicating",
  "whatsapp.exe": "communicating",
  "teams.exe": "communicating",
  "zoom.exe": "communicating",
  "skype.exe": "communicating",
  "mail.exe": "communicating",
  "outlook.exe": "communicating",
  // Document / Study
  "notion.exe": "studying",
  "obsidian.exe": "studying",
  "evernote.exe": "studying",
  "anki.exe": "studying",
  "kindle.exe": "studying",
};

const TITLE_KEYWORDS: [string, ActivityMode][] = [
  ["youtube", "watching"],
  ["netflix", "watching"],
  ["disney", "watching"],
  ["twitch", "watching"],
  ["prime video", "watching"],
  ["hulu", "watching"],
  ["hbo", "watching"],
  ["jira", "coding"],
  ["github", "coding"],
  ["gitlab", "coding"],
  ["stackoverflow", "coding"],
  ["leetcode", "studying"],
  ["hackerrank", "studying"],
  ["gmail", "communicating"],
  ["linkedin", "browsing"],
  ["instagram", "browsing"],
  ["twitter", "browsing"],
  ["reddit", "browsing"],
  ["facebook", "browsing"],
  ["roblox", "gaming"],
  ["steam", "gaming"],
];

export class ActivityClassifier {
  classify(snapshot: Omit<ActivitySnapshot, "mode" | "timestamp">): ActivityMode {
    const app = snapshot.activeApp.toLowerCase();
    const title = snapshot.activeWindowTitle.toLowerCase();

    // Idle detection (highest priority when idle)
    if (snapshot.idleSeconds > 300) return "idle";

    // Title-based detection (before app, since title is more specific)
    for (const [keyword, mode] of TITLE_KEYWORDS) {
      if (title.includes(keyword)) return mode;
    }

    // App-based detection
    const appMode = APP_MODE_MAP[app];
    if (appMode) return appMode;

    // Browser with no specific content = browsing
    if (["chrome.exe", "msedge.exe", "firefox.exe"].includes(app)) return "browsing";

    return "unknown";
  }

  classifyWithConfidence(snapshot: Omit<ActivitySnapshot, "mode" | "timestamp">): { mode: ActivityMode; confidence: number; reasons: string[] } {
    const reasons: string[] = [];
    const app = snapshot.activeApp.toLowerCase();
    const title = snapshot.activeWindowTitle.toLowerCase();

    // Idle detection first
    if (snapshot.idleSeconds > 300) {
      reasons.push(`idle:${snapshot.idleSeconds}s`);
      return { mode: "idle", confidence: 0.8, reasons };
    }

    // Title match = medium confidence
    for (const [keyword, mode] of TITLE_KEYWORDS) {
      if (title.includes(keyword)) {
        reasons.push(`title:${keyword} -> ${mode}`);
        return { mode, confidence: 0.7, reasons };
      }
    }

    // App match = high confidence
    const appMode = APP_MODE_MAP[app];
    if (appMode) {
      reasons.push(`app:${app} -> ${appMode}`);
      return { mode: appMode, confidence: 0.9, reasons };
    }

    // Browser fallback
    if (["chrome.exe", "msedge.exe", "firefox.exe"].includes(app)) {
      reasons.push(`browser:${app} -> browsing`);
      return { mode: "browsing", confidence: 0.5, reasons };
    }

    reasons.push("no_match");
    return { mode: "unknown", confidence: 0.1, reasons };
  }
}
