import * as fs from "node:fs";
import * as path from "node:path";
import type { ProviderName } from "@ai-agent/providers";

export interface SessionMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  provider?: ProviderName;
  model?: string;
  durationMs?: number;
  toolUsed?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface SessionData {
  messages: SessionMessage[];
  provider: ProviderName;
  model: string;
  createdAt: string;
  updatedAt: string;
}

const SESSION_DIR = path.join(process.env.HOME || "~", ".flux");
const SESSION_FILE = path.join(SESSION_DIR, "session.json");

function ensureDir(): void {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
}

export function loadSession(): SessionData | null {
  try {
    if (!fs.existsSync(SESSION_FILE)) return null;
    const raw = fs.readFileSync(SESSION_FILE, "utf-8");
    const data = JSON.parse(raw) as Record<string, unknown>;

    if (Array.isArray(data.history) && !Array.isArray(data.messages)) {
      const messages: SessionMessage[] = (data.history as string[]).map(
        (h) => ({
          role: "user" as const,
          content: h,
          timestamp: (data.savedAt as string) || new Date().toISOString(),
        }),
      );
      return {
        messages,
        provider: (data.provider as ProviderName) || "ollama",
        model: (data.model as string) || "qwen2.5:0.5b",
        createdAt: (data.savedAt as string) || new Date().toISOString(),
        updatedAt: (data.savedAt as string) || new Date().toISOString(),
      };
    }

    return data as unknown as SessionData;
  } catch {
    return null;
  }
}

export function saveSession(data: SessionData): void {
  ensureDir();
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function createSession(
  provider: ProviderName,
  model: string,
): SessionData {
  const now = new Date().toISOString();
  return {
    messages: [],
    provider,
    model,
    createdAt: now,
    updatedAt: now,
  };
}

export function addMessage(
  data: SessionData,
  msg: SessionMessage,
): SessionData {
  data.messages.push(msg);
  data.updatedAt = new Date().toISOString();
  return data;
}

export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(ms / 60000);
  const sec = ((ms % 60000) / 1000).toFixed(0);
  return `${min}m ${sec}s`;
}

export function formatTokens(n: number | undefined): string {
  if (n === undefined || n === null) return "—";
  if (n < 1000) return `${n}`;
  if (n < 1000000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1000000).toFixed(2)}M`;
}

export function countTokens(text: string): number {
  // Rough estimate: ~4 chars per token for English text
  return Math.ceil(text.length / 4);
}
