import { readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, extname, basename } from "node:path";
import type { Service } from "@ai-agent/services-core";
import type { ServiceContext } from "@ai-agent/services-core";
import type { ServiceResponse } from "@ai-agent/services-core";

interface FileEntry {
  name: string;
  type: "file" | "directory";
  size?: number | undefined;
  ext?: string | undefined;
}

function listDirectory(dirPath: string, maxDepth = 1): FileEntry[] {
  const resolved = resolve(dirPath);
  if (!existsSync(resolved)) return [];

  const entries: FileEntry[] = [];
  try {
    const items = readdirSync(resolved);
    for (const item of items) {
      if (item.startsWith(".")) continue;
      const fullPath = join(resolved, item);
      try {
        const stat = statSync(fullPath);
        entries.push({
          name: item,
          type: stat.isDirectory() ? "directory" : "file",
          size: stat.isDirectory() ? undefined : stat.size,
          ext: stat.isDirectory() ? undefined : extname(item),
        });
      } catch {
        // skip inaccessible entries
      }
    }
  } catch {
    // skip
  }

  return entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function findFiles(dirPath: string, pattern: string, maxResults = 20): string[] {
  const results: string[] = [];
  const resolved = resolve(dirPath);
  if (!existsSync(resolved)) return results;

  function walk(currentDir: string, depth: number) {
    if (depth > 5 || results.length >= maxResults) return;
    try {
      const items = readdirSync(currentDir);
      for (const item of items) {
        if (item.startsWith(".") || item === "node_modules") continue;
        const fullPath = join(currentDir, item);
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            walk(fullPath, depth + 1);
          } else if (item.toLowerCase().includes(pattern.toLowerCase())) {
            results.push(fullPath);
            if (results.length >= maxResults) return;
          }
        } catch {
          // skip
        }
      }
    } catch {
      // skip
    }
  }

  walk(resolved, 0);
  return results;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatEntries(entries: FileEntry[], dirPath: string): string {
  if (entries.length === 0) return `Empty directory: ${dirPath}`;

  const lines: string[] = [`Contents of ${dirPath}:`];
  for (const entry of entries.slice(0, 50)) {
    const icon = entry.type === "directory" ? "📁" : "📄";
    const size = entry.size !== undefined ? ` (${formatSize(entry.size)})` : "";
    lines.push(`  ${icon} ${entry.name}${size}`);
  }
  if (entries.length > 50) {
    lines.push(`  ... and ${entries.length - 50} more`);
  }
  return lines.join("\n");
}

export function createFilesService(): Service {
  return {
    name: "files",
    description: "File manager: browse directories, search for files, organize files",

    async canHandle(input: string): Promise<boolean> {
      const lower = input.toLowerCase();
      const keywords = [
        "find file", "list files", "folder", "directory", "organize",
        "move file", "copy file", "delete file", "rename",
        "browse", "explore", "what files", "show files", "ls",
      ];
      return keywords.some((k) => lower.includes(k));
    },

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const lower = input.toLowerCase();
      let result: string;

      if (lower.includes("find") || lower.includes("search")) {
        const pattern = input
          .replace(/^(find|search)\s+(file|files)?\s*/i, "")
          .trim();
        if (!pattern) {
          result = "What file pattern would you like to search for?";
        } else {
          const dir = process.cwd();
          const files = findFiles(dir, pattern);
          if (files.length === 0) {
            result = `No files matching "${pattern}" found in ${dir}`;
          } else {
            result = `Found ${files.length} file(s) matching "${pattern}":\n${files.map((f) => `  ${f}`).join("\n")}`;
          }
        }
      } else if (lower.includes("list") || lower.includes("show") || lower.includes("browse") || lower.includes("explore") || lower.includes("ls")) {
        const dirMatch = input.replace(/^(list|show|browse|explore|ls)\s+(files?|folder|directory|contents)?\s*(of|in|at)?\s*/i, "").trim();
        const dir = dirMatch || process.cwd();
        const entries = listDirectory(dir);
        result = formatEntries(entries, dir);
      } else {
        const dir = process.cwd();
        const entries = listDirectory(dir);
        result = formatEntries(entries, dir);
      }

      await ctx.memory.add("user", input);
      await ctx.memory.add("assistant", result);
      ctx.reply(result);

      return { text: result };
    },
  };
}
