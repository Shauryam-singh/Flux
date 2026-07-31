/**
 * Game Updater Service
 *
 * Checks for game updates on Steam and Epic Games Store.
 * Supports:
 *   - Listing installed games from Steam libraryfolders.vdf + app manifests
 *   - Checking for pending updates via steamcmd or appmanifest_*.acf
 *   - Triggering updates via steamcmd or steam:// URI
 *   - Epic Games via Heroic Games Launcher (Linux) or Epic Games Launcher
 */

import { execSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Service, ServiceContext, ServiceResponse } from "@ai-agent/services-core";

// ─── Types ──────────────────────────────────────────────────────

export interface GameInfo {
  readonly appId: string;
  readonly name: string;
  readonly platform: "steam" | "epic";
  readonly hasUpdate: boolean;
  readonly lastUpdated: string | null;
  readonly sizeOnDisk: number | null;
  readonly installDir: string | null;
}

// ─── Platform detection ─────────────────────────────────────────

function getPlatform(): "linux" | "win32" | "darwin" {
  return process.platform as "linux" | "win32" | "darwin";
}

function runSafe(cmd: string, timeoutMs = 15000): string {
  try {
    return execSync(cmd, { timeout: timeoutMs, stdio: "pipe", encoding: "utf-8" });
  } catch {
    return "";
  }
}

// ─── Steam ──────────────────────────────────────────────────────

function getSteamLibraryFolders(): string[] {
  const platform = getPlatform();
  const candidates: string[] = [];

  if (platform === "linux") {
    candidates.push(
      `${process.env.HOME}/.steam/steam`,
      `${process.env.HOME}/.local/share/Steam`,
      `${process.env.HOME}/.steam/debian-installation`,
    );
  } else if (platform === "win32") {
    candidates.push(
      "C:/Program Files (x86)/Steam",
      "C:/Program Files/Steam",
      `${process.env["PROGRAMFILES(X86)"]}/Steam`,
    );
  } else if (platform === "darwin") {
    candidates.push(
      `${process.env.HOME}/Library/Application Support/Steam`,
    );
  }

  const steamApps: string[] = [];
  for (const base of candidates) {
    if (!base) continue;
    const sa = join(base, "steamapps");
    if (existsSync(sa)) steamApps.push(sa);
    // Also check libraryfolders.vdf for additional library paths
    const vdfPath = join(sa, "libraryfolders.vdf");
    if (existsSync(vdfPath)) {
      try {
        const content = readFileSync(vdfPath, "utf-8");
        const pathRegex = /"path"\s+"([^"]+)"/g;
        let m: RegExpExecArray | null;
        while ((m = pathRegex.exec(content)) !== null) {
          const libPath = m[1]!;
          const libSa = join(libPath, "steamapps");
          if (existsSync(libSa) && !steamApps.includes(libSa)) {
            steamApps.push(libSa);
          }
        }
      } catch {
        // Ignore
      }
    }
  }

  return steamApps;
}

function parseVdfQuoted(value: string): string {
  return value.replace(/^"(.*)"$/, "$1");
}

function getSteamGames(): GameInfo[] {
  const games: GameInfo[] = [];
  const libraryFolders = getSteamLibraryFolders();

  for (const sa of libraryFolders) {
    try {
      const files = readdirSync(sa);
      for (const file of files) {
        if (!file.startsWith("appmanifest_") || !file.endsWith(".acf")) continue;
        try {
          const content = readFileSync(join(sa, file), "utf-8");
          const appIdMatch = content.match(/"appid"\s+"(\d+)"/);
          const nameMatch = content.match(/"name"\s+"([^"]+)"/);
          const stateFlagsMatch = content.match(/"StateFlags"\s+"(\d+)"/);
          const sizeMatch = content.match(/"SizeOnDisk"\s+"(\d+)"/);
          const dirMatch = content.match(/"installdir"\s+"([^"]+)"/);
          const lastUpdatedMatch = content.match(/"LastUpdated"\s+"(\d+)"/);

          if (!appIdMatch?.[1] || !nameMatch?.[1]) continue;

          const stateFlags = stateFlagsMatch?.[1] ? Number.parseInt(stateFlagsMatch[1], 10) : 0;
          // StateFlags bit 1 (value 2) = Update Required
          const hasUpdate = (stateFlags & 2) !== 0;

          games.push({
            appId: appIdMatch[1],
            name: parseVdfQuoted(nameMatch[1]),
            platform: "steam",
            hasUpdate,
            lastUpdated: lastUpdatedMatch?.[1]
              ? new Date(Number.parseInt(lastUpdatedMatch[1], 10) * 1000).toISOString()
              : null,
            sizeOnDisk: sizeMatch?.[1] ? Number.parseInt(sizeMatch[1], 10) : null,
            installDir: dirMatch?.[1] ? parseVdfQuoted(dirMatch[1]) : null,
          });
        } catch {
          // Skip corrupt manifest
        }
      }
    } catch {
      // Skip inaccessible folder
    }
  }

  return games;
}

function triggerSteamUpdate(appId: string): boolean {
  const platform = getPlatform();
  try {
    if (platform === "linux" || platform === "darwin") {
      // Use steamcmd to validate/update
      const result = runSafe(
        `steamcmd +login anonymous +app_update ${appId} +quit 2>&1 | tail -5`,
        30000,
      );
      return result.includes("Success") || result.includes("already up to date");
    } else {
      // On Windows, use steam:// protocol or steamcmd
      runSafe(`start "steam://validate/${appId}"`, 5000);
      return true;
    }
  } catch {
    return false;
  }
}

function validateSteamGame(appId: string): string {
  const platform = getPlatform();
  if (platform === "linux" || platform === "darwin") {
    return runSafe(
      `steamcmd +login anonymous +app_update ${appId} validate +quit 2>&1 | tail -10`,
      60000,
    );
  }
  return runSafe(`start "steam://validate/${appId}"`, 5000);
}

// ─── Epic Games (via Heroic Launcher) ───────────────────────────

function getHeroicConfigPath(): string {
  const platform = getPlatform();
  if (platform === "linux") return `${process.env.HOME}/.config/heroic`;
  if (platform === "win32") return `${process.env.APPDATA}/heroic`;
  if (platform === "darwin") return `${process.env.HOME}/Library/Application Support/heroic`;
  return "";
}

function getEpicGames(): GameInfo[] {
  const games: GameInfo[] = [];
  const configPath = getHeroicConfigPath();
  if (!configPath) return games;

  // Heroic stores installed games in gog_store/installed.json or legendary/installed.json
  for (const storeDir of ["legendary", "gog_store"]) {
    const installedPath = join(configPath, storeDir, "installed.json");
    if (!existsSync(installedPath)) continue;
    try {
      const data = JSON.parse(readFileSync(installedPath, "utf-8"));
      for (const [appId, info] of Object.entries(data)) {
        const g = info as Record<string, unknown>;
        games.push({
          appId,
          name: (g.app_name as string) ?? appId,
          platform: "epic",
          hasUpdate: false, // Heroic doesn't expose update status directly
          lastUpdated: g.install_path ? new Date().toISOString() : null,
          sizeOnDisk: typeof g.install_size === "number" ? Number(g.install_size) : null,
          installDir: (g.install_path as string) ?? null,
        });
      }
    } catch {
      // Skip corrupt file
    }
  }

  return games;
}

function triggerEpicUpdate(appId: string): boolean {
  try {
    // Heroic CLI
    const result = runSafe(`heroic update ${appId} 2>&1`, 30000);
    return result.includes("updated") || result.includes("Success");
  } catch {
    return false;
  }
}

// ─── Natural language parsing ───────────────────────────────────

function parseGameIntent(input: string): {
  action: "list" | "check" | "update" | "validate" | "status";
  platform?: "steam" | "epic" | "all";
  gameName?: string;
} {
  const lower = input.toLowerCase();

  // Action
  let action: "list" | "check" | "update" | "validate" | "status" = "list";
  if (/\b(check|updates?|pending)\b/.test(lower)) action = "check";
  else if (/\b(update|install|upgrade|download)\b/.test(lower)) action = "update";
  else if (/\b(validate|verify|integrity)\b/.test(lower)) action = "validate";
  else if (/\b(status|info|details)\b/.test(lower)) action = "status";

  // Platform
  let platform: "steam" | "epic" | "all" = "all";
  if (/\b(steam|valve)\b/.test(lower)) platform = "steam";
  else if (/\b(epic|egs|egames)\b/.test(lower)) platform = "epic";

  // Game name extraction
  let gameName: string | undefined;
  const nameMatch = input.match(/\b(?:for|of|on)\s+(.+?)(?:\s+on\s+\w+|\s*$)/i);
  if (nameMatch?.[1]) gameName = nameMatch[1].trim();

  return gameName ? { action, platform, gameName } : { action, platform };
}

// ─── Service ────────────────────────────────────────────────────

const MATCH = /\b(games?|steam|epic|game\s*updater|updates?|validate|verify)\b/i;

export function createGameUpdaterService(): Service {
  return {
    name: "game-updater",
    description: "Check and trigger game updates on Steam and Epic Games Store",

    canHandle(input: string): boolean {
      return MATCH.test(input);
    },

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const intent = parseGameIntent(input);

      // Collect games from requested platforms
      let games: GameInfo[] = [];
      if (intent.platform === "steam" || intent.platform === "all") {
        games = [...games, ...getSteamGames()];
      }
      if (intent.platform === "epic" || intent.platform === "all") {
        games = [...games, ...getEpicGames()];
      }

      // Filter by game name if specified
      if (intent.gameName) {
        const query = intent.gameName.toLowerCase();
        games = games.filter((g) => g.name.toLowerCase().includes(query));
      }

      // ─── Status ──
      if (intent.action === "status" && games.length === 1) {
        const g = games[0]!;
        const lines = [
          `Game: ${g.name}`,
          `Platform: ${g.platform}`,
          `App ID: ${g.appId}`,
          `Has update: ${g.hasUpdate ? "Yes" : "No"}`,
          `Last updated: ${g.lastUpdated ? new Date(g.lastUpdated).toLocaleString() : "Unknown"}`,
          `Size: ${g.sizeOnDisk ? formatBytes(g.sizeOnDisk) : "Unknown"}`,
          `Install dir: ${g.installDir ?? "Unknown"}`,
        ];
        return { text: lines.join("\n") };
      }

      // ─── List / Check ──
      if (intent.action === "list" || intent.action === "check") {
        if (games.length === 0) {
          return { text: "No installed games found. Is Steam or Heroic Games Launcher installed?" };
        }

        const withUpdates = games.filter((g) => g.hasUpdate);
        const lines: string[] = [];

        if (withUpdates.length > 0) {
          lines.push(`Games with pending updates (${withUpdates.length}):`);
          for (const g of withUpdates) {
            lines.push(`  - ${g.name} (${g.platform}, ${g.appId})`);
          }
        }

        const upToDate = games.filter((g) => !g.hasUpdate);
        if (upToDate.length > 0) {
          lines.push(`\nUp to date (${upToDate.length}):`);
          for (const g of upToDate.slice(0, 15)) {
            lines.push(`  - ${g.name} (${g.platform})`);
          }
          if (upToDate.length > 15) lines.push(`  ... and ${upToDate.length - 15} more`);
        }

        lines.push(`\nTotal: ${games.length} games across ${intent.platform === "all" ? "Steam + Epic" : intent.platform}`);
        return { text: lines.join("\n") };
      }

      // ─── Update ──
      if (intent.action === "update") {
        if (games.length === 0) {
          return { text: "No matching games found to update." };
        }

        const results: string[] = [];
        for (const g of games) {
          if (!g.hasUpdate && intent.platform !== "all") {
            results.push(`${g.name}: Already up to date.`);
            continue;
          }
          let ok = false;
          if (g.platform === "steam") ok = triggerSteamUpdate(g.appId);
          else if (g.platform === "epic") ok = triggerEpicUpdate(g.appId);
          results.push(`${g.name}: ${ok ? "Update triggered" : "Could not trigger update"}`);
        }
        return { text: results.join("\n") };
      }

      // ─── Validate ──
      if (intent.action === "validate") {
        if (games.length === 0) {
          return { text: "No matching games found to validate." };
        }

        const results: string[] = [];
        for (const g of games) {
          if (g.platform === "steam") {
            const output = validateSteamGame(g.appId);
            results.push(`${g.name}: ${output.slice(-200) || "Validation triggered"}`);
          } else {
            results.push(`${g.name}: Validation not supported on Epic via CLI`);
          }
        }
        return { text: results.join("\n") };
      }

      return { text: "Try: \"check for game updates\", \"list my games\", \"update steam games\", or \"validate game files\"." };
    },
  };
}

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}
