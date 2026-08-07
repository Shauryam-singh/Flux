/**
 * Spotify Service
 *
 * Deep Spotify integration — cross-platform (Linux playerctl + Windows/macOS Spotify Web API).
 *
 * Commands:
 *   "play" / "pause" / "next" / "skip" / "previous"
 *   "what song" / "now playing"
 *   "play <song name>" — search and play
 *   "play playlist <name>" — play a playlist
 *   "create playlist <name>" — create new playlist
 *   "shuffle on/off" / "repeat on/off"
 *   "set volume <n>"
 */

import { execSync } from "node:child_process";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Service, ServiceContext, ServiceResponse } from "@ai-agent/services-core";

// ─── Config ─────────────────────────────────────────────────────

interface SpotifyConfig {
  accessToken?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
}

const CONFIG_PATH = join(homedir(), ".flux", "spotify.json");

function loadConfig(): SpotifyConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as SpotifyConfig;
    }
  } catch { /* ignore */ }
  return {};
}

function saveConfig(config: SpotifyConfig): void {
  try {
    const dir = join(homedir(), ".flux");
    if (!existsSync(dir)) {
      const { mkdirSync } = require("node:fs") as typeof import("node:fs");
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch { /* ignore */ }
}

// ─── Platform Detection ─────────────────────────────────────────

function getPlatform(): string {
  return process.platform;
}

function hasPlayerctl(): boolean {
  try {
    execSync("which playerctl", { timeout: 2000, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

// ─── Linux: playerctl (MPRIS) ───────────────────────────────────

function playerctl(args: string): string {
  try {
    return execSync(`playerctl ${args}`, { timeout: 5000, encoding: "utf-8", stdio: "pipe" }).trim();
  } catch {
    return "";
  }
}

function linuxPlay(): string { return playerctl("play"); }
function linuxPause(): string { return playerctl("pause"); }
function linuxNext(): string { playerctl("next"); return "Skipped to next track"; }
function linuxPrevious(): string { playerctl("previous"); return "Went to previous track"; }
function linuxCurrentTrack(): string {
  const artist = playerctl("metadata artist");
  const title = playerctl("metadata title");
  const album = playerctl("metadata album");
  const status = playerctl("status");
  if (!title) return "No track playing.";
  return `${status === "Playing" ? "▶" : "⏸"} ${title} — ${artist}\nAlbum: ${album}`;
}
function linuxSetVolume(n: number): string { playerctl(`volume ${Math.max(0, Math.min(1, n / 100))}`); return `Volume set to ${n}%`; }
function linuxShuffle(on: boolean): string { playerctl(`shuffle ${on ? "on" : "off"}`); return `Shuffle ${on ? "on" : "off"}`; }
function linuxRepeat(on: boolean): string { playerctl(`repeat ${on ? "on" : "off"}`); return `Repeat ${on ? "on" : "off"}`; }

// ─── Windows/macOS: Spotify Web API ─────────────────────────────

async function spotifyApi(method: string, path: string, body?: unknown): Promise<unknown> {
  const config = loadConfig();
  if (!config.accessToken) return null;

  try {
    const opts: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
    };
    if (body !== undefined) {
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`https://api.spotify.com/v1${path}`, opts);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function webPlay(): Promise<string> {
  const res = await spotifyApi("PUT", "/me/player/play");
  return res === null ? "Failed to resume playback. Check Spotify is open and token is valid." : "Resumed playback";
}

async function webPause(): Promise<string> {
  const res = await spotifyApi("PUT", "/me/player/pause");
  return res === null ? "Failed to pause." : "Paused playback";
}

async function webNext(): Promise<string> {
  await spotifyApi("POST", "/me/player/next");
  return "Skipped to next track";
}

async function webPrevious(): Promise<string> {
  await spotifyApi("POST", "/me/player/previous");
  return "Went to previous track";
}

async function webCurrentTrack(): Promise<string> {
  const data = await spotifyApi("GET", "/me/player/currently-playing") as Record<string, unknown> | null;
  if (!data || !data.item) return "No track playing.";
  const item = data.item as Record<string, unknown>;
  const artists = (item.artists as Array<Record<string, string>>)?.map((a) => a.name).join(", ") ?? "";
  const isPlaying = data.is_playing;
  return `${isPlaying ? "▶" : "⏸"} ${item.name} — ${artists}\nAlbum: ${(item.album as Record<string, string>)?.name ?? ""}`;
}

async function webSearch(query: string): Promise<string> {
  const data = await spotifyApi("GET", `/search?q=${encodeURIComponent(query)}&type=track&limit=5`) as Record<string, unknown> | null;
  if (!data?.tracks) return "No results found.";
  const tracks = (data.tracks as Record<string, unknown>).items as Array<Record<string, unknown>>;
  return tracks.map((t, i) => {
    const artists = (t.artists as Array<Record<string, string>>)?.map((a) => a.name).join(", ") ?? "";
    return `${i + 1}. ${t.name} — ${artists} (${t.id})`;
  }).join("\n");
}

async function webPlayTrack(trackId: string): Promise<string> {
  await spotifyApi("PUT", "/me/player/play", { uris: [`spotify:track:${trackId}`] });
  return "Playing track";
}

async function webSetVolume(n: number): Promise<string> {
  await spotifyApi("PUT", `/me/player/volume?volume=${Math.max(0, Math.min(100, n))}`);
  return `Volume set to ${n}%`;
}

async function webShuffle(on: boolean): Promise<string> {
  await spotifyApi("PUT", `/me/player/shuffle?state=${on}`);
  return `Shuffle ${on ? "on" : "off"}`;
}

async function webRepeat(on: boolean): Promise<string> {
  await spotifyApi("PUT", `/me/player/repeat?state=${on ? "track" : "off"}`);
  return `Repeat ${on ? "on" : "off"}`;
}

async function webCreatePlaylist(name: string): Promise<string> {
  const me = await spotifyApi("GET", "/me") as Record<string, string> | null;
  if (!me?.id) return "Failed to get user info.";
  const res = await spotifyApi("POST", `/users/${me.id}/playlists`, { name, public: false }) as Record<string, unknown> | null;
  return res?.id ? `Created playlist "${name}"` : "Failed to create playlist.";
}

async function webPlayPlaylist(name: string): Promise<string> {
  const me = await spotifyApi("GET", "/me") as Record<string, string> | null;
  if (!me?.id) return "Failed to get user info.";
  const data = await spotifyApi("GET", `/users/${me.id}/playlists?limit=50`) as Record<string, unknown> | null;
  if (!data?.items) return "No playlists found.";
  const items = data.items as Array<Record<string, unknown>>;
  const playlist = items.find((p) => (p.name as string)?.toLowerCase() === name.toLowerCase());
  if (!playlist) return `Playlist "${name}" not found.`;
  await spotifyApi("PUT", "/me/player/play", { context_uri: `spotify:playlist:${playlist.id}` });
  return `Playing playlist "${name}"`;
}

// ─── Service ────────────────────────────────────────────────────

const MATCH = /\b(play|pause|skip|next|previous|prev|what song|now playing|shuffle|repeat|volume|spotify|song|track|playlist|create playlist)\b/i;

export function createSpotifyService(): Service {
  return {
    name: "spotify",
    description: "Deep Spotify integration — play/pause/skip, search songs, manage playlists, control playback",
    canHandle: (input: string) => MATCH.test(input),

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const lower = input.toLowerCase();
      const platform = getPlatform();
      const usePlayerctl = platform === "linux" && hasPlayerctl();

      try {
        // ─── Playback Control ──
        if (/\b(play|resume)\b/.test(lower) && !/\bplaylist|song|track\b/.test(lower)) {
          const text = usePlayerctl ? linuxPlay() : await webPlay();
          return { text };
        }
        if (/\bpause\b/.test(lower)) {
          const text = usePlayerctl ? linuxPause() : await webPause();
          return { text };
        }
        if (/\b(next|skip)\b/.test(lower)) {
          const text = usePlayerctl ? linuxNext() : await webNext();
          return { text };
        }
        if (/\b(previous|prev)\b/.test(lower)) {
          const text = usePlayerctl ? linuxPrevious() : await webPrevious();
          return { text };
        }

        // ─── Now Playing ──
        if (/\b(what song|now playing|current track|what('s| is) playing)\b/.test(lower)) {
          const text = usePlayerctl ? linuxCurrentTrack() : await webCurrentTrack();
          return { text };
        }

        // ─── Volume ──
        const volMatch = lower.match(/\bvolume\s+(?:to\s+)?(\d+)/);
        if (volMatch) {
          const n = Number.parseInt(volMatch[1]!, 10);
          const text = usePlayerctl ? linuxSetVolume(n) : await webSetVolume(n);
          return { text };
        }

        // ─── Shuffle ──
        if (/\bshuffle\b/.test(lower)) {
          const on = /\b(on|enable|true)\b/.test(lower);
          const text = usePlayerctl ? linuxShuffle(on) : await webShuffle(on);
          return { text };
        }

        // ─── Repeat ──
        if (/\brepeat\b/.test(lower)) {
          const on = /\b(on|enable|true|track)\b/.test(lower);
          const text = usePlayerctl ? linuxRepeat(on) : await webRepeat(on);
          return { text };
        }

        // ─── Create Playlist ──
        const createMatch = lower.match(/\bcreate\s+playlist\s+(.+)/);
        if (createMatch) {
          const name = createMatch[1]!.trim();
          const text = await webCreatePlaylist(name);
          return { text };
        }

        // ─── Play Playlist ──
        const playlistMatch = lower.match(/\bplay\s+playlist\s+(.+)/);
        if (playlistMatch) {
          const name = playlistMatch[1]!.trim();
          const text = await webPlayPlaylist(name);
          return { text };
        }

        // ─── Search + Play Track ──
        const playMatch = lower.match(/\bplay\s+(.+)/);
        if (playMatch) {
          const query = playMatch[1]!.trim();
          const searchResult = await webSearch(query);
          const firstIdMatch = searchResult.match(/\((\w{22})\)\s*$/m);
          if (firstIdMatch?.[1]) {
            await webPlayTrack(firstIdMatch[1]);
            return { text: `Playing: ${searchResult.split("\n")[0]}` };
          }
          return { text: `Search results:\n${searchResult}` };
        }

        return { text: "Spotify command not recognized. Try: play, pause, next, previous, what song, play <song>, shuffle on/off" };
      } catch (e) {
        return { text: `Spotify error: ${e instanceof Error ? e.message : String(e)}` };
      }
    },
  };
}

export { saveConfig as saveSpotifyConfig };
