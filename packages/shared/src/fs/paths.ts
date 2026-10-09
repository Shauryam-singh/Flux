import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

// Cross-platform user-directory helpers.
// Uses os.homedir() (works on Windows) instead of process.env.HOME
// (undefined on Windows), which previously produced paths like
// "undefined/Pictures/..." or wrote config to /tmp.

/** ~/.flux — shared config/state directory for Flux. */
export function fluxHomeDir(): string {
  return join(homedir(), ".flux");
}

/** A file inside ~/.flux, e.g. getConfigPath("messaging.json"). */
export function getConfigPath(...segments: string[]): string {
  return join(fluxHomeDir(), ...segments);
}

/** Platform-aware Pictures directory (XDG override + Windows home). */
export function getPicturesDir(): string {
  return process.env.XDG_PICTURES_DIR ?? join(homedir(), "Pictures");
}

/** Platform-aware Videos directory (XDG override + Windows home). */
export function getVideosDir(): string {
  return process.env.XDG_VIDEOS_DIR ?? join(homedir(), "Videos");
}

/** Expand a leading "~" or "~/" into the user's home directory. */
export function expandHome(raw: string): string {
  if (raw === "~") return homedir();
  if (raw.startsWith("~/")) return join(homedir(), raw.slice(2));
  return raw;
}

/** Temp file path with a stable cross-platform base. */
export function tmpFilePath(name: string): string {
  return join(tmpdir(), name);
}
