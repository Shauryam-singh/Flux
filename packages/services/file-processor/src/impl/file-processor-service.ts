/**
 * File Processor Service
 *
 * Reads local files and uses the LLM to summarise, explain, or answer
 * questions about them. Supports:
 *   - "summarise <file>"
 *   - "what does <file> do?"
 *   - "explain <file>"
 *   - "ask about <file>: <question>"
 *   - "read <file>"
 *   - "compare <file1> and <file2>"
 */

import { readFileSync, statSync, readdirSync } from "node:fs";
import { extname, basename, resolve, dirname, join, relative } from "node:path";
import type { Service, ServiceContext, ServiceResponse } from "@ai-agent/services-core";

// ─── File reading helpers ───────────────────────────────────────

const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".json", ".jsonc", ".json5",
  ".md", ".mdx", ".txt", ".csv", ".tsv",
  ".py", ".pyi", ".pyx",
  ".rs", ".go", ".java", ".kt", ".kts",
  ".c", ".cpp", ".h", ".hpp", ".cc",
  ".rb", ".php", ".swift", ".m", ".mm",
  ".sh", ".bash", ".zsh", ".fish", ".ps1", ".bat", ".cmd",
  ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf",
  ".xml", ".html", ".htm", ".css", ".scss", ".less",
  ".sql", ".graphql", ".gql",
  ".env", ".env.local", ".env.example",
  ".gitignore", ".dockerignore", ".editorconfig",
  ".prettierrc", ".eslintrc",
  "Makefile", "Dockerfile", "docker-compose.yml",
  "Cargo.toml", "package.json", "tsconfig.json",
  "README", "LICENSE", "CHANGELOG",
]);

const MAX_FILE_SIZE = 100_000; // 100KB — beyond this, truncate
const MAX_LINES = 2000;

interface FileInfo {
  path: string;
  content: string;
  size: number;
  lines: number;
  extension: string;
  name: string;
}

function isTextFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  const name = basename(filePath);
  if (TEXT_EXTENSIONS.has(ext)) return true;
  if (TEXT_EXTENSIONS.has(name)) return true;
  // Heuristic: try reading as text
  try {
    const stat = statSync(filePath);
    if (stat.size > MAX_FILE_SIZE * 2) return false;
    const buf = readFileSync(filePath);
    // Check for null bytes (binary indicator)
    for (let i = 0; i < Math.min(buf.length, 512); i++) {
      if (buf[i] === 0) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function readFileSafe(filePath: string): FileInfo | null {
  try {
    const resolved = resolve(filePath);
    const stat = statSync(resolved);
    if (stat.isDirectory()) {
      return readDirectorySummary(resolved);
    }
    if (!isTextFile(resolved)) {
      return null;
    }
    const raw = readFileSync(resolved, "utf-8");
    const lines = raw.split("\n");
    const content = lines.slice(0, MAX_LINES).join("\n");
    return {
      path: resolved,
      content,
      size: stat.size,
      lines: lines.length,
      extension: extname(resolved).toLowerCase(),
      name: basename(resolved),
    };
  } catch {
    return null;
  }
}

function readDirectorySummary(dirPath: string): FileInfo {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    const files: string[] = [];
    const dirs: string[] = [];
    for (const e of entries.slice(0, 50)) {
      if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules") {
        dirs.push(`${e.name}/`);
      } else if (e.isFile()) {
        files.push(e.name);
      }
    }
    const listing = [
      `Directory: ${dirPath}`,
      dirs.length > 0 ? `Directories: ${dirs.join(", ")}` : "",
      files.length > 0 ? `Files: ${files.join(", ")}` : "",
    ].filter(Boolean).join("\n");
    return {
      path: dirPath,
      content: listing,
      size: 0,
      lines: 0,
      extension: "",
      name: basename(dirPath),
    };
  } catch {
    return {
      path: dirPath,
      content: `Could not read directory: ${dirPath}`,
      size: 0,
      lines: 0,
      extension: "",
      name: basename(dirPath),
    };
  }
}

// ─── Natural language parsing ───────────────────────────────────

interface FileIntent {
  action: "read" | "summarise" | "explain" | "ask" | "compare" | "list";
  filePaths: string[];
  question?: string;
}

function parseFileIntent(input: string): FileIntent | null {
  const lower = input.toLowerCase();

  // Compare: "compare X and Y" / "diff X with Y"
  const compareMatch = input.match(
    /\b(?:compare|diff)\s+(.+?)\s+(?:and|with|vs|versus)\s+(.+)/i,
  );
  if (compareMatch) {
    return {
      action: "compare",
      filePaths: [compareMatch[1]!.trim(), compareMatch[2]!.trim()],
    };
  }

  // Ask: "ask about <file>: <question>" / "what does <file> say about X"
  const askMatch = input.match(
    /\b(?:ask|question|q)\s+(?:about|regarding|concerning)\s+(.+?):\s*(.+)/i,
  );
  if (askMatch) {
    return {
      action: "ask",
      filePaths: [askMatch[1]!.trim()],
      question: askMatch[2]!.trim(),
    };
  }

  // What does X do
  const whatMatch = input.match(/\bwhat\s+(?:does|do)\s+(.+?)\s+do\b/i);
  if (whatMatch) {
    return { action: "explain", filePaths: [whatMatch[1]!.trim()] };
  }

  // How does X work
  const howMatch = input.match(/\bhow\s+(?:does|do)\s+(.+?)\s+work\b/i);
  if (howMatch) {
    return { action: "explain", filePaths: [howMatch[1]!.trim()] };
  }

  // Summarise/summarize/summary
  const sumMatch = input.match(/\b(?:summarise|summarize|summary|tldr|tl;dr)\s+(.+)/i);
  if (sumMatch) {
    return { action: "summarise", filePaths: [sumMatch[1]!.trim()] };
  }

  // Explain
  const explainMatch = input.match(/\b(?:explain|describe|walkthrough)\s+(.+)/i);
  if (explainMatch) {
    return { action: "explain", filePaths: [explainMatch[1]!.trim()] };
  }

  // Read
  const readMatch = input.match(/\b(?:read|open|show|cat|view|display|look at|show me)\s+(.+)/i);
  if (readMatch) {
    return { action: "read", filePaths: [readMatch[1]!.trim()] };
  }

  // List files in directory
  const listMatch = input.match(/\b(?:list|ls|dir|files? in)\s+(.+)/i);
  if (listMatch) {
    return { action: "list", filePaths: [listMatch[1]!.trim()] };
  }

  // Bare file path detection (e.g., just "src/index.ts")
  const fileMatch = input.match(
    /\b([\w./\\-]+\.\w{1,10})\b/,
  );
  if (fileMatch) {
    return { action: "read", filePaths: [fileMatch[1]!] };
  }

  return null;
}

function cleanFilePath(raw: string): string {
  return raw
    .replace(/^["']|["']$/g, "")
    .replace(/^file:\/\//, "")
    .replace(/^~/, process.env.HOME ?? ".")
    .trim();
}

// ─── LLM integration ───────────────────────────────────────────

async function queryLlm(
  provider: { complete: (opts: { model: string; prompt: string; temperature: number }) => Promise<{ text: string }> } | null,
  prompt: string,
): Promise<string | null> {
  if (!provider) return null;
  try {
    const result = await provider.complete({
      model: "qwen2.5-coder:7b",
      prompt,
      temperature: 0.3,
    });
    return result.text.trim();
  } catch {
    return null;
  }
}

// ─── Service ────────────────────────────────────────────────────

const MATCH = /\b(read|summarise|summarize|summary|explain|tldr|compare|diff|ask|question|what does|how does|cat|view|show me|file processor)\b/i;

export function createFileProcessorService(): Service {
  return {
    name: "file-processor",
    description: "Read, summarise, explain, and answer questions about local files using LLM",

    canHandle(input: string): boolean {
      return MATCH.test(input);
    },

    async execute(input: string, ctx: ServiceContext): Promise<ServiceResponse> {
      const intent = parseFileIntent(input);
      if (!intent) {
        return { text: "I couldn't determine which file you're asking about. Try: \"summarise src/index.ts\" or \"what does README.md do?\"" };
      }

      const files: FileInfo[] = [];
      for (const raw of intent.filePaths) {
        const info = readFileSafe(cleanFilePath(raw));
        if (info) {
          files.push(info);
        } else {
          return { text: `Could not read file: ${raw}. Does it exist? Is it a text file?` };
        }
      }

      // ─── Read / List ──
      if (intent.action === "read" || intent.action === "list") {
        const f = files[0]!;
        const header = `${f.name} (${f.lines} lines, ${formatBytes(f.size)})`;
        if (f.content.length > 8000) {
          return { text: `${header}\n\n${f.content.slice(0, 8000)}\n\n... (${f.lines - MAX_LINES > 0 ? `${f.lines - MAX_LINES} more lines` : "truncated"})` };
        }
        return { text: `${header}\n\n${f.content}` };
      }

      // ─── Summarise ──
      if (intent.action === "summarise") {
        const f = files[0]!;
        const llmResult = await queryLlm(
          ctx.provider,
          `Summarise this ${f.extension || "file"} concisely. Cover: purpose, key functionality, structure, dependencies. Be direct.\n\nFile: ${f.name}\n${f.content}`,
        );
        if (llmResult) {
          return { text: `**${f.name}** (${f.lines} lines)\n\n${llmResult}` };
        }
        // Fallback: structural summary
        return { text: structuralSummary(f) };
      }

      // ─── Explain ──
      if (intent.action === "explain") {
        const f = files[0]!;
        const llmResult = await queryLlm(
          ctx.provider,
          `Explain this file in detail. Cover: what it does, how it works, key functions/exports, important patterns, and anything notable. Be thorough but clear.\n\nFile: ${f.name}\n${f.content}`,
        );
        if (llmResult) {
          return { text: `**${f.name}**\n\n${llmResult}` };
        }
        return { text: structuralSummary(f) };
      }

      // ─── Ask ──
      if (intent.action === "ask") {
        const f = files[0]!;
        const llmResult = await queryLlm(
          ctx.provider,
          `Answer this question about the file. Be specific and reference the code/content where relevant.\n\nFile: ${f.name}\nContent:\n${f.content}\n\nQuestion: ${intent.question}`,
        );
        if (llmResult) {
          return { text: `**${f.name}** — Q: ${intent.question}\n\n${llmResult}` };
        }
        return { text: `**${f.name}** — Q: ${intent.question}\n\nI couldn't process that question (no LLM available). The file is ${f.lines} lines long.` };
      }

      // ─── Compare ──
      if (intent.action === "compare") {
        const [a, b] = files;
        if (!a || !b) return { text: "I need two files to compare." };
        const llmResult = await queryLlm(
          ctx.provider,
          `Compare these two files. Highlight: similarities, differences, which is more complete, any shared patterns or issues.\n\nFile A: ${a.name}\n${a.content}\n\nFile B: ${b.name}\n${b.content}`,
        );
        if (llmResult) {
          return { text: `**Comparing ${a.name} vs ${b.name}**\n\n${llmResult}` };
        }
        return { text: `Could not compare. ${a.name}: ${a.lines} lines, ${b.name}: ${b.lines} lines.` };
      }

      return { text: "Try: \"summarise src/app.ts\", \"what does README.md do?\", or \"compare a.ts and b.ts\"." };
    },
  };
}

function structuralSummary(f: FileInfo): string {
  const lines = f.content.split("\n");
  const exports = lines.filter((l) => /\bexport\b/.test(l)).slice(0, 10);
  const imports = lines.filter((l) => /^import\b/.test(l)).slice(0, 10);
  const functions = lines.filter((l) => /\bfunction\s+\w+/.test(l)).slice(0, 10);
  const classes = lines.filter((l) => /\bclass\s+\w+/.test(l)).slice(0, 5);

  const parts = [`**${f.name}** (${f.lines} lines, ${formatBytes(f.size)})`];
  if (imports.length > 0) parts.push(`Imports: ${imports.length}`);
  if (exports.length > 0) parts.push(`Exports: ${exports.length}`);
  if (functions.length > 0) parts.push(`Functions: ${functions.map((l) => l.match(/function\s+(\w+)/)?.[1]).filter(Boolean).join(", ")}`);
  if (classes.length > 0) parts.push(`Classes: ${classes.map((l) => l.match(/class\s+(\w+)/)?.[1]).filter(Boolean).join(", ")}`);
  return parts.join("\n");
}

function formatBytes(bytes: number): string {
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}
