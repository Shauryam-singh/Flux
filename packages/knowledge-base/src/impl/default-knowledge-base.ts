import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import type {
  KnowledgeBase,
  IndexOptions,
  KnowledgeEntry,
} from "../interfaces/knowledge-base.js";

const DEFAULT_EXTENSIONS = [".ts", ".js", ".json", ".md", ".py", ".rs", ".go"];
const DEFAULT_EXCLUDE_DIRS = ["node_modules", ".git", "dist", ".turbo", "__pycache__", "target"];
const DEFAULT_MAX_FILE_SIZE = 100_000;
const DEFAULT_CHUNK_SIZE = 50;

export class DefaultKnowledgeBase implements KnowledgeBase {
  private entries: Map<string, KnowledgeEntry> = new Map();
  private indexedFiles: Set<string> = new Set();
  private counter = 0;
  private lastIndexedAt: number | null = null;

  async indexDirectory(dir: string, options?: IndexOptions): Promise<number> {
    const extensions = options?.extensions ?? DEFAULT_EXTENSIONS;
    const excludeDirs = options?.excludeDirs ?? DEFAULT_EXCLUDE_DIRS;
    const maxFileSize = options?.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
    const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;

    const files = await this.findFiles(dir, extensions, excludeDirs, maxFileSize);
    let count = 0;

    for (const file of files) {
      try {
        const content = await readFile(file, "utf-8");
        const lines = content.split("\n");
        const relPath = relative(dir, file);

        // Skip files already indexed (same content hash via line count + first line)
        const fingerprint = `${relPath}:${lines.length}:${lines[0]?.length ?? 0}`;
        if (this.indexedFiles.has(fingerprint)) continue;

        // Chunk the file
        for (let i = 0; i < lines.length; i += chunkSize) {
          const chunkLines = lines.slice(i, i + chunkSize);
          const chunkContent = chunkLines.join("\n").trim();
          if (!chunkContent) continue;

          const keywords = this.extractKeywords(chunkContent);
          const id = `kb_${++this.counter}`;

          this.entries.set(id, {
            id,
            filePath: relPath,
            lineStart: i + 1,
            lineEnd: Math.min(i + chunkSize, lines.length),
            content: chunkContent,
            keywords,
            indexedAt: Date.now(),
          });
          count++;
        }

        this.indexedFiles.add(fingerprint);
      } catch {
        // Skip unreadable files
      }
    }

    this.lastIndexedAt = Date.now();
    return count;
  }

  search(query: string, limit: number = 10): ReadonlyArray<KnowledgeEntry> {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 1);

    if (queryWords.length === 0) return [];

    const scored: Array<{ entry: KnowledgeEntry; score: number }> = [];

    for (const entry of this.entries.values()) {
      let score = 0;

      // Exact substring match in content (high weight)
      if (entry.content.toLowerCase().includes(queryLower)) {
        score += 100;
      }

      // Keyword matches
      for (const word of queryWords) {
        for (const kw of entry.keywords) {
          if (kw === word) score += 10;
          else if (kw.startsWith(word) || word.startsWith(kw)) score += 5;
        }
      }

      // File path relevance (lower weight)
      if (entry.filePath.toLowerCase().includes(queryLower)) {
        score += 3;
      }

      if (score > 0) {
        scored.push({ entry, score });
      }
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.entry);
  }

  get(id: string): KnowledgeEntry | null {
    return this.entries.get(id) ?? null;
  }

  getAll(): ReadonlyArray<KnowledgeEntry> {
    return Array.from(this.entries.values());
  }

  clear(): void {
    this.entries.clear();
    this.indexedFiles.clear();
    this.counter = 0;
    this.lastIndexedAt = null;
  }

  getStats(): { totalEntries: number; totalFiles: number; lastIndexed: number | null } {
    return {
      totalEntries: this.entries.size,
      totalFiles: this.indexedFiles.size,
      lastIndexed: this.lastIndexedAt,
    };
  }

  private async findFiles(
    dir: string,
    extensions: ReadonlyArray<string>,
    excludeDirs: ReadonlyArray<string>,
    maxFileSize: number,
  ): Promise<string[]> {
    const results: string[] = [];

    try {
      const entries = await readdir(dir);

      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const entryStat = await stat(fullPath);

        if (entryStat.isDirectory()) {
          if (!excludeDirs.includes(entry)) {
            const subFiles = await this.findFiles(fullPath, extensions, excludeDirs, maxFileSize);
            results.push(...subFiles);
          }
        } else if (entryStat.isFile() && entryStat.size <= maxFileSize) {
          const ext = extname(entry).toLowerCase();
          if (extensions.includes(ext)) {
            results.push(fullPath);
          }
        }
      }
    } catch {
      // Skip unreadable directories
    }

    return results;
  }

  private extractKeywords(content: string): ReadonlyArray<string> {
    const words = new Set<string>();

    // Extract identifiers, function names, class names
    const identifiers = content.match(/[a-zA-Z_$][a-zA-Z0-9_$]*/g) ?? [];
    for (const id of identifiers) {
      if (id.length > 2 && id.length < 50) {
        words.add(id.toLowerCase());
      }
    }

    // Extract quoted strings
    const strings = content.match(/"([^"]+)"/g) ?? content.match(/'([^']+)'/g) ?? [];
    for (const s of strings) {
      const cleaned = s.slice(1, -1).toLowerCase();
      if (cleaned.length > 2 && cleaned.length < 100) {
        words.add(cleaned);
      }
    }

    // Extract file paths
    const paths = content.match(/[a-zA-Z0-9_/\\.-]+\.(ts|js|json|md|py|rs|go)/g) ?? [];
    for (const p of paths) {
      words.add(p.toLowerCase());
    }

    return Array.from(words);
  }
}
