export interface KnowledgeEntry {
  id: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  content: string;
  keywords: ReadonlyArray<string>;
  indexedAt: number;
}

export interface KnowledgeBase {
  /** Index a directory of source files */
  indexDirectory(dir: string, options?: IndexOptions): Promise<number>;
  /** Search for entries matching a query */
  search(query: string, limit?: number): ReadonlyArray<KnowledgeEntry>;
  /** Get an entry by ID */
  get(id: string): KnowledgeEntry | null;
  /** Get all entries */
  getAll(): ReadonlyArray<KnowledgeEntry>;
  /** Clear the index */
  clear(): void;
  /** Get stats */
  getStats(): { totalEntries: number; totalFiles: number; lastIndexed: number | null };
}

export interface IndexOptions {
  /** File extensions to include (default: .ts, .js, .json, .md) */
  extensions?: ReadonlyArray<string>;
  /** Directories to exclude */
  excludeDirs?: ReadonlyArray<string>;
  /** Max file size in bytes (default: 100KB) */
  maxFileSize?: number;
  /** Max lines per chunk (default: 50) */
  chunkSize?: number;
}
