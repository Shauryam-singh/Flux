import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ContextProfile, ActivityMode } from "../types/index.js";

const PROFILES_FILE = join(homedir(), ".flux", "profiles.json");

const DEFAULT_PROFILES: ContextProfile[] = [
  {
    id: "profile_coding",
    name: "Coding Mode",
    mode: "coding",
    apps: ["code.exe", "cursor", "idea.exe", "gitkraken.exe", "postman.exe"],
    dndEnabled: true,
    autoActions: [
      { id: "dnd_on", type: "dnd", detail: "Enable Do Not Disturb", enabled: true },
      { id: "focus_vscode", type: "focus_mode", detail: "Focus on VS Code", enabled: true },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    matchCount: 0,
  },
  {
    id: "profile_gaming",
    name: "Gaming Mode",
    mode: "gaming",
    apps: ["roblox.exe", "steam.exe", "epicgameslauncher.exe", "fortnite.exe"],
    dndEnabled: true,
    volume: 80,
    autoActions: [
      { id: "dnd_on", type: "dnd", detail: "Enable Do Not Disturb", enabled: true },
      { id: "vol_80", type: "volume", detail: "Set volume to 80%", enabled: true },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    matchCount: 0,
  },
  {
    id: "profile_watching",
    name: "Watching Mode",
    mode: "watching",
    apps: ["vlc.exe", "mpv.exe", "netflix.exe", "chrome.exe", "msedge.exe"],
    dndEnabled: true,
    volume: 70,
    autoActions: [
      { id: "dnd_on", type: "dnd", detail: "Enable Do Not Disturb", enabled: true },
      { id: "vol_70", type: "volume", detail: "Set volume to 70%", enabled: true },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    matchCount: 0,
  },
  {
    id: "profile_communicating",
    name: "Communication Mode",
    mode: "communicating",
    apps: ["slack.exe", "discord.exe", "teams.exe", "zoom.exe", "outlook.exe"],
    dndEnabled: false,
    autoActions: [
      { id: "dnd_off", type: "dnd", detail: "Disable Do Not Disturb", enabled: true },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    matchCount: 0,
  },
  {
    id: "profile_browsing",
    name: "Browsing Mode",
    mode: "browsing",
    apps: ["chrome.exe", "msedge.exe", "firefox.exe"],
    dndEnabled: false,
    autoActions: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    matchCount: 0,
  },
];

export class ContextProfileManager {
  private profiles: ContextProfile[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      if (existsSync(PROFILES_FILE)) {
        const raw = readFileSync(PROFILES_FILE, "utf-8");
        const data = JSON.parse(raw) as { profiles?: ContextProfile[] };
        if (Array.isArray(data.profiles) && data.profiles.length > 0) {
          this.profiles = data.profiles;
          return;
        }
      }
    } catch { /* fresh start */ }
    this.profiles = [...DEFAULT_PROFILES];
    this.save();
  }

  private save(): void {
    try {
      const dir = join(homedir(), ".flux");
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(PROFILES_FILE, JSON.stringify({ profiles: this.profiles }, null, 2));
    } catch { /* best effort */ }
  }

  match(app: string, title: string): ContextProfile | null {
    const appLower = app.toLowerCase();
    for (const p of this.profiles) {
      if (p.apps.some(a => appLower.includes(a.toLowerCase()))) {
        p.matchCount++;
        p.updatedAt = Date.now();
        return p;
      }
    }
    // Try title match
    const titleLower = title.toLowerCase();
    for (const p of this.profiles) {
      if (titleLower.includes(p.name.toLowerCase().split(" ")[0] ?? "")) {
        p.matchCount++;
        p.updatedAt = Date.now();
        return p;
      }
    }
    return null;
  }

  getByMode(mode: ActivityMode): ContextProfile | null {
    return this.profiles.find(p => p.mode === mode) ?? null;
  }

  getAll(): ContextProfile[] {
    return [...this.profiles];
  }

  create(profile: Omit<ContextProfile, "id" | "createdAt" | "updatedAt" | "matchCount">): ContextProfile {
    const newProfile: ContextProfile = {
      ...profile,
      id: `profile_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      matchCount: 0,
    };
    this.profiles.push(newProfile);
    this.save();
    return newProfile;
  }

  update(id: string, updates: Partial<ContextProfile>): ContextProfile | null {
    const profile = this.profiles.find(p => p.id === id);
    if (!profile) return null;
    Object.assign(profile, updates, { updatedAt: Date.now() });
    this.save();
    return profile;
  }

  delete(id: string): boolean {
    const idx = this.profiles.findIndex(p => p.id === id);
    if (idx === -1) return false;
    this.profiles.splice(idx, 1);
    this.save();
    return true;
  }
}
