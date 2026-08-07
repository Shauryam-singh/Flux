/**
 * File System Intelligence Service
 *
 * Search, organize, batch operations, diff analysis — cross-platform.
 *
 * Commands:
 *   "find all PDFs I downloaded this week" — search by type + time
 *   "organize my Downloads folder" — sort by type/date
 *   "show me the diff of what I changed today" — git diff + summarize
 *   "find large files" — find files > 100MB
 *   "how much disk space" — disk usage
 *   "clean up my disk" — find temp/cache files, suggest cleanup
 *   "find files named <pattern>" — glob search
 *   "what changed in <dir>" — recent changes
 *   "copy/move <files> to <dir>" — batch file operations
 */

import { execSync } from "node:child_process";
import { readdirSync, statSync, existsSync, mkdirSync, renameSync, copyFileSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { homedir } from "node:os";
import type { Service, ServiceContext, ServiceResponse } from "@ai-agent/services-core";

// ─── Helpers ────────────────────────────────────────────────────

function run(cmd: string, timeoutMs = 15000): string {
  try {
    return execSync(cmd, { timeout: timeoutMs, encoding: "utf-8", stdio: "pipe" }).trim();
  } catch {
    return "";
  }
}

function runPs(script: string): string {
  try {
    return execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"').replace(/\n/g, "; ")}"`, {
      timeout: 15000, encoding: "utf-8", stdio: "pipe",
    }).trim();
  } catch {
    return "";
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

// ─── Search ─────────────────────────────────────────────────────

interface FileInfo {
  path: string;
  name: string;
  size: number;
  modified: string;
  type: string;
}

function findFiles(dir: string, pattern?: string, maxAge?: number, minSize?: number): FileInfo[] {
  const results: FileInfo[] = [];
  const platform = process.platform;

  if (platform === "win32") {
    let cmd = `Get-ChildItem -Path "${dir}" -Recurse -File -ErrorAction SilentlyContinue`;
    if (pattern) cmd += ` -Filter "*${pattern}*"`;
    if (minSize) cmd += ` | Where-Object { $_.Length -gt ${minSize} }`;
    cmd += ` | Select-Object -First 50 FullName, Length, LastWriteTime, Extension | ConvertTo-Json`;

    const output = runPs(cmd);
    if (output) {
      try {
        const raw = JSON.parse(output) as Array<Record<string, unknown>> | Record<string, unknown>;
        const items = Array.isArray(raw) ? raw : [raw];
        return items.map((r): FileInfo => ({
          path: String(r.FullName ?? ""),
          name: basename(String(r.FullName ?? "")),
          size: Number(r.Length ?? 0),
          modified: String(r.LastWriteTime ?? ""),
          type: String(r.Extension ?? ""),
        }));
      } catch { /* ignore */ }
    }
    return results;
  }

  // Linux/macOS: use find
  let cmd = `find "${dir}" -maxdepth 3 -type f`;
  if (pattern) cmd += ` -name "*${pattern}*"`;
  if (maxAge) cmd += ` -mtime -${Math.ceil(maxAge / 86400)}`;
  if (minSize) cmd += ` -size +${minSize}c`;
  cmd += ` -printf "%p|%s|%Tc|%f\\n" 2>/dev/null | head -50`;

  const output = run(cmd);
  if (!output) return results;

  return output.split("\n").filter(Boolean).map((line): FileInfo => {
    const [path, size, modified, name] = line.split("|");
    return {
      path: path ?? "",
      name: name ?? basename(path ?? ""),
      size: Number(size ?? 0),
      modified: modified ?? "",
      type: extname(path ?? ""),
    };
  });
}

function findByName(dir: string, name: string): FileInfo[] {
  return findFiles(dir, name);
}

function findByType(dir: string, ext: string): FileInfo[] {
  return findFiles(dir, ext.replace(/^\./, ""));
}

function findByAge(dir: string, days: number): FileInfo[] {
  return findFiles(dir, undefined, days * 86400000);
}

function findLargeFiles(dir: string, minMB = 100): FileInfo[] {
  return findFiles(dir, undefined, undefined, minMB * 1048576);
}

// ─── Disk Usage ─────────────────────────────────────────────────

function getDiskUsage(): string {
  const platform = process.platform;
  if (platform === "win32") {
    return runPs("Get-PSDrive -PSProvider FileSystem | Select-Object Name, Used, Free | Format-Table -AutoSize");
  }
  return run("df -h / /home 2>/dev/null");
}

function getDirectorySize(dir: string): string {
  const platform = process.platform;
  if (platform === "win32") {
    return runPs(`(Get-ChildItem -Path "${dir}" -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum`);
  }
  return run(`du -sh "${dir}" 2>/dev/null`);
}

// ─── Organize ───────────────────────────────────────────────────

const EXTENSION_MAP: Record<string, string> = {
  ".pdf": "Documents/PDFs",
  ".doc": "Documents/Word",
  ".docx": "Documents/Word",
  ".xls": "Documents/Excel",
  ".xlsx": "Documents/Excel",
  ".ppt": "Documents/Presentations",
  ".pptx": "Documents/Presentations",
  ".txt": "Documents/Text",
  ".md": "Documents/Text",
  ".jpg": "Images",
  ".jpeg": "Images",
  ".png": "Images",
  ".gif": "Images",
  ".svg": "Images",
  ".webp": "Images",
  ".mp4": "Videos",
  ".mkv": "Videos",
  ".avi": "Videos",
  ".mov": "Videos",
  ".mp3": "Music",
  ".wav": "Music",
  ".flac": "Music",
  ".zip": "Archives",
  ".tar": "Archives",
  ".gz": "Archives",
  ".7z": "Archives",
  ".rar": "Archives",
  ".exe": "Installers",
  ".msi": "Installers",
  ".deb": "Installers",
  ".dmg": "Installers",
  ".iso": "Installers",
  ".js": "Code",
  ".ts": "Code",
  ".py": "Code",
  ".rs": "Code",
  ".go": "Code",
  ".java": "Code",
  ".cpp": "Code",
  ".c": "Code",
};

function organizeDir(dir: string, dryRun = false): string {
  if (!existsSync(dir)) return `Directory not found: ${dir}`;

  const files = readdirSync(dir);
  const moved: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const filePath = join(dir, file);
    try {
      const stat = statSync(filePath);
      if (!stat.isFile()) continue;

      const ext = extname(file).toLowerCase();
      const targetDir = EXTENSION_MAP[ext];
      if (!targetDir) continue;

      const targetPath = join(dir, targetDir, file);
      if (dryRun) {
        moved.push(`${file} → ${targetDir}/`);
        continue;
      }

      mkdirSync(join(dir, targetDir), { recursive: true });
      renameSync(filePath, targetPath);
      moved.push(`${file} → ${targetDir}/`);
    } catch (e) {
      errors.push(`${file}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const summary = `Organized ${moved.length} files${dryRun ? " (dry run)" : ""}:\n${moved.join("\n")}`;
  return errors.length > 0 ? `${summary}\n\nErrors:\n${errors.join("\n")}` : summary;
}

// ─── Git Diff ───────────────────────────────────────────────────

function getTodayDiff(): string {
  const diff = run("git diff --stat HEAD 2>/dev/null");
  if (!diff) return "No changes detected.";

  const stat = run("git diff --shortstat HEAD 2>/dev/null");
  return `Today's changes:\n${diff}\n\nSummary: ${stat}`;
}

function getRecentCommits(n = 10): string {
  return run(`git log --oneline -${n} 2>/dev/null`) || "No recent commits.";
}

// ─── Cleanup Suggestions ────────────────────────────────────────

function suggestCleanup(): string {
  const platform = process.platform;
  const suggestions: string[] = [];

  // Check temp dirs
  const tempSize = getDirectorySize(platform === "win32" ? "$env:TEMP" : "/tmp");
  if (tempSize) suggestions.push(`Temp files: ${tempSize}`);

  // Check cache
  const cacheDir = platform === "win32"
    ? join(homedir(), "AppData", "Local", "Temp")
    : join(homedir(), ".cache");
  if (existsSync(cacheDir)) {
    const cacheSize = getDirectorySize(cacheDir);
    if (cacheSize) suggestions.push(`Cache: ${cacheSize}`);
  }

  // Check npm cache
  const npmCache = run("npm cache ls 2>/dev/null | wc -l");
  if (Number.parseInt(npmCache, 10) > 0) suggestions.push(`npm cache: ${npmCache} packages`);

  // Check logs
  if (existsSync("/var/log")) {
    const logSize = getDirectorySize("/var/log");
    if (logSize) suggestions.push(`System logs: ${logSize}`);
  }

  // Large files
  const large = findLargeFiles(homedir(), 500);
  if (large.length > 0) {
    suggestions.push(`Large files (>500MB): ${large.map((f) => `${f.name} (${formatSize(f.size)})`).join(", ")}`);
  }

  if (suggestions.length === 0) return "Your disk looks clean! No major cleanup needed.";

  return `Disk cleanup suggestions:\n\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nRun: "clean up my disk" to execute cleanup.`;
}

// ─── Service ────────────────────────────────────────────────────

const MATCH = /\b(find|search|organize|diff|disk|cleanup|clean\s+up|large\s+files|disk\s+space|what\s+changed|recent\s+commits|copy|move|folder|file\s+system)\b/i;

export function createFileIntelligenceService(): Service {
  return {
    name: "file-intelligence",
    description: "File system intelligence — search, organize, batch operations, diff analysis, disk cleanup",
    canHandle: (input: string) => MATCH.test(input),

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const lower = input.toLowerCase();

      try {
        // Organize folder
        const orgMatch = lower.match(/\borganize\s+(?:my\s+)?(.+?)(?:\s+folder)?$/);
        if (orgMatch) {
          const dir = orgMatch[1]!.trim();
          const target = dir === "downloads" ? join(homedir(), "Downloads")
            : dir === "desktop" ? join(homedir(), "Desktop")
            : dir;
          return { text: organizeDir(target, lower.includes("preview") || lower.includes("dry")) };
        }

        // Find PDFs/files by type
        const typeMatch = input.match(/\bfind\s+(?:all\s+)?(\w+?)(?:s)?\s+(?:in|from|under)\s+(.+)/i);
        if (typeMatch) {
          const ext = typeMatch[1]!.trim();
          const dir = typeMatch[2]!.trim();
          const files = findByType(dir, ext);
          return { text: `Found ${files.length} .${ext} files:\n\n${files.map((f) => `${f.name} (${formatSize(f.size)}) in ${f.path}`).join("\n")}` };
        }

        // Find by name
        const nameMatch = input.match(/\bfind\s+files?\s+(?:named?|called?)\s+(.+)/i);
        if (nameMatch) {
          const files = findByName(homedir(), nameMatch[1]!.trim());
          return { text: `Found ${files.length} files:\n\n${files.map((f) => `${f.name} — ${f.path}`).join("\n")}` };
        }

        // Find large files
        if (/\bfind\s+large\s+files?\b/.test(lower) || /\blarge\s+files?\b/.test(lower)) {
          const minMatch = lower.match(/(\d+)\s*(mb|gb)/);
          const minMB = minMatch ? (minMatch[2] === "gb" ? Number.parseInt(minMatch[1]!, 10) * 1024 : Number.parseInt(minMatch[1]!, 10)) : 100;
          const files = findLargeFiles(homedir(), minMB);
          return { text: `Large files (>${minMB}MB):\n\n${files.map((f) => `${f.name} (${formatSize(f.size)}) — ${f.path}`).join("\n")}` };
        }

        // Disk usage
        if (/\b(disk\s+space|disk\s+usage|how\s+much\s+disk)\b/.test(lower)) {
          return { text: `Disk usage:\n${getDiskUsage()}` };
        }

        // Cleanup
        if (/\b(clean\s*up|cleanup)\b/.test(lower)) {
          return { text: suggestCleanup() };
        }

        // Git diff
        if (/\bdiff\b/.test(lower)) {
          return { text: getTodayDiff() };
        }

        // Recent commits
        if (/\brecent\s+commits?\b/.test(lower)) {
          return { text: getRecentCommits() };
        }

        // What changed
        const changedMatch = lower.match(/\bwhat\s+changed\s+(?:in\s+)?(.+)/);
        if (changedMatch) {
          const dir = changedMatch[1]!.trim();
          const files = findFiles(dir, undefined, 1);
          return { text: `Recent changes in ${dir}:\n\n${files.map((f) => `${f.name} — modified ${f.modified}`).join("\n")}` };
        }

        // Copy/Move
        const moveMatch = input.match(/\b(?:move|copy)\s+(.+?)\s+to\s+(.+)/i);
        if (moveMatch) {
          const source = moveMatch[1]!.trim();
          const dest = moveMatch[2]!.trim();
          const isCopy = /copy/i.test(input);
          try {
            if (isCopy) {
              copyFileSync(source, join(dest, basename(source)));
              return { text: `Copied ${basename(source)} to ${dest}` };
            }
            renameSync(source, join(dest, basename(source)));
            return { text: `Moved ${basename(source)} to ${dest}` };
          } catch (e) {
            return { text: `Error: ${e instanceof Error ? e.message : String(e)}` };
          }
        }

        return { text: "File command not recognized. Try: find files, organize downloads, show diff, disk usage" };
      } catch (e) {
        return { text: `File error: ${e instanceof Error ? e.message : String(e)}` };
      }
    },
  };
}
